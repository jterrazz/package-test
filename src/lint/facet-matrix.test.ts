import { describe, expect, test } from 'vitest';

import type { ApiSpecification, CliSpecification, JobsSpecification } from '../index.js';
import { type FacetRole, methodsByRole } from './facet-matrix.js';

/**
 * Meta-test (K1 guard) — the documented facet capability matrix must equal the
 * REAL facet surfaces, so it can never drift again.
 *
 * The README "Builder API" tables (Setup / Actions) and docs/02–04 state, per
 * facet, WHICH chain methods exist — `.headers()` is api-only, `.intercept()`
 * is api+jobs, `.fixture()`/`.env()` are cli-only, `.seed()` is on every facet,
 * and each facet has its own terminal action set. That matrix is prose: nothing
 * recompiles it when a facet interface changes, so a renamed/added/removed
 * method silently drifts from the docs (the exact defect class this guard
 * exists to stop — the same change fixed a stale BaseResult-accessor claim).
 *
 * Each record below re-encodes the documented matrix and is pinned to the real
 * `keyof` of its facet interface via `satisfies Record<keyof …, FacetRole>`,
 * which forces exhaustiveness in BOTH directions on the object literal:
 *   - add a method to a facet interface  → the record is MISSING a key       → build fails;
 *   - remove or rename a facet method     → the record has an EXTRANEOUS key  → build fails.
 * Either way `npm run lint`'s typecheck breaks until this matrix AND the README
 * "Builder API" tables are revisited together. Types are erased at runtime, so
 * the compile-time `satisfies` IS the guard; the runtime test only documents
 * the cross-facet claims and keeps the records referenced.
 *
 * On a failure here: reconcile the record with the facet interface in
 * `src/core/specification/shared/builder.ts`, then update the README
 * "Builder API" Setup/Actions tables (and docs/02–04) to match.
 */

const apiMatrix = {
    // Setup (chainable) — README "Builder API › Setup", api column.
    headers: 'setup',
    intercept: 'setup',
    seed: 'setup',
    // Actions (terminal) — README "Builder API › Actions".
    delete: 'action',
    get: 'action',
    post: 'action',
    put: 'action',
    request: 'action',
} satisfies Record<keyof ApiSpecification, FacetRole>;

const jobsMatrix = {
    // Setup (chainable).
    intercept: 'setup',
    seed: 'setup',
    // Action (terminal).
    trigger: 'action',
} satisfies Record<keyof JobsSpecification, FacetRole>;

const cliMatrix = {
    // Setup (chainable).
    env: 'setup',
    fixture: 'setup',
    seed: 'setup',
    // Action (terminal).
    exec: 'action',
} satisfies Record<keyof CliSpecification, FacetRole>;

describe('facet capability matrix (K1 guard)', () => {
    test('setup methods sit on exactly the documented facets', () => {
        // Given - the documented matrix, keyed by each facet's real keyof
        // Then - the cross-facet Setup claims from the README table hold
        expect('seed' in apiMatrix && 'seed' in jobsMatrix && 'seed' in cliMatrix).toBe(true); // All facets
        expect('intercept' in apiMatrix && 'intercept' in jobsMatrix).toBe(true); // Api + jobs
        expect('intercept' in cliMatrix).toBe(false); // Not cli
        expect('headers' in apiMatrix).toBe(true); // Api only
        expect('headers' in jobsMatrix || 'headers' in cliMatrix).toBe(false);
        expect('fixture' in cliMatrix && 'env' in cliMatrix).toBe(true); // Cli only
        expect('fixture' in apiMatrix || 'env' in apiMatrix).toBe(false);
    });

    test('each facet exposes exactly the documented terminal actions', () => {
        // Given - the same matrix, split by role via the sibling helper
        // Then - the terminal actions match the README "Actions" table per facet
        expect(methodsByRole(apiMatrix, 'action')).toEqual([
            'delete',
            'get',
            'post',
            'put',
            'request',
        ]);
        expect(methodsByRole(jobsMatrix, 'action')).toEqual(['trigger']);
        expect(methodsByRole(cliMatrix, 'action')).toEqual(['exec']);
    });
});
