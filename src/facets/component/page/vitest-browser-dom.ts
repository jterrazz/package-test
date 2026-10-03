import { expect, TestRunner } from 'vitest';
import { commands, locators, page, userEvent } from 'vitest/browser';
import type { Locator, LocatorSelectors } from 'vitest/browser';

import { refusal } from '../../../chain/refusals/refusal.js';
import { ambiguousTargetError } from '../../../visitor/matching/ambiguous.js';
import { CANDIDATE_LIMITS, candidatesOf } from '../../../visitor/matching/candidates.js';
import { asWritten } from '../../../visitor/targets/as-written.js';
import { scopeChain } from '../../../visitor/targets/landmarks.js';
import type { Target } from '../../../visitor/targets/target.js';
import type { MountedSurface } from '../render/page.port.js';
import type { ComponentUi, ComponentVisitor, DomMount } from '../render/scenario.js';

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

/** Browser Mode's role driver gives `<search>` no role, while the ARIA tree and playwright call it `search`. */
const SEARCH_ELEMENT = 'css=search:not([role])';

type SearchScope = LocatorSelectors & { getBySearchElement: () => Locator };

const SEARCH_METHODS: Parameters<typeof locators.extend>[0] & {
    getBySearchElement: () => string;
} = { getBySearchElement: () => SEARCH_ELEMENT };
locators.extend(SEARCH_METHODS);

function answersSearch(scope: LocatorSelectors): scope is SearchScope {
    return 'getBySearchElement' in scope;
}

/** A `<search>` takes its accessible name from its author alone. */
function locateSearch(scope: LocatorSelectors, target: Target, exact: boolean): Locator {
    const byRole =
        target.name === undefined
            ? scope.getByRole('search', { exact })
            : scope.getByRole('search', { exact, name: target.name });
    if (!answersSearch(scope)) {
        return byRole;
    }
    const byElement = scope.getBySearchElement();
    return byRole.or(
        target.name === undefined
            ? byElement
            : byElement.and(scope.getByLabelText(target.name, { exact })),
    );
}

/** No `.first()`: taking the first match is the silent wrong-element bug `target-matches-one-element` prevents. */
export function locate(root: LocatorSelectors, target: Target): Locator {
    const scope: LocatorSelectors = target.scope ? locate(root, target.scope) : root;
    // An absent `exact` is the default, not a choice.
    const exact = target.exact ?? true;
    const name = target.name ?? '';
    if (target.kind === 'field') {
        let field = scope.getByLabelText(name, { exact });
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
    if (target.kind === 'search') {
        return locateSearch(scope, target, exact);
    }
    // Every other kind is an ARIA role named after itself: one branch answers for all.
    return scope.getByRole(
        target.kind,
        target.name === undefined ? { exact } : { exact, name: target.name },
    );
}

function ambiguousLevel(target: Target): Target {
    for (const level of scopeChain(target).slice(0, -1)) {
        if (locate(page, level).elements().length > 1) {
            return level;
        }
    }
    return target;
}

/** The ambiguous level is found first: a scope matching several landmarks is the real fault. */
export async function act<T>(target: Target, action: (locator: Locator) => Promise<T>): Promise<T> {
    const locator = locate(page, target);
    try {
        return await action(locator);
    } catch (error) {
        if (locator.elements().length <= 1) {
            throw error;
        }
        const culprit = ambiguousLevel(target);
        const matches = candidatesOf(locate(page, culprit).elements(), CANDIDATE_LIMITS);
        const url = globalThis.location.href;
        throw ambiguousTargetError({ target: culprit, matches, url });
    }
}

/** A collapsed select's options have no box: visibility would answer "no" for every one. */
function byPresence(target: Target): boolean {
    return target.kind === 'option';
}

function valueOf(node: Element | null): string | undefined {
    return node instanceof HTMLInputElement ||
        node instanceof HTMLSelectElement ||
        node instanceof HTMLTextAreaElement
        ? node.value
        : undefined;
}

function isGone(locator: Locator, target: Target): boolean {
    const node = locator.query();
    if (target.focused === true) {
        return node !== document.activeElement;
    }
    if (target.disabled !== undefined) {
        return node === null || node.matches(':disabled') !== target.disabled;
    }
    if (target.selected !== undefined) {
        return node === null || node.matches(':checked') !== target.selected;
    }
    if (target.value !== undefined) {
        return node === null || valueOf(node) !== target.value;
    }
    return node === null || (byPresence(target) ? false : !node.checkVisibility());
}

/** What is left of the test's budget: a bare `expect.poll` falls back to one second. The 100ms margin is vitest's own, so the poll fails before the test times out. Read on `performance`: `Date` may be the page's pinned clock, months away, and a poll timer past 2^31 ms fires at once. */
function remainingBudget(): number | undefined {
    const current = TestRunner.getCurrentTest();
    const started = (current?.result?.startTime ?? Number.NaN) - performance.timeOrigin;
    if (current === undefined || Number.isNaN(started)) {
        return undefined;
    }
    return Math.max(current.timeout - (performance.now() - started) - 100, 0);
}

function polling<T>(probe: () => T, message: string): ReturnType<typeof expect.poll<T>> {
    const timeout = remainingBudget();
    return expect.poll(probe, { message, ...(timeout === undefined ? {} : { timeout }) });
}

function keystroke(key: string): string {
    return key.length > 1 ? `{${key}}` : key;
}

export function componentVerbs(surface: MountedSurface): ComponentVisitor {
    return {
        check: async (target) => {
            await act(target, async (locator) => {
                const node = locator.element();
                if (!(node instanceof HTMLInputElement) || !node.checked) {
                    await locator.click();
                }
            });
        },
        click: async (target) => {
            await act(target, async (locator) => {
                await locator.click();
            });
        },
        fill: async (target, value) => {
            await act(target, async (locator) => {
                await locator.fill(value);
            });
        },
        gone: async (target) => {
            await act(target, async (locator) => {
                // Polled: `expect.element` refuses a locator matching nothing, the commonest way to be gone.
                await polling(
                    () => isGone(locator, target),
                    `${asWritten(target)} is still on the screen`,
                ).toBeTruthy();
            });
        },
        hover: async (target) => {
            await act(target, async (locator) => {
                await locator.hover();
            });
        },
        press: async (key) => {
            await userEvent.keyboard(keystroke(key));
        },
        rerender: surface.rerender,
        see: async (target) => {
            await act(target, async (locator) => {
                if (target.focused === true) {
                    await expect.element(locator).toHaveFocus();
                    return;
                }
                if (target.disabled === true) {
                    await expect.element(locator).toBeDisabled();
                    return;
                }
                if (target.disabled === false) {
                    await expect.element(locator).toBeEnabled();
                    return;
                }
                if (target.selected !== undefined) {
                    // No matcher answers for an `<option>`: `:checked` is what CSS gives a selected one.
                    await polling(
                        () => locator.query()?.matches(':checked') === true,
                        `${asWritten(target)} is not the selected one`,
                    ).toBe(target.selected);
                    return;
                }
                if (target.value !== undefined) {
                    await expect.element(locator).toHaveValue(target.value);
                    return;
                }
                if (byPresence(target)) {
                    await expect.element(locator).toBeInTheDocument();
                    return;
                }
                await expect.element(locator).toBeVisible();
            });
        },
        select: async (target, option) => {
            await act(target, async (locator) => {
                await locator.selectOptions(option);
            });
        },
        unmount: surface.unmount,
    };
}

export async function ariaTree(): Promise<string> {
    return await commands.ariaTree();
}

export async function readGolden(name: string): Promise<null | string> {
    return await commands.goldenRead(name);
}

export async function writeGolden(name: string, content: string): Promise<string> {
    return await commands.goldenWrite(name, content);
}

export async function writeInPlaceText(stack: string, text: string): Promise<string> {
    return await commands.inPlaceWrite(stack, text);
}

export async function mountReact(ui: ComponentUi): Promise<MountedSurface> {
    let render;
    try {
        ({ render } = await import('vitest-browser-react'));
    } catch (error) {
        throw new Error(
            refusal('seam-is-an-optional-peer', {
                fix: 'npm install -D vitest-browser-react react react-dom',
                found: `component.render(<X />) requires \`vitest-browser-react\` and \`react\`, and they do not load (${String(error)})`,
            }),
            { cause: error },
        );
    }
    const rendered = await render(ui);
    return {
        container: rendered.container,
        rerender: rendered.rerender,
        unmount: rendered.unmount,
    };
}

/** The function may return its own teardown; no react is loaded. */
export function mountDom(mount: DomMount): MountedSurface {
    const container = document.createElement('div');
    document.body.append(container);
    const teardown = mount(container);
    return {
        container,
        rerender: () => {
            throw new Error(
                refusal({
                    fix: 'render the DOM function again, in a new render()',
                    found: 'rerender() on a DOM function',
                    read: 'docs/09-component.md#the-chain',
                    why: 'rerender() replaces a React tree, what a parent does with new props.',
                }),
            );
        },
        unmount: async () => {
            teardown?.();
            container.remove();
            await Promise.resolve();
        },
    };
}
