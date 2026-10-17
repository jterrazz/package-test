import { optionallyNamed } from './roles.js';
import type { OptionallyNamedTargetFactory, Target } from './target.js';

/** The `banner` landmark: the page header. */
export const banner: OptionallyNamedTargetFactory = optionallyNamed('banner');

/** The `complementary` landmark: an `<aside>`, a sidebar. */
export const complementary: OptionallyNamedTargetFactory = optionallyNamed('complementary');

/** The `contentinfo` landmark: the page footer. */
export const contentinfo: OptionallyNamedTargetFactory = optionallyNamed('contentinfo');

/** The `form` landmark: a form carrying an accessible name. */
export const form: OptionallyNamedTargetFactory = optionallyNamed('form');

/** The `main` landmark: the primary content of the document. */
export const main: OptionallyNamedTargetFactory = optionallyNamed('main');

/** The `navigation` landmark: a `<nav>`. Name it when a page has several. */
export const navigation: OptionallyNamedTargetFactory = optionallyNamed('navigation');

/** The `region` landmark: a `<section>` carrying an accessible name. */
export const region: OptionallyNamedTargetFactory = optionallyNamed('region');

/** The `search` landmark. */
export const search: OptionallyNamedTargetFactory = optionallyNamed('search');

/** Restrict a target to the inside of another: `click(within(navigation(), link('Articles')))`. */
export const within = (scope: Target, target: Target): Target => ({
    ...target,
    scope: target.scope ? within(scope, target.scope) : scope,
});

export function scopeChain(target: Target): Target[] {
    const chain: Target[] = [];
    for (let current: Target | undefined = target; current; current = current.scope) {
        chain.unshift(current);
    }
    return chain;
}
