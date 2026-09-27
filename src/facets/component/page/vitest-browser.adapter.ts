import { expect, TestRunner } from 'vitest';
import { commands, locators, page, userEvent } from 'vitest/browser';
import type { Locator, LocatorSelectors } from 'vitest/browser';

import { refusal } from '../../../../lint/index.refusal.js';
import { AmbiguousElementError, describeAmbiguity } from '../../../elements/ambiguity/ambiguity.js';
import { CANDIDATE_LIMITS, candidatesOf } from '../../../elements/ambiguity/candidate.js';
import { asWritten } from '../../../elements/descriptors/as-written.js';
import type { ElementRef } from '../../../elements/descriptors/element.js';
import { scopeChain } from '../../../elements/descriptors/scope-chain.js';
import type { MountedSurface } from '../render/page.port.js';
import type { ComponentUi, ComponentVisitor, DomMount } from '../render/scenario.js';

/** The playwright adapter's translation table, descriptor for descriptor; here the test is in the page, so candidates are read from live elements. */

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
function locateSearch(scope: LocatorSelectors, element: ElementRef, exact: boolean): Locator {
    const byRole =
        element.name === undefined
            ? scope.getByRole('search', { exact })
            : scope.getByRole('search', { exact, name: element.name });
    if (!answersSearch(scope)) {
        return byRole;
    }
    const byElement = scope.getBySearchElement();
    return byRole.or(
        element.name === undefined
            ? byElement
            : byElement.and(scope.getByLabelText(element.name, { exact })),
    );
}

/** No `.first()`: taking the first match is the silent wrong-element bug `descriptor-matches-one-element` prevents. */
export function locate(root: LocatorSelectors, element: ElementRef): Locator {
    const scope: LocatorSelectors = element.scope ? locate(root, element.scope) : root;
    // An absent `exact` is the default, not a choice.
    const exact = element.exact ?? true;
    const name = element.name ?? '';
    if (element.kind === 'field') {
        let field = scope.getByLabelText(name, { exact });
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
    if (element.kind === 'search') {
        return locateSearch(scope, element, exact);
    }
    // Every other kind is an ARIA role named after itself: one branch answers for all.
    return scope.getByRole(
        element.kind,
        element.name === undefined ? { exact } : { exact, name: element.name },
    );
}

function ambiguousLevel(element: ElementRef): ElementRef {
    for (const level of scopeChain(element).slice(0, -1)) {
        if (locate(page, level).elements().length > 1) {
            return level;
        }
    }
    return element;
}

/** The ambiguous level is found first: a scope matching several landmarks is the real fault. */
export async function act<T>(
    element: ElementRef,
    action: (locator: Locator) => Promise<T>,
): Promise<T> {
    const locator = locate(page, element);
    try {
        return await action(locator);
    } catch (error) {
        if (locator.elements().length <= 1) {
            throw error;
        }
        const culprit = ambiguousLevel(element);
        const matches = candidatesOf(locate(page, culprit).elements(), CANDIDATE_LIMITS);
        const url = globalThis.location.href;
        throw new AmbiguousElementError(describeAmbiguity({ element: culprit, matches, url }));
    }
}

/** A collapsed select's options have no box: visibility would answer "no" for every one. */
function byPresence(element: ElementRef): boolean {
    return element.kind === 'option';
}

function valueOf(node: Element | null): string | undefined {
    return node instanceof HTMLInputElement ||
        node instanceof HTMLSelectElement ||
        node instanceof HTMLTextAreaElement
        ? node.value
        : undefined;
}

function isGone(locator: Locator, element: ElementRef): boolean {
    const node = locator.query();
    if (element.focused === true) {
        return node !== document.activeElement;
    }
    if (element.disabled !== undefined) {
        return node === null || node.matches(':disabled') !== element.disabled;
    }
    if (element.selected !== undefined) {
        return node === null || node.matches(':checked') !== element.selected;
    }
    if (element.value !== undefined) {
        return node === null || valueOf(node) !== element.value;
    }
    return node === null || (byPresence(element) ? false : !node.checkVisibility());
}

/** What is left of the test's budget: a bare `expect.poll` falls back to one second. The 100ms margin is vitest's own, so the poll fails before the test times out. */
function remainingBudget(): number | undefined {
    const current = TestRunner.getCurrentTest();
    const started = current?.result?.startTime;
    if (current === undefined || started === undefined) {
        return undefined;
    }
    return Math.max(current.timeout - (Date.now() - started) - 100, 0);
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
        check: async (element) => {
            await act(element, async (locator) => {
                const node = locator.element();
                if (!(node instanceof HTMLInputElement) || !node.checked) {
                    await locator.click();
                }
            });
        },
        click: async (element) => {
            await act(element, async (locator) => {
                await locator.click();
            });
        },
        fill: async (element, value) => {
            await act(element, async (locator) => {
                await locator.fill(value);
            });
        },
        gone: async (element) => {
            await act(element, async (locator) => {
                // Polled: `expect.element` refuses a locator matching nothing, the commonest way to be gone.
                await polling(
                    () => isGone(locator, element),
                    `${asWritten(element)} is still on the screen`,
                ).toBeTruthy();
            });
        },
        hover: async (element) => {
            await act(element, async (locator) => {
                await locator.hover();
            });
        },
        press: async (key) => {
            await userEvent.keyboard(keystroke(key));
        },
        rerender: surface.rerender,
        see: async (element) => {
            await act(element, async (locator) => {
                if (element.focused === true) {
                    await expect.element(locator).toHaveFocus();
                    return;
                }
                if (element.disabled === true) {
                    await expect.element(locator).toBeDisabled();
                    return;
                }
                if (element.disabled === false) {
                    await expect.element(locator).toBeEnabled();
                    return;
                }
                if (element.selected !== undefined) {
                    // No matcher answers for an `<option>`: `:checked` is what CSS gives a selected one.
                    await polling(
                        () => locator.query()?.matches(':checked') === true,
                        `${asWritten(element)} is not the selected one`,
                    ).toBe(element.selected);
                    return;
                }
                if (element.value !== undefined) {
                    await expect.element(locator).toHaveValue(element.value);
                    return;
                }
                if (byPresence(element)) {
                    await expect.element(locator).toBeInTheDocument();
                    return;
                }
                await expect.element(locator).toBeVisible();
            });
        },
        select: async (element, option) => {
            await act(element, async (locator) => {
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
                    read: 'docs/07-component.md#the-chain',
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
