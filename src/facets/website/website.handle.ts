import { randomUUID } from 'node:crypto';

import { resolveRoot } from '../../../lint/engine/project/resolve.js';
import { refusal } from '../../../lint/index.refusal.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { ResultConfig } from '../../expectations/result.js';
import type { Started } from '../../kernel/chain/config.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { ProcessHandle } from '../../world/services/process/process.adapter.js';
import type { ProcessOptions } from '../../world/services/process/process.adapter.js';
import { ServedProcess } from '../../world/services/process/serve.js';
import type { ServiceRecord } from '../../world/services/services.js';
import type { StartedServices } from '../../world/services/startup/start-services.js';
import { releaseIsolation, startServices } from '../../world/services/startup/start-services.js';
import type { AppInfo } from '../../world/services/startup/startup-report.js';
import { StubBackend } from '../../world/stubs/delivery/other-process/stub-backend.js';
import type { StubsConfig } from '../../world/stubs/delivery/other-process/stub-backend.js';
import type { BrowserPort } from './browser/browser.port.js';
import type { WebsiteSpecification } from './website.facet.js';
import { websiteFacet } from './website.facet.js';

/** Calling a factory would start the services twice: its shape is all the report needs. */
function commandOf(server: unknown): string | undefined {
    return typeof server === 'object' && server !== null && 'command' in server
        ? String(server.command)
        : undefined;
}

/** What `server` may be handed as, and what it resolves to. */
export type ServerSpec<Services extends ServiceRecord> =
    | ((services: Services) => ProcessHandle | ProcessOptions)
    | ProcessHandle
    | ProcessOptions;

/** An `env` function is resolved against the services already up. */
function resolveServer<Services extends ServiceRecord>(
    server: ServerSpec<Services>,
    services: Services,
): ProcessOptions {
    const stated = typeof server === 'function' ? server(services) : server;
    const spec = stated instanceof ProcessHandle ? stated.spec : stated;
    if (typeof spec.env !== 'function') {
        return spec;
    }
    return { ...spec, env: spec.env(services) };
}

export type WebsiteConfig = Pick<ResultConfig, 'transform'> &
    StubsConfig & {
        baseUrl?: string | undefined;
        /** Launched by the first `.visit()`: `.fetch()`-only files never pay for a browser. */
        browser?: (() => Promise<BrowserPort>) | undefined;
        external?: 'allow' | 'block' | undefined;
    };

/** The stub backend: started before the server, its URL injected under `env`. */
export type WebsiteBackendOptions = {
    /** Env var receiving the stub's URL in the server child (e.g. `'API_URL'`). */
    env: string;
    /** Fixed port — pins a stable stub URL across runs. Default: a free OS-assigned port. */
    port?: number;
};

/** `server` and `url` are exclusive by type; `backend` requires `server`. */
export type WebsiteSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** Default `'block'` with a local `server`, `'allow'` with a deployed `url`. */
    external?: 'allow' | 'block';
    /** Project-root override (`no-redundant-root`): the working directory of the `server` command. */
    root?: string;
    /** Services started before the site; `server` may be a function of them. */
    services?: Services;
    /** Normaliser applied to every compared reading (`no-transform-duplicating-tokens`); prefer `{{token}}` placeholders. */
    transform?: ((text: string) => string) | undefined;
} & (
    | {
          /** Stub backend, started before the server; its URL injected under `backend.env`. */
          backend?: WebsiteBackendOptions;
          /** Start the site locally: a `process()`, or a function of the started services returning one. */
          server: ServerSpec<Services>;
          url?: never;
      }
    | {
          backend?: never;
          server?: never;
          /** Target an already-running site (a deployed or preview URL). */
          url: string;
      }
);

type SiteContext<Services extends ServiceRecord> = {
    backend: null | StubBackend;
    backendUrl: string | undefined;
    root: string;
    services: Services;
    started: null | StartedServices;
};

/** A record that fails to come up must not orphan the stub started before it. */
async function startDeclared(
    services: ServiceRecord,
    root: string,
    backend: null | StubBackend,
    subject: AppInfo,
): Promise<null | StartedServices> {
    if (Object.keys(services).length === 0) {
        return null;
    }
    try {
        return await startServices(services, root, subject);
    } catch (error) {
        await backend?.stop();
        throw error;
    }
}

/** A server that never came up must not orphan the stub nor its services. */
async function startSite<Services extends ServiceRecord>(
    options: WebsiteSpecificationOptions<Services>,
    context: SiteContext<Services>,
): Promise<{ baseUrl: string; serve: null | ServedProcess }> {
    if (!options.server) {
        return { baseUrl: (options.url ?? '').replace(/\/$/u, ''), serve: null };
    }
    const serve = new ServedProcess(
        resolveServer(options.server, context.services),
        context.root,
        'website',
        {
            // One id per run, minted by the facet, never sampled by a spec (`no-sampled-value-in-expectation`).
            TEST_RUN_ID: context.started?.runId ?? randomUUID(),
            ...serverBackendEnv(options.backend, context.backendUrl),
        },
    );
    try {
        return { baseUrl: await serve.start(), serve };
    } catch (error) {
        await context.started?.stopProcesses();
        await context.started?.orchestrator.stop();
        await context.backend?.stop();
        throw error;
    }
}

function serverBackendEnv(
    backend: undefined | WebsiteBackendOptions,
    backendUrl: string | undefined,
): Record<string, string> {
    return backend && backendUrl !== undefined ? { [backend.env]: backendUrl } : {};
}

function servicesOf<Services extends ServiceRecord>(
    options: WebsiteSpecificationOptions<Services>,
): Services {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the empty record stands for an absent one, and every facet states the default the same way
    return (options.services ?? {}) as Services;
}

/** What `specification.website()` returns: `const { website, cleanup } = …` (`no-runner-alias`). */
export type WebsiteHandle = {
    /** Stop the server process and the shared browser instance. */
    cleanup: () => Promise<void>;
    /** The base URL the specs run against. */
    url: string;
    website: WebsiteSpecification;
};

export async function startWebsite<Services extends ServiceRecord>(
    options: WebsiteSpecificationOptions<Services>,
): Promise<WebsiteHandle> {
    const callerDir = getCallerDir();
    await registerMatchers();

    // The type already forbids it; this covers untyped callers.
    if (options.backend && !options.server) {
        throw new Error(
            refusal({
                fix: 'start the site with `server`, or drop `backend`',
                found: 'specification.website({ url, backend }), a backend beside a deployed url',
                read: 'docs/08-website.md#options',
                why: '`backend` requires `server` mode: a deployed `url` cannot be pointed at a local stub.',
            }),
        );
    }

    if (!options.server && (options.url ?? '').trim() === '') {
        throw new Error(
            refusal({
                fix: 'pass the absolute URL of the site as `url`, or start it with `server`',
                found: `specification.website({ url: ${JSON.stringify(options.url)} }), no site to specify`,
                read: 'docs/08-website.md#options',
                why: 'A website spec names the site it drives: a deployed `url`, or a `server` it starts.',
            }),
        );
    }

    // Started before the server, so the child finds its URL from the first request.
    let backend: null | StubBackend = null;
    let backendUrl: string | undefined;
    if (options.backend) {
        backend = new StubBackend({ port: options.backend.port });
        backendUrl = await backend.start();
    }

    const services = servicesOf(options);
    const root = resolveRoot(options.root, callerDir);
    const subject: AppInfo = options.server
        ? { command: commandOf(options.server), type: 'process' }
        : { type: 'http', url: options.url };
    const started = await startDeclared(services, root, backend, subject);
    const { baseUrl, serve } = await startSite(options, {
        backend,
        backendUrl,
        root,
        services,
        started,
    });

    // Launched lazily on the first `.visit()`; playwright is an optional peer (the layer map).
    let browser: BrowserPort | null = null;
    const getBrowser = async (): Promise<BrowserPort> => {
        if (!browser) {
            const { PlaywrightAdapter } = await import('./browser/playwright.adapter.js');
            browser = new PlaywrightAdapter();
        }
        return browser;
    };

    const config: Started<WebsiteConfig, 'browser'> = {
        backend: backend ?? undefined,
        backendUrl,
        baseUrl,
        browser: getBrowser,
        external: options.external ?? (options.server ? 'block' : 'allow'),
        transform: options.transform,
    };

    return {
        cleanup: async () => {
            if (browser) {
                await browser.close();
                browser = null;
            }
            if (serve) {
                await serve.stop();
            }
            if (started) {
                await started.stopProcesses();
                await releaseIsolation(services);
                await started.orchestrator.stop();
            }
            if (backend) {
                await backend.stop();
            }
        },
        url: baseUrl,
        website: websiteFacet.open(config),
    };
}
