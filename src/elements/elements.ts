import type { ElementRef } from './descriptor.js';

/** Options accepted by every named descriptor. */
export type ElementOptions = {
    /** Match the accessible name whole; `true` by default, `{ exact: false }` for a name with a variable part. */
    exact?: boolean;
};

type ElementFactory = (name: string, options?: ElementOptions) => ElementRef;

const named =
    (kind: ElementRef['kind']): ElementFactory =>
    (name: string, options?: ElementOptions): ElementRef => ({
        kind,
        name,
        // Record what the author stated: an absent `exact` is exact, only a stated `false` is a substring.
        ...(options?.exact === undefined ? {} : { exact: options.exact }),
    });

/** A button (or element with the button role), by accessible name. */
export const button: ElementFactory = named('button');

/** A form field, by label. */
export const field: ElementFactory = named('field');

/** A heading, by accessible name. */
export const heading: ElementFactory = named('heading');

/** A link, by accessible name. */
export const link: ElementFactory = named('link');

/** An element containing the given text. */
export const content: ElementFactory = named('text');

/** The escape hatch: an element by `data-testid`. Prefer user-facing elements. */
export const testId = (id: string): ElementRef => ({ kind: 'testId', name: id });

type OptionallyNamedFactory = (name?: string, options?: ElementOptions) => ElementRef;

const optionallyNamed =
    (kind: ElementRef['kind']): OptionallyNamedFactory =>
    (name?: string, options?: ElementOptions): ElementRef => ({
        kind,
        ...(name === undefined ? {} : { name }),
        ...(options?.exact === undefined ? {} : { exact: options.exact }),
    });

/** The `banner` landmark — the page header. */
export const banner: OptionallyNamedFactory = optionallyNamed('banner');

/** The `complementary` landmark — an `<aside>`, a sidebar. */
export const complementary: OptionallyNamedFactory = optionallyNamed('complementary');

/** The `contentinfo` landmark — the page footer. */
export const contentinfo: OptionallyNamedFactory = optionallyNamed('contentinfo');

/** The `form` landmark — a form carrying an accessible name. */
export const form: OptionallyNamedFactory = optionallyNamed('form');

/** The `main` landmark — the primary content of the document. */
export const main: OptionallyNamedFactory = optionallyNamed('main');

/** The `navigation` landmark — a `<nav>`. Name it when a page has several. */
export const navigation: OptionallyNamedFactory = optionallyNamed('navigation');

/** The `region` landmark — a `<section>` carrying an accessible name. */
export const region: OptionallyNamedFactory = optionallyNamed('region');

/** The `search` landmark. */
export const search: OptionallyNamedFactory = optionallyNamed('search');

/** Restrict a descriptor to the inside of another: `click(within(navigation(), link('Articles')))`. */
export const within = (scope: ElementRef, target: ElementRef): ElementRef => ({
    ...target,
    scope: target.scope ? { ...target.scope, scope } : scope,
});

/** A modal or non-modal `<dialog>`, by accessible name. A closed one is absent. */
export const dialog: OptionallyNamedFactory = optionallyNamed('dialog');

/** A live region announcing a result — `role="status"`, an `<output>`. */
export const status: OptionallyNamedFactory = optionallyNamed('status');

/** A table, by its caption or accessible name. */
export const table: OptionallyNamedFactory = optionallyNamed('table');

/** A row of a table or grid, by the text of its cells. */
export const row: OptionallyNamedFactory = optionallyNamed('row');

/** An item of a list, by its text. Retires the `.first()` of an unnamed `<li>`. */
export const listitem: OptionallyNamedFactory = optionallyNamed('listitem');

/** An option of a select or listbox, by label; asserted by presence, since a collapsed select's options have no box. */
export const option: ElementFactory = named('option');

/** Where the keyboard is: `see(focused(button('Open')))`. */
export const focused = (element: ElementRef): ElementRef => ({ ...element, focused: true });

/** The element refuses input: `see(disabled(button('Delete')))`. */
export const disabled = (element: ElementRef): ElementRef => ({ ...element, disabled: true });

/** The other direction of {@link disabled} — the element takes input. */
export const enabled = (element: ElementRef): ElementRef => ({ ...element, disabled: false });

/** The option the field is on: `see(selected(option('LinkedIn')))`. */
export const selected = (element: ElementRef): ElementRef => ({ ...element, selected: true });

/** What the field holds, read from its live value: `see(valued(field('Title'), '…'))`. */
export const valued = (element: ElementRef, value: string): ElementRef => ({ ...element, value });
