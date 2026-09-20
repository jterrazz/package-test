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
 * The chapter the generated catalogue lives in. One constant, because the
 * anchor a message routes to and the file `npm run docs` writes have to be the
 * same page — a number that moved in one place and not the other sends every
 * diagnostic to a heading that no longer exists.
 */
export const CATALOGUE_CHAPTER = 'docs/13-linting.md';

/**
 * The tail every diagnostic ends with — `(I2 — docs/13-linting.md#i2-…)`.
 *
 * Generated, never typed. A message is the only page most readers ever see of
 * this catalogue, so it carries the id they cite in a suppression AND the exact
 * heading that explains it; written by hand, forty-odd of them drifted from the
 * chapter within one renumbering.
 */
export function anchorOf(id: string, ruleName: string): string {
    return `(${id} — ${CATALOGUE_CHAPTER}#${ruleName})`;
}
