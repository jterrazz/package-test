import type { Browser, BrowserContext, BrowserType, Page } from 'playwright';

import { evidenceFile } from '../../../../lint/kit/project/artifacts.js';
import { refusal } from '../../../chain/refusals/refusal.js';
import { scenarioFailure } from '../../../chain/refusals/scenario-failure.js';
import type {
    BrowserConsoleMessage,
    BrowserOpenOptions,
    BrowserPage,
    BrowserPort,
} from './browser.port.js';
import { extractPage, seedStorage } from './page-scripts.js';
import { createSharedBrowser } from './shared-browser.js';
import { createVisitor } from './website-visitor.js';

// outside: the headless shell, named so the lighter binary is used whatever playwright's default becomes.
const LAUNCH_OPTIONS = { channel: 'chromium-headless-shell', headless: true } as const;

async function launchChromium(): Promise<Browser> {
    let chromium: BrowserType;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        throw new Error(
            refusal('seam-is-an-optional-peer', {
                fix: 'npm install -D playwright && npx playwright install chromium',
                found: '.visit() requires `playwright`, and it is not installed',
            }),
        );
    }
    return await chromium.launch(LAUNCH_OPTIONS);
}

/** invariant: with `'block'`, requests leaving the site are aborted; the stub backend stays reachable through `allowedOrigins`. */
async function blockExternal(
    context: BrowserContext,
    options: BrowserOpenOptions,
): Promise<Set<string>> {
    const aborted = new Set<string>();
    if (options.external !== 'block') {
        return aborted;
    }
    const allowed = new Set(
        [options.baseUrl, ...(options.allowedOrigins ?? [])].map((at) => new URL(at).origin),
    );
    await context.route('**/*', (route) => {
        const url = route.request().url();
        if (allowed.has(new URL(url).origin)) {
            void route.continue();
        } else {
            aborted.add(url);
            void route.abort();
        }
    });

    return aborted;
}

function recordConsole(page: Page, aborted: ReadonlySet<string>): BrowserConsoleMessage[] {
    const consoleMessages: BrowserConsoleMessage[] = [];
    page.on('console', (message) => {
        // invariant: a request the runner aborted by its `external: 'block'` policy is the runner's own doing, and the browser's console error for it is no error of the site.
        if (message.type() === 'error' && aborted.has(message.location().url)) {
            return;
        }
        consoleMessages.push({ text: message.text(), type: message.type() });
    });
    // invariant: an uncaught exception is an error of the visit, spelled as the browser's `ErrorEvent` spells it.
    page.on('pageerror', (error) => {
        consoleMessages.push({ text: `Uncaught ${error.name}: ${error.message}`, type: 'error' });
    });
    return consoleMessages;
}

// invariant: kept until the worker exits: playwright ends the browsers it launched with the process.
const workerBrowsers = new Map<() => Promise<Browser>, () => Promise<Browser>>();

function workerBrowser(launch: () => Promise<Browser>): () => Promise<Browser> {
    let shared = workerBrowsers.get(launch);
    if (shared === undefined) {
        shared = createSharedBrowser(launch);
        workerBrowsers.set(launch, shared);
    }
    return shared;
}

/** One browser per worker, launched lazily; each visit gets a fresh `BrowserContext`. */
export class PlaywrightAdapter implements BrowserPort {
    private readonly browser: () => Promise<Browser>;
    private readonly contexts = new Set<BrowserContext>();

    constructor(options: { launch?: () => Promise<Browser> } = {}) {
        this.browser = workerBrowser(options.launch ?? launchChromium);
    }

    async close(): Promise<void> {
        const open = [...this.contexts];
        this.contexts.clear();
        await Promise.all(
            open.map(async (context) => {
                await context.close();
            }),
        );
    }

    async open(url: string, options: BrowserOpenOptions): Promise<BrowserPage> {
        const browser = await this.browser();
        const context = await browser.newContext({
            extraHTTPHeaders: options.headers ?? {},
        });
        this.contexts.add(context);
        try {
            const aborted = await blockExternal(context, options);
            if (options.storage !== undefined) {
                await context.addInitScript(seedStorage, options.storage);
            }
            const page = await context.newPage();
            // invariant: pinned before the first byte: a script reading `Date.now()` on load must see the stated instant.
            if (options.clock !== undefined) {
                await page.clock.setFixedTime(new Date(options.clock));
            }
            const consoleMessages = recordConsole(page, aborted);
            const response = await page.goto(url, { waitUntil: 'load' });

            if (options.scenario) {
                try {
                    await options.scenario(createVisitor(page, options.baseUrl));
                } catch (error) {
                    const evidence = await this.captureEvidence(page);
                    throw scenarioFailure(error, evidence, 'visit');
                }
            }

            const extraction = await page.evaluate(extractPage);
            // invariant: the same Playwright method the component specification's command calls: one dialect for both trees.
            const tree = await page.locator('body').ariaSnapshot();

            return {
                consoleMessages,
                status: response?.status() ?? 0,
                tree,
                url: page.url(),
                ...extraction,
            };
        } finally {
            this.contexts.delete(context);
            await context.close();
        }
    }

    /** Screenshot the failing state into the evidence folder; never masks the original error. */
    private async captureEvidence(page: Page): Promise<null | string> {
        try {
            const path = evidenceFile('website');
            await page.screenshot({ fullPage: true, path });
            return path;
        } catch {
            return null;
        }
    }
}
