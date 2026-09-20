import { randomUUID } from 'node:crypto';

import type { SpecificationConfig } from '../../model/chain/builder.js';
import { getCallerDir } from '../../model/chain/caller.js';
import { ProcessHandle } from '../../model/chain/process.js';
import type { AppInfo } from '../../model/chain/reporter.js';
import { resolveRoot } from '../../model/chain/resolve.js';
import type { ServiceRecord, StartedServices } from '../../model/chain/services.js';
import { releaseIsolation, startServices } from '../../model/chain/services.js';
import { StubBackend } from '../../model/chain/stub-backend.js';
import { registerMatchers } from '../../model/goldens/matchers.js';
import type { BrowserPort } from '../../model/ports/browser.port.js';
import { ServeAdapter } from '../../seams/process/serve.adapter.js';
import type { ProcessOptions } from '../../seams/process/serve.adapter.js';
import { createWebsiteFacet } from './website.chain.js';
import type { WebsiteSpecification } from './website.chain.js';

/**
 * The command a `server` states, where it states one.
 *
 * A factory is a function of services that have not started yet, so calling it
 * to read a command would start the world twice. The SHAPE is known either
 * way, and the shape is the part the startup report was getting wrong.
 */
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

/**
 * The declared shape, whichever of the three forms stated it — with an `env`
 * function resolved against the services that are already up, so the site is
 * handed the URL of the API it was started beside.
 */
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

// ── Types ──

/**
 * The declared stub backend behind the site under test — started before the
 * server command, torn down with the runner. Its URL is injected into the
 * server child's environment under `env`; the contracts each chain declares
 * via `.intercept(...)` are what it serves.
 */
export type WebsiteBackendOptions = {
    /** Env var receiving the stub's URL in the server child (e.g. `'API_URL'`). */
    env: string;
    /** Fixed port — pins a stable stub URL across runs. Default: a free OS-assigned port. */
    port?: number;
};

/**
 * Options for {@link startWebsite | specification.website}. `server` (start
 * the site locally) and `url` (target a running site) are mutually
 * exclusive BY TYPE — the union makes the invalid combinations
 * inexpressible rather than runtime-checked. `backend` requires `server`
 * mode for the same reason: a deployed site cannot be pointed at a local
 * stub.
 */
export type WebsiteSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /**
     * Cross-origin request policy for visits. Default: `'block'` with a
     * local `server` (deterministic — analytics and CDNs never leave the
     * machine), `'allow'` with a deployed `url`.
     */
    external?: 'allow' | 'block';
    /**
     * Project-root override (CONVENTIONS A9): the working directory of the
     * `server` command. Auto-discovered from the calling file when absent.
     */
    root?: string;
    /**
     * Named services started with the runner, before the site is: a database
     * the site reads, a `process()` backend it calls. They are started in
     * declaration order and stopped with the specification, and `server` may
     * be a function of them — which is how a site is handed the URL of the
     * API it was started beside.
     */
    services?: Services;
} & (
    | {
          /**
           * Declared stub backend: started BEFORE the server command, its
           * URL injected into the child env under `backend.env`. Serves the
           * contracts each chain declares via `.intercept(...)`.
           */
          backend?: WebsiteBackendOptions;
          /**
           * Start the site locally: a `process()` — a shell command receiving
           * a free port as `PORT`, polled on `ready` (default `/`) until it
           * answers — or a function of the started services returning one.
           */
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

/** What the site is started with, once everything before it is up. */
type SiteContext<Services extends ServiceRecord> = {
    backend: null | StubBackend;
    backendUrl: string | undefined;
    root: string;
    services: Services;
    started: null | StartedServices;
};

/**
 * Start the declared record, if there is one. A record that fails to come up
 * must not orphan the stub that was started before it.
 */
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

/**
 * Start the site, or take the URL of a deployed one. A server that never came
 * up must not orphan the stub, nor the services it was started beside.
 */
async function startSite<Services extends ServiceRecord>(
    options: WebsiteSpecificationOptions<Services>,
    context: SiteContext<Services>,
): Promise<{ baseUrl: string; serve: null | ServeAdapter }> {
    if (!options.server) {
        return { baseUrl: (options.url ?? '').replace(/\/$/u, ''), serve: null };
    }
    const serve = new ServeAdapter(
        resolveServer(options.server, context.services),
        context.root,
        'website',
        {
            // Every process of one run carries the same id, minted by the
            // Facet — never sampled by a spec (CONVENTIONS D16, P7).
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

/** The stub's URL in the child's environment, under the name the caller chose. */
function serverBackendEnv(
    backend: undefined | WebsiteBackendOptions,
    backendUrl: string | undefined,
): Record<string, string> {
    return backend && backendUrl !== undefined ? { [backend.env]: backendUrl } : {};
}

/** The declared record, or the empty one — a website may have no services. */
function servicesOf<Services extends ServiceRecord>(
    options: WebsiteSpecificationOptions<Services>,
): Services {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the empty record stands for an absent one, and every facet states the default the same way
    return (options.services ?? {}) as Services;
}

/**
 * The record returned by {@link startWebsite | specification.website}.
 * Destructure with the canonical names (CONVENTIONS A3):
 *
 *     const { website, cleanup } = await specification.website(…);
 */
export type WebsiteHandle = {
    /** Stop the server process and the shared browser instance. */
    cleanup: () => Promise<void>;
    /** The base URL the specs run against. */
    url: string;
    website: WebsiteSpecification;
};

// ── Constructor ──

export async function startWebsite<Services extends ServiceRecord>(
    options: WebsiteSpecificationOptions<Services>,
): Promise<WebsiteHandle> {
    // Caller detection must run before any await — async resumption drops
    // The calling file's frames from the stack.
    const callerDir = getCallerDir();
    await registerMatchers();

    // The type already forbids `backend` with `url`; the runtime check covers
    // Untyped callers with the same sentence.
    if (options.backend && !options.server) {
        throw new Error(
            'specification.website(): `backend` requires `server` mode — a deployed `url` cannot be pointed at a local stub.',
        );
    }

    // The stub starts BEFORE the server command, so the child finds its URL
    // In the environment from the very first request it makes.
    let backend: null | StubBackend = null;
    let backendUrl: string | undefined;
    if (options.backend) {
        backend = new StubBackend({ port: options.backend.port });
        backendUrl = await backend.start();
    }

    const services = servicesOf(options);
    const root = resolveRoot(options.root, callerDir);
    // The site is a child process the runner starts and polls, or a
    // Deployment already running; it is never an app inside this process,
    // Which is what the report used to say of it.
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

    // One browser per runner, launched lazily on the first `.visit()` so
    // `.fetch()`-only spec files never pay the browser cost. The playwright
    // Integration stays a lazy import (CONVENTIONS I1) — the dependency is
    // Optional and only loaded when a spec actually renders a page.
    let browser: BrowserPort | null = null;
    const getBrowser = async (): Promise<BrowserPort> => {
        if (!browser) {
            const { PlaywrightAdapter } =
                await import('../../seams/playwright/playwright.adapter.js');
            browser = new PlaywrightAdapter();
        }
        return browser;
    };

    const config: SpecificationConfig = {
        backend: backend ?? undefined,
        backendUrl,
        baseUrl,
        browser: getBrowser,
        external: options.external ?? (options.server ? 'block' : 'allow'),
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
        website: createWebsiteFacet(config),
    };
}
