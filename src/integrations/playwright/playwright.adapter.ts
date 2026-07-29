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
    ElementMatch,
    ElementRef,
    Visitor,
} from '../../core/ports/browser.port.js';
import {
    AmbiguousElementError,
    describeAmbiguity,
} from '../../core/specification/website/ambiguity.js';

/**
 * Anything a locator can be built from — the page root, or another locator
 * when a descriptor carries a scope. Structural, so `locate()` recurses
 * without caring which one it holds.
 */
type MatchScope = Locator | Page;

/** The head/body extraction evaluated in-page — the browser IS the parser. */
interface PageExtraction {
    html: string;
    jsonLdBlocks: string[];
    links: BrowserLinkElement[];
    metas: BrowserMetaElement[];
    text: string;
    title: string;
}

/** How many candidates the ambiguity error enumerates before truncating. */
const MAX_REPORTED_MATCHES = 10;

/**
 * Translate a user-facing descriptor into a playwright locator, resolving
 * `scope` outside-in so `within(navigation(), link('X'))` searches the nav
 * subtree. No `.first()` anywhere: playwright's strict mode is the mechanism
 * behind CONVENTIONS W3, and swallowing it would reintroduce the silent
 * wrong-element bug the rule exists to prevent.
 */
function locate(root: MatchScope, element: ElementRef): Locator {
    const scope: MatchScope = element.scope ? locate(root, element.scope) : root;
    const options = { exact: element.exact, name: element.name };
    switch (element.kind) {
        case 'banner':
        case 'complementary':
        case 'contentinfo':
        case 'form':
        case 'main':
        case 'navigation':
        case 'region':
        case 'search': {
            return scope.getByRole(element.kind, options);
        }
        case 'button':
        case 'heading':
        case 'link': {
            return scope.getByRole(element.kind, options);
        }
        case 'field': {
            return scope.getByLabel(element.name ?? '', { exact: element.exact });
        }
        case 'testId': {
            return scope.getByTestId(element.name ?? '');
        }
        case 'text': {
            return scope.getByText(element.name ?? '', { exact: element.exact });
        }
    }
}

/** Playwright signals "more than one match" through this error text. */
function isStrictViolation(error: unknown): boolean {
    return error instanceof Error && error.message.includes('strict mode violation');
}

/** Capture the candidates in-page — the evidence the refusal enumerates. */
async function captureMatches(locator: Locator): Promise<ElementMatch[]> {
    return locator.evaluateAll((nodes, limit) => {
        const LANDMARKS = 'nav, header, footer, main, aside, section, form, [role]';
        return nodes.slice(0, limit).map((node) => {
            const element = node as HTMLElement;
            const landmark = element.parentElement?.closest(LANDMARKS);
            const context = landmark
                ? (landmark.getAttribute('role') ?? landmark.tagName.toLowerCase())
                : null;
            const detail = element.getAttribute('href') ?? element.getAttribute('name');
            return {
                context: context ?? undefined,
                detail: detail ?? undefined,
                tag: element.tagName.toLowerCase(),
                text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
            };
        });
    }, MAX_REPORTED_MATCHES);
}

/**
 * Run one visitor action, converting a strict-mode violation into the W3
 * refusal. The ambiguous level is identified before reporting: a scope that
 * matches several landmarks is the real fault, and naming the target instead
 * would send the author to fix the wrong descriptor.
 */
async function act<T>(
    page: Page,
    element: ElementRef,
    action: (locator: Locator) => Promise<T>,
): Promise<T> {
    try {
        return await action(locate(page, element));
    } catch (error) {
        if (!isStrictViolation(error)) {
            throw error;
        }
        const culprit = await findAmbiguousLevel(page, element);
        const matches = await captureMatches(locate(page, culprit));
        throw new AmbiguousElementError(
            describeAmbiguity({ element: culprit, matches, url: page.url() }),
        );
    }
}

/** Walk the scope chain outside-in; the outermost ambiguous level is the fault. */
async function findAmbiguousLevel(page: Page, element: ElementRef): Promise<ElementRef> {
    const chain: ElementRef[] = [];
    for (let current: ElementRef | undefined = element; current; current = current.scope) {
        chain.unshift(current);
    }
    for (const level of chain.slice(0, -1)) {
        if ((await locate(page, level).count()) > 1) {
            return level;
        }
    }
    return element;
}

/** The visitor implementation — every action auto-waits via playwright actionability. */
function createVisitor(page: Page, baseUrl: string): Visitor {
    return {
        check: (element) => act(page, element, (locator) => locator.check()),
        click: (element) => act(page, element, (locator) => locator.click()),
        fill: (element, value) => act(page, element, (locator) => locator.fill(value)),
        goto: async (path) => {
            await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
        },
        hover: (element) => act(page, element, (locator) => locator.hover()),
        press: (key) => page.keyboard.press(key),
        see: (element) => act(page, element, (locator) => locator.waitFor({ state: 'visible' })),
        select: async (element, option) => {
            await act(page, element, (locator) => locator.selectOption(option));
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
                    const suffix = evidence ? `\nEvidence: ${evidence}` : '';
                    // A W3 refusal is already a complete, self-explaining
                    // Message — re-wrapping it would print the whole thing
                    // Twice (once inline, once as the cause).
                    if (error instanceof AmbiguousElementError) {
                        error.message += suffix;
                        throw error;
                    }
                    throw new Error(
                        `visit scenario failed: ${error instanceof Error ? error.message : String(error)}${suffix}`,
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
