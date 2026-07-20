import { registerMatchers } from '../../../vitest/matchers.js';
import type { BrowserPort } from '../../ports/browser.port.js';
import {
    createWebsiteFacet,
    type SpecificationConfig,
    type WebsiteSpecification,
} from '../shared/builder.js';
import { getCallerDir } from '../shared/caller.js';
import { resolveRoot } from '../shared/resolve.js';
import { ServeAdapter, type ServeOptions } from './serve.adapter.js';

// ── Types ──

/** Options for {@link startWebsite | specification.website}. */
export interface WebsiteSpecificationOptions {
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
     * Start the site locally: a shell command receiving a free port as
     * `PORT`, polled on `ready` (default `/`) until it answers HTTP.
     * Exactly one of `server` / `url` is required.
     */
    server?: ServeOptions;
    /**
     * Target an already-running site (a deployed URL, a preview URL, a dev
     * server). Exactly one of `server` / `url` is required.
     */
    url?: string;
}

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

    if (Boolean(options.server) === Boolean(options.url)) {
        throw new Error(
            'specification.website(): exactly one of `server` (start the site locally) or `url` (target a running site) is required',
        );
    }

    let serve: null | ServeAdapter = null;
    let baseUrl: string;
    if (options.server) {
        const root = resolveRoot(options.root, callerDir);
        serve = new ServeAdapter(options.server, root);
        baseUrl = await serve.start();
    } else {
        baseUrl = options.url!.replace(/\/$/, '');
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
        },
        url: baseUrl,
        website: createWebsiteFacet(config),
    };
}
