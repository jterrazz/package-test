import type { ElementRef } from './element.js';
import { optionallyNamed } from './named.js';
import type { OptionallyNamedFactory } from './named.js';

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
