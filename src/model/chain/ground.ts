/**
 * The GROUND a row of specs stands on — the naming law of a spec tree.
 *
 * In a row of specs, a MEMBER is a spec: `<aspect>.spec.ts`, `<case>.spec.yaml`,
 * `<name>.specification.ts`, and the facet/domain folders that hold them.
 * Everything else in that row is what the members STAND ON — material a spec
 * names BY PATH, never imported, never executed — and it sits in a folder
 * carrying one of four RESERVED names. No facet, domain or suite folder takes
 * one of them.
 *
 * Four names, and only four: `fixtures/` (file state), `expected/` (everything
 * asserted), `requests/` (inputs), `seeds/` (database state). `contracts/` is
 * NOT ground — a contract is TypeScript a spec imports, behaviour composed with
 * the spec's own, so it stays a member. `docker/` is not ground either: it sits
 * at the PROJECT root beside `package.json`, outside any row of specs.
 *
 * This module is the single home of those names. Every lint rule and checker
 * pass reads them from here, so the static channels cannot disagree about which
 * folder is ground.
 */

/** Everything asserted: golden files and trees, response `.http` included. */
export const GROUND_EXPECTED = 'expected';
/** File state a command spec copies into its working directory. */
export const GROUND_FIXTURES = 'fixtures';
/** Inputs: complete `.http` request documents. */
export const GROUND_REQUESTS = 'requests';
/** Database state: `.sql` fragments a chain seeds. */
export const GROUND_SEEDS = 'seeds';

/** The four ground directory names, in the order they read. */
export const GROUND_DIRS = [
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
] as const;

/**
 * The one folder of a specs root that holds the ground several leaves share:
 * `<specs>/shared/<role>/`, the four roles below it. It is reserved directly
 * under the specs root only: no facet takes the name, and deeper it is free.
 */
export const SHARED_GROUND = 'shared';

/** Is this folder name one of the four reserved ground names? */
export function isGroundName(name: string): boolean {
    return (GROUND_DIRS as readonly string[]).includes(name);
}

/**
 * The 16.x name of each ground directory → the name it carries now. Kept for
 * ONE purpose: naming the rename in a diagnostic (`c13-bare-ground`).
 */
export const RENAMED_GROUND_DIRS: Readonly<Record<string, string>> = {
    _expected: GROUND_EXPECTED,
    _fixtures: GROUND_FIXTURES,
    _requests: GROUND_REQUESTS,
    _seeds: GROUND_SEEDS,
};
