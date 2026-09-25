/**
 * The convention code a checker pass id carries: `d4b-spec-shape` → `d4b`.
 *
 * It lives alone because BOTH sides need it — the passes that build a finding
 * and the entry that publishes one as `jterrazz-check(<code>)` — and a copy in
 * either would be a second answer to what a finding is called.
 */
export function codeOf(passId: string): string {
    return passId.split('-')[0] ?? passId;
}

/**
 * The chapter the generated catalogue lives in — the page a message's `read:`
 * part routes to and the file `npm run docs` writes, one constant for both.
 */
export { CATALOGUE_CHAPTER } from '../src/model/lesson/refusal.js';

/**
 * The chapter a `self` row is read at — where the package says how it tests
 * itself. A rule only this package is held to has no row in the public
 * catalogue, so its message routes here instead.
 */
export const SELF_CHAPTER = 'docs/03-testing.md';
