/**
 * Support for the facet capability-matrix guard (`facet-matrix.test.ts`, the K1
 * guard that stops the documented `specification.{api,jobs,cli}` method matrix
 * from drifting from the real facet interfaces).
 *
 * The role vocabulary and the tiny projection helper live here — a pure module
 * with zero framework imports, so the tool-facing lint layer stays runtime-free
 * (CONVENTIONS I1). The compile-time exhaustiveness assertion itself lives in
 * the sibling test (which alone may import the facet types).
 */

/** The role a facet chain method plays: a chainable setup, or a terminal action. */
export type FacetRole = 'action' | 'setup';

/** The keys of a facet matrix that play the given role, sorted for stable comparison. */
export function methodsByRole(matrix: Record<string, FacetRole>, role: FacetRole): string[] {
    return Object.keys(matrix)
        .filter((key) => matrix[key] === role)
        .sort();
}
