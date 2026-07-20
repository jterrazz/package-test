import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { Browser, BrowserType, Locator, Page } from 'playwright';

import type {
    BrowserConsoleMessage,
    BrowserLinkElement,
    BrowserMetaElement,
    BrowserOpenOptions,
    BrowserPage,
    BrowserPort,
    ElementRef,
    Visitor,
} from '../../core/ports/browser.port.js';

/** The head/body extraction evaluated in-page — the browser IS the parser. */
interface PageExtraction {
    html: string;
    jsonLdBlocks: string[];
    links: BrowserLinkElement[];
    metas: BrowserMetaElement[];
    text: string;
    title: string;
}

/** Translate a user-facing element descriptor into a playwright locator. */
function locate(page: Page, element: ElementRef): Locator {
    switch (element.kind) {
        case 'button': {
            return page.getByRole('button', { name: element.name });
        }
        case 'field': {
            return page.getByLabel(element.name);
        }
        case 'heading': {
            return page.getByRole('heading', { name: element.name });
        }
        case 'link': {
            return page.getByRole('link', { name: element.name });
        }
        case 'testId': {
            return page.getByTestId(element.name);
        }
        case 'text': {
            return page.getByText(element.name);
        }
    }
}

/** The visitor implementation — every action auto-waits via playwright actionability. */
function createVisitor(page: Page, baseUrl: string): Visitor {
    return {
        check: (element) => locate(page, element).first().check(),
        click: (element) => locate(page, element).first().click(),
        fill: (element, value) => locate(page, element).first().fill(value),
        goto: async (path) => {
            await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
        },
        hover: (element) => locate(page, element).first().hover(),
        press: (key) => page.keyboard.press(key),
        see: (element) => locate(page, element).first().waitFor({ state: 'visible' }),
        select: async (element, option) => {
            await locate(page, element).first().selectOption(option);
        },
    };
}

/**
 * Browser adapter backed by playwright chromium.
 *
 * ONE browser process per adapter (= per runner = per vitest worker),
 * launched lazily on the first `open()`. Each visit gets a fresh
 * `BrowserContext` — isolation without paying a browser launch per spec.
 *
 * Playwright is an optional peer dependency: it is only imported here, and
 * this module is only loaded when a spec calls `.visit()`.
 */
export class PlaywrightAdapter implements BrowserPort {
    private browser: Browser | null = null;

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async open(url: string, options: BrowserOpenOptions): Promise<BrowserPage> {
        const browser = await this.launch();
        const context = await browser.newContext({
            extraHTTPHeaders: options.headers,
        });

        // Cross-origin policy: with 'block', any request leaving the site
        // Under test is aborted — analytics and CDNs never make the visit
        // Non-deterministic (the browser-side analog of strict intercepts).
        if (options.external === 'block') {
            const origin = new URL(options.baseUrl).origin;
            await context.route('**/*', (route) => {
                if (new URL(route.request().url()).origin === origin) {
                    void route.continue();
                } else {
                    void route.abort();
                }
            });
        }

        try {
            const page = await context.newPage();
            const consoleMessages: BrowserConsoleMessage[] = [];
            page.on('console', (message) => {
                consoleMessages.push({ text: message.text(), type: message.type() });
            });

            const response = await page.goto(url, { waitUntil: 'load' });

            if (options.scenario) {
                try {
                    await options.scenario(createVisitor(page, options.baseUrl));
                } catch (error) {
                    // Evidence on failure: a screenshot of the state the
                    // Scenario died in, referenced from the error itself.
                    const evidence = await this.captureEvidence(page);
                    throw new Error(
                        `visit scenario failed: ${error instanceof Error ? error.message : String(error)}${evidence ? `\nEvidence: ${evidence}` : ''}`,
                        { cause: error },
                    );
                }
            }

            const extraction = await page.evaluate((): PageExtraction => {
                const links = [...document.querySelectorAll('link')].map((link) => ({
                    href: link.href,
                    hreflang: link.hreflang || undefined,
                    rel: link.rel,
                    type: link.type || undefined,
                }));
                const metas = [...document.querySelectorAll('meta')].map((meta) => ({
                    content: meta.content,
                    name: meta.name || undefined,
                    property: meta.getAttribute('property') ?? undefined,
                }));
                const jsonLdBlocks = [
                    ...document.querySelectorAll('script[type="application/ld+json"]'),
                ].map((script) => script.textContent ?? '');
                return {
                    html: document.documentElement.outerHTML,
                    jsonLdBlocks,
                    links,
                    metas,
                    // eslint-disable-next-line unicorn/prefer-dom-node-text-content -- rendered text is the point; textContent would leak script bodies
                    text: document.body?.innerText ?? '',
                    title: document.title,
                };
            });

            return {
                consoleMessages,
                status: response?.status() ?? 0,
                url: page.url(),
                ...extraction,
            };
        } finally {
            await context.close();
        }
    }

    /** Screenshot the failing state into a temp file; never masks the original error. */
    private async captureEvidence(page: Page): Promise<null | string> {
        try {
            const dir = mkdtempSync(resolve(tmpdir(), 'spec-website-'));
            const path = resolve(dir, 'failure.png');
            await page.screenshot({ fullPage: true, path });
            return path;
        } catch {
            return null;
        }
    }

    /** Launch the shared chromium instance (once), with an actionable error when playwright is absent. */
    private async launch(): Promise<Browser> {
        if (this.browser) {
            return this.browser;
        }
        let chromium: BrowserType;
        try {
            ({ chromium } = await import('playwright'));
        } catch {
            throw new Error(
                '.visit() requires playwright (optional peer dependency): npm install -D playwright && npx playwright install chromium',
            );
        }
        this.browser = await chromium.launch();
        return this.browser;
    }
}
