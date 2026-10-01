import type { LandmarkKind, OptionallyNamedTarget, Target, TargetOptions } from './target.js';

const landmark =
    (kind: LandmarkKind): OptionallyNamedTarget =>
    (name?: string, options?: TargetOptions) => ({
        kind,
        ...(name === undefined ? {} : { name }),
        ...(options?.exact === undefined ? {} : { exact: options.exact }),
    });

/** The `banner` landmark — the page header. */
export const banner: OptionallyNamedTarget = landmark('banner');

/** The `complementary` landmark — an `<aside>`, a sidebar. */
export const complementary: OptionallyNamedTarget = landmark('complementary');

/** The `contentinfo` landmark — the page footer. */
export const contentinfo: OptionallyNamedTarget = landmark('contentinfo');

/** The `form` landmark — a form carrying an accessible name. */
export const form: OptionallyNamedTarget = landmark('form');

/** The `main` landmark — the primary content of the document. */
export const main: OptionallyNamedTarget = landmark('main');

/** The `navigation` landmark — a `<nav>`. Name it when a page has several. */
export const navigation: OptionallyNamedTarget = landmark('navigation');

/** The `region` landmark — a `<section>` carrying an accessible name. */
export const region: OptionallyNamedTarget = landmark('region');

/** The `search` landmark. */
export const search: OptionallyNamedTarget = landmark('search');

/** Restrict a target to the inside of another: `click(within(navigation(), link('Articles')))`. */
export const within = (scope: Target, target: Target): Target => ({
    ...target,
    scope: target.scope ? { ...target.scope, scope } : scope,
});

export function scopeChain(target: Target): Target[] {
    const chain: Target[] = [];
    for (let current: Target | undefined = target; current; current = current.scope) {
        chain.unshift(current);
    }
    return chain;
}
