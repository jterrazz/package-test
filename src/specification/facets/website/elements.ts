import type { ElementRef } from '../../ports/browser.port.js';

/**
 * The element vocabulary — user-facing descriptors for visit scenarios.
 * Reads like English (`click(link('Articles'))`), translates to
 * accessibility-first locators in the browser integration. CSS/XPath is
 * deliberately not expressible; `testId()` is the single escape hatch.
 *
 * A descriptor must designate exactly ONE element (CONVENTIONS W3). Two knobs
 * narrow it, in this order of preference:
 *
 *   1. `within(scope, target)` — search inside a landmark, the way a person
 *      would say "the Articles link *in the nav*";
 *   2. `{ exact: true }` — match the accessible name whole rather than as a
 *      substring, when two names genuinely overlap.
 */

/** Options accepted by every named descriptor. */
export type ElementOptions = {
    /**
     * Match the accessible name as a whole string. Default is substring —
     * `link('Articles')` also matches "Read Articles".
     */
    exact?: boolean;
};

/** A user-facing element factory — what every name in this module is. */
type ElementFactory = (name: string, options?: ElementOptions) => ElementRef;

const named =
    (kind: ElementRef['kind']): ElementFactory =>
    (name: string, options?: ElementOptions): ElementRef => ({
        kind,
        name,
        ...(options?.exact ? { exact: true } : {}),
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
/*
 * The landmarks — the containers a scope can name. This is the ARIA landmark
 * set and nothing else: a closed, standard vocabulary keeps `within()` from
 * degenerating into a second selector language. Each is optionally named, for
 * the pages carrying several of the same region (`navigation('Breadcrumb')`).
 */

/** A landmark factory — the optionally-named containers `within()` accepts. */
type LandmarkFactory = (name?: string, options?: ElementOptions) => ElementRef;

const landmark =
    (kind: ElementRef['kind']): LandmarkFactory =>
    (name?: string, options?: ElementOptions): ElementRef => ({
        kind,
        ...(name === undefined ? {} : { name }),
        ...(options?.exact ? { exact: true } : {}),
    });

/** The `banner` landmark — the page header. */
export const banner: LandmarkFactory = landmark('banner');

/** The `complementary` landmark — an `<aside>`, a sidebar. */
export const complementary: LandmarkFactory = landmark('complementary');

/** The `contentinfo` landmark — the page footer. */
export const contentinfo: LandmarkFactory = landmark('contentinfo');

/** The `form` landmark — a form carrying an accessible name. */
export const form: LandmarkFactory = landmark('form');

/** The `main` landmark — the primary content of the document. */
export const main: LandmarkFactory = landmark('main');

/** The `navigation` landmark — a `<nav>`. Name it when a page has several. */
export const navigation: LandmarkFactory = landmark('navigation');

/** The `region` landmark — a `<section>` carrying an accessible name. */
export const region: LandmarkFactory = landmark('region');

/** The `search` landmark. */
export const search: LandmarkFactory = landmark('search');

/**
 * Restrict a descriptor to the inside of another — the answer to ambiguity,
 * and the one the framework prefers over a test id.
 *
 *     click(within(navigation(), link('Articles')))
 *
 * Composes outside-in: the scope may itself be scoped, so a deeply nested
 * target reads `within(main(), within(region('Series'), link('Part 2')))`.
 * Any descriptor works as a scope, including `testId()` when a container has
 * no landmark role to stand on.
 */
export const within = (scope: ElementRef, target: ElementRef): ElementRef => ({
    ...target,
    scope: target.scope ? { ...target.scope, scope } : scope,
});

/*
 * Five more roles a visitor reads and acts on. They are not landmarks — a
 * landmark is a CONTAINER of a page — but they take an optional name for the
 * same reason: a page carries several rows and several list items, and one
 * status has none at all.
 */

/** A modal or non-modal `<dialog>`, by accessible name. A closed one is absent. */
export const dialog: LandmarkFactory = landmark('dialog');

/** A live region announcing a result — `role="status"`, an `<output>`. */
export const status: LandmarkFactory = landmark('status');

/** A table, by its caption or accessible name. */
export const table: LandmarkFactory = landmark('table');

/** A row of a table or grid, by the text of its cells. */
export const row: LandmarkFactory = landmark('row');

/** An item of a list, by its text. Retires the `.first()` of an unnamed `<li>`. */
export const listitem: LandmarkFactory = landmark('listitem');

/**
 * An option of a select or a listbox, by its label — named inside the field
 * that holds it: `within(field('Channel'), option('LinkedIn'))`.
 *
 * Asserted by PRESENCE, not by visibility: the options of a collapsed
 * `<select>` are in the document and in the accessibility tree, and none of
 * them has a box on the screen until it is opened. `see(option('LinkedIn'))`
 * therefore asks "is it offered", and `see(selected(option('LinkedIn')))`
 * asks which one the field is on.
 */
export const option: ElementFactory = named('option');

/**
 * Where the keyboard is: `see(focused(button('Open')))` asserts the element has
 * focus, `gone(focused(x))` that it does not.
 *
 * A modifier rather than a descriptor of its own, because focus is a STATE of
 * an element the vocabulary can already name. It is a verb's business and never
 * a golden's: the accessibility tree carries no focus, so a tree snapshot of a
 * dialog that took the keyboard and one that did not are byte-identical.
 */
export const focused = (element: ElementRef): ElementRef => ({ ...element, focused: true });

/**
 * Whether the element accepts input: `see(disabled(button('Delete')))` asserts
 * it refuses, `see(enabled(button('Delete')))` that it takes it.
 *
 * Modifiers rather than descriptors, for the same reason as `focused`: being
 * disabled is a state of an element the vocabulary already names. Unlike focus,
 * the ARIA tree carries it, so a golden pins a whole outline's enablement and
 * these name the ONE control a test is about. They also buy the direction a
 * behavioural substitute cannot reach — clicking a disabled control is a
 * timeout, never an assertion.
 */
export const disabled = (element: ElementRef): ElementRef => ({ ...element, disabled: true });

/** The other direction of {@link disabled} — the element takes input. */
export const enabled = (element: ElementRef): ElementRef => ({ ...element, disabled: false });

/**
 * Which option the field is on: `see(selected(option('LinkedIn')))`, and
 * `gone(selected(option('X')))` for the one it left.
 *
 * A modifier for the same reason as {@link disabled}: being chosen is a state
 * of an element the vocabulary already names. No matcher answers for it — a
 * `<option>` is not a checkbox — so both adapters read the `:checked` the CSS
 * spec gives a selected option.
 */
export const selected = (element: ElementRef): ElementRef => ({ ...element, selected: true });

/**
 * What the field holds: `see(valued(field('Title'), 'Launch teaser'))`, and
 * `gone(valued(field('Title'), '…'))` for a value it no longer holds.
 *
 * A modifier for the same reason as {@link disabled}: what a field holds is a
 * state of an element the vocabulary already names, and this is how the ONE
 * field a test is about is waited for — a golden pins a whole outline instead.
 * Read from the node's live value, never from the `value` ATTRIBUTE, which a
 * controlled input never moves.
 */
export const valued = (element: ElementRef, value: string): ElementRef => ({ ...element, value });
