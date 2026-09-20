/**
 * The GROUND a row of specs stands on — the naming law of a spec tree.
 *
 * In a row of specs, a MEMBER is a spec: `<aspect>.test.ts`, `<case>.spec.yaml`,
 * `<name>.specification.ts`, and the facet/domain folders that hold them.
 * Everything else in that row is what the members STAND ON — inert material the
 * framework resolves BY PATH, never imported, never executed — and it carries a
 * LEADING UNDERSCORE. A spec's own folder never does.
 *
 * Four names, and only four: `_fixtures/` (file state), `_expected/` (goldens),
 * `_requests/` (inputs), `_seeds/` (database state). `contracts/` is NOT ground —
 * a contract is TypeScript a spec imports, behaviour composed with the spec's own,
 * so it stays a member. `docker/` is not ground either: it sits at the PROJECT
 * root beside `package.json`, outside any row of specs.
 *
 * This module is the single home of those names. Every resolver, matcher, lint
 * rule and checker pass reads them from here, so the runtime and the static
 * channels cannot disagree about where a spec's ground lives.
 */

/** Goldens: every expected fixture, flat, extension included. */
export const GROUND_EXPECTED = '_expected';
/** File state copied into a working directory by `.fixture()`. */
export const GROUND_FIXTURES = '_fixtures';
/** Inputs: complete `.http` request documents. */
export const GROUND_REQUESTS = '_requests';
/** Database state: `.sql` fragments loaded by `.seed()`. */
export const GROUND_SEEDS = '_seeds';

/** The four ground directory names, in the order they read. */
export const GROUND_DIRS = [
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
] as const;

/**
 * The pre-14 name of each ground directory → the name it carries now. Kept for
 * ONE purpose: naming the rename in a diagnostic (`c13-underscored-ground`).
 * Nothing resolves through it — an un-underscored directory is invisible to
 * every resolver, which is exactly why it must be reported rather than tolerated.
 */
export const RENAMED_GROUND_DIRS: Readonly<Record<string, string>> = {
    expected: GROUND_EXPECTED,
    fixtures: GROUND_FIXTURES,
    requests: GROUND_REQUESTS,
    seeds: GROUND_SEEDS,
};
