import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { COLUMNS } from './facet-matrix.js';
import { layers, matrixRows, renderMatrix, spliceLayers, spliceMatrix } from './matrix.js';

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

    test('an empty mobile cell names M1, and the day one fills the exemption goes', () => {
        // Given - the mobile column, which has no tree of its own today (M1)
        const rows = matrixRows(ROOT);
        const declared = rows.filter((row) => row.capability.columns.includes('mobile'));

        // Then - each EMPTY mobile cell names M1; a cell that fills retires its exemption
        expect(declared.length).toBeGreaterThan(0);
        for (const row of declared.filter((candidate) => candidate.cells.mobile === 0)) {
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

    test('the layered reading is byte-identical to a fresh generation', () => {
        // Given - the layers block chapter 03 carries
        // Then - regenerating reproduces it exactly, counts included
        expect(spliceLayers(read('docs/03-testing.md'), ROOT)).toBe(read('docs/03-testing.md'));
    });

    test('every layer of the reading carries files', () => {
        // Given - the four layers the chapter publishes
        // Then - none of them is a claim with nothing behind it
        const found = layers(ROOT);
        expect(found).toHaveLength(5);
        for (const layer of found) {
            expect(layer.count, `${layer.layer} is empty`).toBeGreaterThan(0);
        }
    });
});
