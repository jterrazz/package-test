import { expect } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import type { Locator, LocatorSelectors } from 'vitest/browser';

import {
    AmbiguousElementError,
    describeAmbiguity,
    formatElement,
} from '../../specification/facets/website/ambiguity.js';
import type { ElementMatch, ElementRef } from '../../specification/ports/browser.port.js';
import type { ComponentUi, DomMount } from './ui.js';

/**
 * The browser-mode adapter — the component facet's half of the one element
 * vocabulary.
 *
 * Its translation table is the playwright adapter's, descriptor for
 * descriptor: a `button('Save')` means `getByRole('button', { name })` whether
 * the surface is a served page or a mounted component, and the W3 refusal
 * enumerates candidates in the same words. Two adapters, one dialect — which
 * is the whole reason a page spec and a component spec read alike.
 *
 * What differs is where the code runs. Playwright drives a page from the
 * outside and reads it through `evaluate`; here the test IS in the page, so a
 * candidate is described from the live element and the ARIA tree is the one
 * thing that has to go back out (`server.commands`, the provider's own frame).
 */

/** How many candidates the ambiguity error enumerates before truncating. */
const MAX_REPORTED_MATCHES = 10;

/** The landmark ancestors the ambiguity evidence names. */
const LANDMARKS = 'nav, header, footer, main, aside, section, form, [role]';

/** What a mounted subject offers the chain, React or vanilla DOM alike. */
export type MountedSurface = {
    /** The element the subject was mounted into. */
    container: HTMLElement;
    /** Replace the rendered tree — a prop change, as a parent makes one. */
    rerender: (ui: ComponentUi) => Promise<void>;
    /** Take it off the screen, as a parent does. */
    unmount: () => Promise<void>;
};

/**
 * Translate a user-facing descriptor into a Browser Mode locator, resolving
 * `scope` outside-in so `within(navigation(), link('X'))` searches the nav
 * subtree. No `.first()` anywhere: designating exactly one element is
 * CONVENTIONS W3, and taking the first match is the silent wrong-element bug
 * the rule exists to prevent.
 */
export function locate(root: LocatorSelectors, element: ElementRef): Locator {
    const scope: LocatorSelectors = element.scope ? locate(root, element.scope) : root;
    const exact = element.exact ?? false;
    const name = element.name ?? '';
    if (element.kind === 'field') {
        return scope.getByLabelText(name, { exact });
    }
    if (element.kind === 'testId') {
        return scope.getByTestId(name);
    }
    if (element.kind === 'text') {
        return scope.getByText(name, { exact });
    }
    // Every other kind IS an ARIA role — landmark or not — and the vocabulary
    // Names them after the role they locate, so one branch answers for all of
    // Them and a descriptor added to the vocabulary needs nothing here.
    return scope.getByRole(
        element.kind,
        element.name === undefined ? { exact } : { exact, name: element.name },
    );
}

/** Describe the live candidates — the evidence the W3 refusal enumerates. */
function candidates(locator: Locator): ElementMatch[] {
    return locator
        .elements()
        .slice(0, MAX_REPORTED_MATCHES)
        .map((node) => {
            const landmark = node.parentElement?.closest(LANDMARKS);
            const context = landmark?.getAttribute('role') ?? landmark?.tagName.toLowerCase();
            const detail = node.getAttribute('href') ?? node.getAttribute('name');
            return {
                context: context ?? undefined,
                detail: detail ?? undefined,
                tag: node.tagName.toLowerCase(),
                text: (node.textContent ?? '').replaceAll(/\s+/gu, ' ').trim().slice(0, 80),
            };
        });
}

/** Walk the scope chain outside-in; the outermost ambiguous level is the fault. */
function ambiguousLevel(element: ElementRef): ElementRef {
    const chain: ElementRef[] = [];
    for (let current: ElementRef | undefined = element; current; current = current.scope) {
        chain.unshift(current);
    }
    for (const level of chain.slice(0, -1)) {
        if (locate(page, level).elements().length > 1) {
            return level;
        }
    }
    return element;
}

/**
 * Run one visitor action, turning "more than one match" into the W3 refusal.
 * The ambiguous LEVEL is identified first: a scope matching several landmarks
 * is the real fault, and naming the target would send the author to fix the
 * wrong descriptor.
 */
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
        const matches = candidates(locate(page, culprit));
        const url = globalThis.location.href;
        throw new AmbiguousElementError(describeAmbiguity({ element: culprit, matches, url }));
    }
}

/**
 * Is the element gone — or, with the focus modifier, no longer holding the
 * keyboard? A node that left the document and one that is still there but not
 * rendered are the same answer to a spec.
 */
function isGone(locator: Locator, byFocus: boolean): boolean {
    const node = locator.query();
    if (byFocus) {
        return node !== document.activeElement;
    }
    return node === null || !node.checkVisibility();
}

/** A key name is a key; a single character is typed as itself. */
function keystroke(key: string): string {
    return key.length > 1 ? `{${key}}` : key;
}

/** The verbs a rendered surface shares with a page, plus the two a parent owns. */
export function componentVerbs(surface: MountedSurface): {
    check: (element: ElementRef) => Promise<void>;
    click: (element: ElementRef) => Promise<void>;
    fill: (element: ElementRef, value: string) => Promise<void>;
    gone: (element: ElementRef) => Promise<void>;
    hover: (element: ElementRef) => Promise<void>;
    press: (key: string) => Promise<void>;
    rerender: (ui: ComponentUi) => Promise<void>;
    see: (element: ElementRef) => Promise<void>;
    select: (element: ElementRef, option: string) => Promise<void>;
    unmount: () => Promise<void>;
} {
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
                // Polled rather than asserted through `expect.element`: that
                // Helper REFUSES a locator matching nothing, and "nothing
                // Matches" is the commonest way for a thing to be gone. Absence
                // Is one question — removed, or still there and not shown — and
                // The poll retries it the same way every other verb retries.
                await expect
                    .poll(() => isGone(locator, element.focused === true), {
                        message: `${formatElement(element)} is still on the screen`,
                    })
                    .toBeTruthy();
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

/** The ARIA snapshot of the rendered `<body>` — the golden a tree is asserted as. */
export async function ariaTree(): Promise<string> {
    return await commands.ariaTree();
}

/** A golden's content, read server-side from `_expected/` beside the test. */
export async function readGolden(name: string): Promise<null | string> {
    return await commands.goldenRead(name);
}

/** Write a golden server-side, and say where — update mode's half. */
export async function writeGolden(name: string, content: string): Promise<string> {
    return await commands.goldenWrite(name, content);
}

/** Mount a React subject through the optional `vitest-browser-react` adapter. */
export async function mountReact(ui: ComponentUi): Promise<MountedSurface> {
    let render;
    try {
        ({ render } = await import('vitest-browser-react'));
    } catch (error) {
        throw new Error(
            'component.render(<X />) needs vitest-browser-react and react (optional peers): ' +
                `npm install -D vitest-browser-react react react-dom (${String(error)})`,
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

/**
 * Mount a vanilla DOM subject: the function is handed a fresh container and
 * may return its own teardown — the shape a DOM library states one in. There
 * is no react here, and no react is loaded.
 */
export function mountDom(mount: DomMount): MountedSurface {
    const container = document.createElement('div');
    document.body.append(container);
    const teardown = mount(container);
    return {
        container,
        rerender: () => {
            throw new Error(
                'rerender() replaces a React tree; a DOM function is re-rendered by calling it again in a new render().',
            );
        },
        unmount: async () => {
            teardown?.();
            container.remove();
            await Promise.resolve();
        },
    };
}
