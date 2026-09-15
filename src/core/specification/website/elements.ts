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
