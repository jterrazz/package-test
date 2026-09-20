import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { COLUMNS } from './facet-matrix.js';
import { matrixRows, renderMatrix, spliceMatrix } from './matrix.js';

/** The repository root, from this module's place inside `src/lint/`. */
const ROOT = resolve(import.meta.dirname, '../..');

const read = (relative: string): string => readFileSync(resolve(ROOT, relative), 'utf8');

/**
 * Meta-test K6 (`k6-matrix-no-empty-cell`) — the matrix has no silent hole.
 *
 * A facet can grow a method and never be specified on it, and no amount of
 * green tests says so: the suite proves what it runs, never what it does not.
 * The matrix is the projection that makes that visible, and this test is what
 * makes it a gate rather than a poster — a capability a facet DECLARES with no
 * test file exercising it fails here, unless the row names the reason
 * (mobile's simulator, a golden kind a facet's result cannot produce, a hole
 * the package owes itself and has written down).
 */
describe('capability matrix (meta-test K6)', () => {
    test('every declared capability is exercised, or says why it is not', () => {
        // Given - the matrix derived from the declaration and the package's own trees
        const rows = matrixRows(ROOT);

        // Then - no declared cell is empty without a reason stated on its row
        const holes = rows.flatMap((row) =>
            COLUMNS.filter(
                (column) =>
                    row.cells[column] === 0 && row.capability.exempt?.[column] === undefined,
            ).map((column) => `${row.capability.name} · ${column}`),
        );
        expect(holes, 'a declared capability nothing exercises, and nothing excuses').toStrictEqual(
            [],
        );
    });

    test('mobile is empty for one reason, and the reason is the one chapter 03 states', () => {
        // Given - the mobile column, which has no tree (M1)
        const rows = matrixRows(ROOT);
        const declared = rows.filter((row) => row.capability.columns.includes('mobile'));

        // Then - every mobile cell is zero, and every one of them names M1
        expect(declared.length).toBeGreaterThan(0);
        for (const row of declared) {
            expect(row.cells.mobile, `${row.capability.name} on mobile`).toBe(0);
            expect(row.capability.exempt?.mobile, `${row.capability.name} on mobile`).toContain(
                'M1',
            );
        }
    });

    test('the committed projections are byte-identical to a fresh generation', () => {
        // Given - the two files `npm run docs` writes from the matrix
        // Then - regenerating reproduces them exactly (edit the source, not the projection)
        expect(spliceMatrix(read('docs/03-testing.md'), ROOT)).toBe(read('docs/03-testing.md'));
        expect(renderMatrix(ROOT)).toBe(read('skills/jterrazz-test/references/matrix.md'));
    });
});
