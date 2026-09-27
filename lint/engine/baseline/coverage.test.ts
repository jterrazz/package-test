import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { drops, raised, readFloors, report, writeFloors } from './coverage.js';

function rootWith(section: string): string {
    const root = mkdtempSync(join(tmpdir(), 'coverage-baseline-'));
    writeFileSync(
        join(root, 'jterrazz.baseline.json'),
        `{ "test": {}, "test.coverage": ${section} }`,
    );
    return root;
}

const floor = { branches: 70, functions: 80, lines: 76, statements: 76 };

describe('coverage', () => {
    test('the coverage ratchet — says nothing when every metric holds its floor', () => {
        // Given - a run that matches the floor exactly
        const now = { ...floor };

        // Then - equal is not a drop: the gate asks "worse than last time", not "better"
        expect(drops(floor, now, 'all')).toStrictEqual([]);
    });

    test('the coverage ratchet — names every metric that fell, and by how much', () => {
        // Given - a run that lost statements and functions
        const now = { ...floor, functions: 79.5, statements: 74.25 };

        // Then - one lesson per metric, each carrying both numbers
        expect(drops(floor, now, 'all').map(({ teaching }) => teaching.found)).toStrictEqual([
            '`all/functions` fell to 79.50, below its floor of 80.00',
            '`all/statements` fell to 74.25, below its floor of 76.00',
        ]);
    });

    test('the coverage ratchet — has nothing to say before a floor exists', () => {
        // Given - the first run of a project, with no recorded floor
        // Then - the ratchet does not fail a run it has no comparison for
        expect(drops(undefined, floor, 'all')).toStrictEqual([]);
    });

    test('the coverage ratchet — raises each metric on its own', () => {
        // Given - a run that gained statements and lost branches
        const now = { ...floor, branches: 60, statements: 80 };

        // Then - the floor takes the better of the two per metric, so a gain is kept even when it arrived beside a loss the gate is about to refuse
        expect(raised(floor, now)).toStrictEqual({
            branches: 70,
            functions: 80,
            lines: 76,
            statements: 80,
        });
    });

    test('the coverage ratchet — starts from zero when nothing was recorded', () => {
        // Given - no floor at all
        // Then - the first run IS the floor
        expect(raised(undefined, floor)).toStrictEqual(floor);
    });

    test('the coverage ratchet — reports the four metrics in one line, in the order it always prints them', () => {
        // Given - a recorded scope
        // Then - statements, branches, functions, lines — the order v8's own summary uses
        expect(report('all', floor)).toBe(
            'all: statements 76.00%, branches 70.00%, functions 80.00%, lines 76.00%',
        );
    });

    test('the coverage ratchet — refuses a floor that is missing a metric', () => {
        // Given - a section whose `all` floor carries branches alone
        const root = rootWith('{ "all/branches": 69.89 }');

        // Then - it is refused rather than read as three floors of zero, which would forbid nothing
        expect(() => readFloors(root)).toThrow(/statements, functions, lines/u);
    });

    test('the coverage ratchet — reads a complete floor', () => {
        // Given - a section with the four metrics of one scope
        const root = rootWith(
            '{ "all/branches": 1, "all/functions": 2, "all/lines": 3, "all/statements": 4 }',
        );

        // Then - the four come back as one floor
        expect(readFloors(root).all).toStrictEqual({
            branches: 1,
            functions: 2,
            lines: 3,
            statements: 4,
        });
    });

    test('the coverage ratchet — records its floor as a section of the family file, the others kept', () => {
        // Given - a family file holding the checker's section
        const root = rootWith('{}');

        // When - the floor is recorded
        writeFloors(root, { all: floor });

        // Then - it reads back whole, and the checker's section is still there
        expect(readFloors(root)).toStrictEqual({ all: floor });
        expect(readFileSync(join(root, 'jterrazz.baseline.json'), 'utf8')).toContain('"test": {}');
    });
});
