import { registerMatchers } from '../../../vitest/matchers.js';
import type { BrowserPort } from '../../ports/browser.port.js';
import {
    createWebsiteFacet,
    type SpecificationConfig,
    type WebsiteSpecification,
} from '../shared/builder.js';
import { getCallerDir } from '../shared/caller.js';
import { resolveRoot } from '../shared/resolve.js';
import { StubBackend } from '../shared/stub-backend.js';
import { ServeAdapter, type ServeOptions } from './serve.adapter.js';

// ── Types ──

/**
 * The declared stub backend behind the site under test — started before the
 * server command, torn down with the runner. Its URL is injected into the
 * server child's environment under `env`; the chain's
 * `.intercept('<name>.http')` exchanges are what it serves.
 */
export interface WebsiteBackendOptions {
    /** Env var receiving the stub's URL in the server child (e.g. `'API_URL'`). */
    env: string;
    /** Fixed port — pins a stable stub URL across runs. Default: a free OS-assigned port. */
    port?: number;
}

/**
 * Options for {@link startWebsite | specification.website}. `server` (start
 * the site locally) and `url` (target a running site) are mutually
 * exclusive BY TYPE — the union makes the invalid combinations
 * inexpressible rather than runtime-checked. `backend` requires `server`
 * mode for the same reason: a deployed site cannot be pointed at a local
 * stub.
 */
export type WebsiteSpecificationOptions = {
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
} & (
    | {
          /**
           * Declared stub backend: started BEFORE the server command, its
           * URL injected into the child env under `backend.env`. Serves the
           * exchanges each chain declares via `.intercept('<name>.http')`.
           */
          backend?: WebsiteBackendOptions;
          /**
           * Start the site locally: a shell command receiving a free port
           * as `PORT`, polled on `ready` (default `/`) until it answers.
           */
          server: ServeOptions;
          url?: never;
      }
    | {
          backend?: never;
          server?: never;
          /** Target an already-running site (a deployed or preview URL). */
          url: string;
      }
);

/**
 * The record returned by {@link startWebsite | specification.website}.
 * Destructure with the canonical names (CONVENTIONS A3):
 *
 *     const { website, cleanup } = await specification.website(…);
 */
export interface WebsiteHandle {
    /** Stop the server process and the shared browser instance. */
    cleanup: () => Promise<void>;
    /** The base URL the specs run against. */
    url: string;
    website: WebsiteSpecification;
}

// ── Constructor ──

export async function startWebsite(options: WebsiteSpecificationOptions): Promise<WebsiteHandle> {
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

    let serve: null | ServeAdapter = null;
    let baseUrl: string;
    if (options.server) {
        const root = resolveRoot(options.root, callerDir);
        serve = new ServeAdapter(
            options.server,
            root,
            'website',
            options.backend && backendUrl !== undefined
                ? { [options.backend.env]: backendUrl }
                : {},
        );
        try {
            baseUrl = await serve.start();
        } catch (error) {
            // A server that never came up must not orphan the stub.
            await backend?.stop();
            throw error;
        }
    } else {
        baseUrl = options.url.replace(/\/$/, '');
    }

    // One browser per runner, launched lazily on the first `.visit()` so
    // `.fetch()`-only spec files never pay the browser cost. The playwright
    // Integration stays a lazy import (CONVENTIONS I1) — the dependency is
    // Optional and only loaded when a spec actually renders a page.
    let browser: BrowserPort | null = null;
    const getBrowser = async (): Promise<BrowserPort> => {
        if (!browser) {
            const { PlaywrightAdapter } =
                await import('../../../integrations/playwright/playwright.adapter.js');
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
            if (backend) {
                await backend.stop();
            }
        },
        url: baseUrl,
        website: createWebsiteFacet(config),
    };
}
