import { mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Browser, BrowserContext, BrowserType, Locator, Page } from 'playwright';

import { evidenceDirectory } from '../../../../lint/kit/project/artifacts.js';
import { refusal } from '../../../chain/refusals/refusal.js';
import { scenarioFailure } from '../../../chain/refusals/scenario-failure.js';
import { ambiguousTargetError } from '../../../visitor/matching/ambiguous.js';
import { CANDIDATE_LIMITS, candidatesOf } from '../../../visitor/matching/candidates.js';
import { asWritten } from '../../../visitor/targets/as-written.js';
import { scopeChain } from '../../../visitor/targets/landmarks.js';
import type { Target } from '../../../visitor/targets/target.js';
import type {
    BrowserConsoleMessage,
    BrowserLinkElement,
    BrowserMetaElement,
    BrowserOpenOptions,
    BrowserPage,
    BrowserPort,
    WebsiteVisitor,
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

/* invariant: Playwright's actionability default, so `see(valued(…))` waits as long as `see()`. */
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

/** No `.first()`: playwright's strict mode is the mechanism behind `target-matches-one-element`. */
function locate(root: MatchScope, target: Target): Locator {
    const scope: MatchScope = target.scope ? locate(root, target.scope) : root;
    // invariant: `exact` is the framework's default, not playwright's.
    const exact = target.exact ?? true;
    const name = target.name ?? '';
    if (target.kind === 'field') {
        let field = scope.getByLabel(name, { exact });
        for (const role of FIELD_ROLES) {
            field = field.or(scope.getByRole(role, { exact, name }));
        }
        return field;
    }
    if (target.kind === 'testId') {
        return scope.getByTestId(name);
    }
    if (target.kind === 'text') {
        return scope.getByText(name, { exact });
    }
    // invariant: every other kind is an ARIA role named after itself: one branch answers for all.
    return scope.getByRole(
        target.kind,
        target.name === undefined ? { exact } : { exact, name: target.name },
    );
}

/** Playwright signals "more than one match" through this error text. */
function isStrictViolation(error: unknown): boolean {
    return error instanceof Error && error.message.includes('strict mode violation');
}

/** The ambiguous level is found first: a scope matching several landmarks is the real fault. */
async function act<T>(
    page: Page,
    target: Target,
    action: (locator: Locator) => Promise<T>,
): Promise<T> {
    try {
        return await action(locate(page, target));
    } catch (error) {
        if (!isStrictViolation(error)) {
            throw error;
        }
        const culprit = await findAmbiguousLevel(page, target);
        const matches = await locate(page, culprit).evaluateAll(candidatesOf, CANDIDATE_LIMITS);
        throw ambiguousTargetError({ target: culprit, matches, url: page.url() });
    }
}

async function findAmbiguousLevel(page: Page, target: Target): Promise<Target> {
    for (const level of scopeChain(target).slice(0, -1)) {
        if ((await locate(page, level).count()) > 1) {
            return level;
        }
    }
    return target;
}

/** A second locator condition keeps playwright's retry; `toBeFocused()` lives in `@playwright/test`, which this package does not carry. */
function stateOnly(page: Page, locator: Locator, target: Target): Locator | null {
    if (target.focused === true) {
        return locator.and(page.locator(':focus'));
    }
    if (target.disabled !== undefined) {
        return locator.and(page.locator(target.disabled ? ':disabled' : ':enabled'));
    }
    if (target.selected !== undefined) {
        return locator.and(page.locator(target.selected ? ':checked' : ':not(:checked)'));
    }
    return null;
}

/** A collapsed select's options have no box until opened. */
function byPresence(target: Target): boolean {
    return target.kind === 'option';
}

async function currentValue(locator: Locator): Promise<null | string> {
    try {
        return await locator.inputValue({ timeout: VALUE_POLL_MS });
    } catch (error) {
        // invariant: a strict-mode violation is `act()`'s `target-matches-one-element` refusal; anything else means the field is not there yet.
        if (isStrictViolation(error)) {
            throw error;
        }
        return null;
    }
}

/** A poll: a value is a property, and a locator's CSS reads the attribute, which a controlled input never moves. */
async function waitForValue(locator: Locator, target: Target, wanted: boolean): Promise<void> {
    const value = target.value ?? '';
    const deadline = Date.now() + VALUE_TIMEOUT_MS;
    for (;;) {
        const actual = await currentValue(locator);
        if (actual === null ? !wanted : (actual === value) === wanted) {
            return;
        }
        if (Date.now() >= deadline) {
            throw new Error(
                refusal({
                    fix: 'correct the value the scenario states, or what the page puts in the field',
                    found: `${asWritten(target)} ${wanted ? 'never held' : 'still holds'} ${JSON.stringify(value)}${actual === null ? ' (it is not on the page)' : `, it holds ${JSON.stringify(actual)}`}`,
                    read: 'docs/20-visitor.md#see-and-gone-are-the-synchronization',
                    why: 'A verb waits for what it states to hold, within its budget, and never sleeps.',
                }),
            );
        }
        await sleep(VALUE_POLL_MS);
    }
}

function createVisitor(page: Page, baseUrl: string): WebsiteVisitor {
    return {
        check: async (target) => {
            await act(page, target, async (locator) => {
                await locator.check();
            });
        },
        click: async (target) => {
            await act(page, target, async (locator) => {
                await locator.click();
            });
        },
        fill: async (target, value) => {
            await act(page, target, async (locator) => {
                await locator.fill(value);
            });
        },
        goto: async (path) => {
            await page.goto(`${baseUrl}${path}`, { waitUntil: 'load' });
        },
        hover: async (target) => {
            await act(page, target, async (locator) => {
                await locator.hover();
            });
        },
        press: async (key) => {
            await page.keyboard.press(key);
        },
        gone: async (target) => {
            await act(page, target, async (locator) => {
                if (target.value !== undefined) {
                    await waitForValue(locator, target, false);
                    return;
                }
                const narrowed = stateOnly(page, locator, target);
                if (narrowed !== null) {
                    await narrowed.waitFor({ state: 'detached' });
                    return;
                }
                await locator.waitFor({ state: byPresence(target) ? 'detached' : 'hidden' });
            });
        },
        see: async (target) => {
            await act(page, target, async (locator) => {
                if (target.value !== undefined) {
                    await waitForValue(locator, target, true);
                    return;
                }
                const narrowed = stateOnly(page, locator, target);
                if (narrowed !== null) {
                    await narrowed.waitFor({ state: 'attached' });
                    return;
                }
                await locator.waitFor({ state: byPresence(target) ? 'attached' : 'visible' });
            });
        },
        select: async (target, option) => {
            await act(page, target, async (locator) => await locator.selectOption(option));
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

        // invariant: with `'block'`, requests leaving the site are aborted; the stub backend stays reachable through `allowedOrigins`.
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
            // invariant: pinned before the first byte: a script reading `Date.now()` on load must see the stated instant.
            if (options.clock !== undefined) {
                await page.clock.setFixedTime(new Date(options.clock));
            }
            const consoleMessages: BrowserConsoleMessage[] = [];
            page.on('console', (message) => {
                consoleMessages.push({ text: message.text(), type: message.type() });
            });
            // invariant: an uncaught exception is an error of the visit, spelled as the browser's `ErrorEvent` spells it.
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
                    throw scenarioFailure(error, evidence, 'visit');
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

            // invariant: the same Playwright method the component facet's command calls: one dialect for both trees.
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
