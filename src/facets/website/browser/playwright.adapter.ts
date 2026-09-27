import { mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Browser, BrowserContext, BrowserType, Locator, Page } from 'playwright';

import { missingParts } from '../../../../lint/engine/catalogue/lesson-parts.js';
import { evidenceDirectory } from '../../../../lint/engine/project/artifacts.js';
import { refusal } from '../../../../lint/index.refusal.js';
import { AmbiguousElementError, describeAmbiguity } from '../../../elements/ambiguity/ambiguity.js';
import { CANDIDATE_LIMITS, candidatesOf } from '../../../elements/ambiguity/candidate.js';
import { asWritten } from '../../../elements/descriptors/as-written.js';
import type { ElementRef } from '../../../elements/descriptors/element.js';
import { scopeChain } from '../../../elements/descriptors/scope-chain.js';
import type {
    BrowserConsoleMessage,
    BrowserLinkElement,
    BrowserMetaElement,
    BrowserOpenOptions,
    BrowserPage,
    BrowserPort,
    Visitor,
} from './browser.port.js';

type MatchScope = Locator | Page;

type PageExtraction = {
    html: string;
    jsonLdBlocks: string[];
    links: BrowserLinkElement[];
    metas: BrowserMetaElement[];
    text: string;
    title: string;
};

/* Playwright's actionability default, so `see(valued(…))` waits as long as `see()`. */
const VALUE_TIMEOUT_MS = 30_000;
const VALUE_POLL_MS = 100;

/** By accessible name, not the wrapping label's text, which carries every option of a select. The label locator stays for controls ARIA gives no role (date, colour). */
const FIELD_ROLES = [
    'checkbox',
    'combobox',
    'radio',
    'searchbox',
    'slider',
    'spinbutton',
    'switch',
    'textbox',
] as const;

/** No `.first()`: playwright's strict mode is the mechanism behind `descriptor-matches-one-element`. */
function locate(root: MatchScope, element: ElementRef): Locator {
    const scope: MatchScope = element.scope ? locate(root, element.scope) : root;
    // `exact` is the framework's default, not playwright's.
    const exact = element.exact ?? true;
    const name = element.name ?? '';
    if (element.kind === 'field') {
        let field = scope.getByLabel(name, { exact });
        for (const role of FIELD_ROLES) {
            field = field.or(scope.getByRole(role, { exact, name }));
        }
        return field;
    }
    if (element.kind === 'testId') {
        return scope.getByTestId(name);
    }
    if (element.kind === 'text') {
        return scope.getByText(name, { exact });
    }
    // Every other kind is an ARIA role named after itself: one branch answers for all.
    return scope.getByRole(
        element.kind,
        element.name === undefined ? { exact } : { exact, name: element.name },
    );
}

/** Playwright signals "more than one match" through this error text. */
function isStrictViolation(error: unknown): boolean {
    return error instanceof Error && error.message.includes('strict mode violation');
}

/** The ambiguous level is found first: a scope matching several landmarks is the real fault. */
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
        const matches = await locate(page, culprit).evaluateAll(candidatesOf, CANDIDATE_LIMITS);
        throw new AmbiguousElementError(
            describeAmbiguity({ element: culprit, matches, url: page.url() }),
        );
    }
}

async function findAmbiguousLevel(page: Page, element: ElementRef): Promise<ElementRef> {
    for (const level of scopeChain(element).slice(0, -1)) {
        if ((await locate(page, level).count()) > 1) {
            return level;
        }
    }
    return element;
}

/** A second locator condition keeps playwright's retry; `toBeFocused()` lives in `@playwright/test`, which this package does not carry. */
function stateOnly(page: Page, locator: Locator, element: ElementRef): Locator | null {
    if (element.focused === true) {
        return locator.and(page.locator(':focus'));
    }
    if (element.disabled !== undefined) {
        return locator.and(page.locator(element.disabled ? ':disabled' : ':enabled'));
    }
    if (element.selected !== undefined) {
        return locator.and(page.locator(element.selected ? ':checked' : ':not(:checked)'));
    }
    return null;
}

/** A collapsed select's options have no box until opened. */
function byPresence(element: ElementRef): boolean {
    return element.kind === 'option';
}

async function currentValue(locator: Locator): Promise<null | string> {
    try {
        return await locator.inputValue({ timeout: VALUE_POLL_MS });
    } catch (error) {
        // A strict-mode violation is `act()`'s `descriptor-matches-one-element` refusal; anything else means the field is not there yet.
        if (isStrictViolation(error)) {
            throw error;
        }
        return null;
    }
}

/** A poll: a value is a property, and a locator's CSS reads the attribute, which a controlled input never moves. */
async function waitForValue(locator: Locator, element: ElementRef, wanted: boolean): Promise<void> {
    const value = element.value ?? '';
    const deadline = Date.now() + VALUE_TIMEOUT_MS;
    for (;;) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- a poll asks, waits, asks again: the rounds are sequential by definition and there is nothing to run in parallel
        const actual = await currentValue(locator);
        if (actual === null ? !wanted : (actual === value) === wanted) {
            return;
        }
        if (Date.now() >= deadline) {
            throw new Error(
                refusal({
                    fix: 'correct the value the scenario states, or what the page puts in the field',
                    found: `${asWritten(element)} ${wanted ? 'never held' : 'still holds'} ${JSON.stringify(value)}${actual === null ? ' (it is not on the page)' : `, it holds ${JSON.stringify(actual)}`}`,
                    read: 'docs/13-elements.md#see-and-gone-are-the-synchronization',
                    why: 'A verb waits for what it states to hold, within its budget, and never sleeps.',
                }),
            );
        }
        // oxlint-disable-next-line eslint/no-await-in-loop -- same round: the wait between two looks is what a poll IS
        await sleep(VALUE_POLL_MS);
    }
}

function createVisitor(page: Page, baseUrl: string): Visitor {
    return {
        check: async (element) => {
            await act(page, element, async (locator) => {
                await locator.check();
            });
        },
        click: async (element) => {
            await act(page, element, async (locator) => {
                await locator.click();
            });
        },
        fill: async (element, value) => {
            await act(page, element, async (locator) => {
                await locator.fill(value);
            });
        },
        goto: async (path) => {
            await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
        },
        hover: async (element) => {
            await act(page, element, async (locator) => {
                await locator.hover();
            });
        },
        press: async (key) => {
            await page.keyboard.press(key);
        },
        gone: async (element) => {
            await act(page, element, async (locator) => {
                if (element.value !== undefined) {
                    await waitForValue(locator, element, false);
                    return;
                }
                const narrowed = stateOnly(page, locator, element);
                if (narrowed !== null) {
                    await narrowed.waitFor({ state: 'detached' });
                    return;
                }
                await locator.waitFor({ state: byPresence(element) ? 'detached' : 'hidden' });
            });
        },
        see: async (element) => {
            await act(page, element, async (locator) => {
                if (element.value !== undefined) {
                    await waitForValue(locator, element, true);
                    return;
                }
                const narrowed = stateOnly(page, locator, element);
                if (narrowed !== null) {
                    await narrowed.waitFor({ state: 'attached' });
                    return;
                }
                await locator.waitFor({ state: byPresence(element) ? 'attached' : 'visible' });
            });
        },
        select: async (element, option) => {
            await act(page, element, async (locator) => await locator.selectOption(option));
        },
    };
}

/** The headless shell, named so the lighter binary is used whatever playwright's default becomes. */
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

type Disconnectable = { on: (event: 'disconnected', listener: () => void) => unknown };

/** Launched on the first ask, again once disconnected; a failed launch is not kept. */
export function createSharedBrowser<T extends Disconnectable>(
    launch: () => Promise<T>,
): () => Promise<T> {
    let shared: Promise<T> | undefined;
    const attempt = async (): Promise<T> => {
        try {
            const browser = await launch();
            browser.on('disconnected', () => {
                shared = undefined;
            });
            return browser;
        } catch (error) {
            shared = undefined;
            throw error;
        }
    };
    return async () => {
        shared ??= attempt();
        return await shared;
    };
}

/** Kept until the worker exits: playwright ends the browsers it launched with the process. */
const workerBrowsers = new Map<() => Promise<Browser>, () => Promise<Browser>>();

function workerBrowser(launch: () => Promise<Browser>): () => Promise<Browser> {
    let shared = workerBrowsers.get(launch);
    if (shared === undefined) {
        shared = createSharedBrowser(launch);
        workerBrowsers.set(launch, shared);
    }
    return shared;
}

function scenarioFailure(error: unknown, suffix: string): Error {
    if (error instanceof Error && missingParts(error.message).length === 0) {
        error.message += suffix;
        return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return new Error(
        refusal({
            fix: 'correct the step that failed, or the page it drives',
            found: `the visit scenario failed:\n  ${message.replaceAll('\n', '\n  ')}${suffix}`,
            read: 'docs/08-website.md#visit-scenarios--the-when',
            why: 'A visit scenario drives the page step by step, and the first step that fails ends it.',
        }),
        { cause: error },
    );
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

        // With `'block'`, requests leaving the site are aborted; the stub backend stays reachable through `allowedOrigins`.
        if (options.external === 'block') {
            const allowed = new Set([
                new URL(options.baseUrl).origin,
                ...(options.allowedOrigins ?? []),
            ]);
            await context.route('**/*', (route) => {
                if (allowed.has(new URL(route.request().url()).origin)) {
                    void route.continue();
                } else {
                    void route.abort();
                }
            });
        }

        try {
            const page = await context.newPage();
            // Pinned before the first byte: a script reading `Date.now()` on load must see the stated instant.
            if (options.clock !== undefined) {
                await page.clock.setFixedTime(new Date(options.clock));
            }
            const consoleMessages: BrowserConsoleMessage[] = [];
            page.on('console', (message) => {
                consoleMessages.push({ text: message.text(), type: message.type() });
            });
            // An uncaught exception is an error of the visit, spelled as the browser's `ErrorEvent` spells it.
            page.on('pageerror', (error) => {
                consoleMessages.push({
                    text: `Uncaught ${error.name}: ${error.message}`,
                    type: 'error',
                });
            });

            const response = await page.goto(url, { waitUntil: 'load' });

            if (options.scenario) {
                try {
                    await options.scenario(createVisitor(page, options.baseUrl));
                } catch (error) {
                    const evidence = await this.captureEvidence(page);
                    const suffix = evidence ? `\nEvidence: ${evidence}` : '';
                    throw scenarioFailure(error, suffix);
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
                    // oxlint-disable-next-line unicorn/prefer-dom-node-text-content -- rendered text is the point; textContent would leak script bodies
                    text: document.body?.innerText ?? '',
                    title: document.title,
                };
            });

            // The same Playwright method the component facet's command calls: one dialect for both trees.
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
            const dir = mkdtempSync(evidenceDirectory('website-'));
            const path = resolve(dir, 'failure.png');
            await page.screenshot({ fullPage: true, path });
            return path;
        } catch {
            return null;
        }
    }
}
