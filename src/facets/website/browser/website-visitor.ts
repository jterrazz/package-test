import { setTimeout as sleep } from 'node:timers/promises';
import type { Locator, Page } from 'playwright';

import { refusal } from '../../../chain/refusals/refusal.js';
import { ambiguousTargetError } from '../../../visitor/matching/ambiguous.js';
import { CANDIDATE_LIMITS, candidatesOf } from '../../../visitor/matching/candidates.js';
import { asWritten } from '../../../visitor/targets/as-written.js';
import { scopeChain } from '../../../visitor/targets/landmarks.js';
import type { Target } from '../../../visitor/targets/target.js';
import type { WebsiteVisitor } from './browser.port.js';

type MatchScope = Locator | Page;

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

/** `see()` waits for the target to be there, `gone()` for it to leave: by value, by state, or by presence. */
async function settle(
    page: Page,
    locator: Locator,
    target: Target,
    present: boolean,
): Promise<void> {
    if (target.value !== undefined) {
        await waitForValue(locator, target, present);
        return;
    }
    const narrowed = stateOnly(page, locator, target);
    if (narrowed !== null) {
        await narrowed.waitFor({ state: present ? 'attached' : 'detached' });
        return;
    }
    const shown = present ? 'visible' : 'hidden';
    await locator.waitFor({
        state: byPresence(target) ? (present ? 'attached' : 'detached') : shown,
    });
}

export function createVisitor(page: Page, baseUrl: string): WebsiteVisitor {
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
                await settle(page, locator, target, false);
            });
        },
        see: async (target) => {
            await act(page, target, async (locator) => {
                await settle(page, locator, target, true);
            });
        },
        select: async (target, option) => {
            await act(page, target, async (locator) => await locator.selectOption(option));
        },
    };
}
