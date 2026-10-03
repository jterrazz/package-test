import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { drops, readFloor, recordFloor, report } from './coverage.js';

function rootWith(text: string): string {
    const root = mkdtempSync(join(tmpdir(), 'coverage-baseline-'));
    writeFileSync(join(root, 'jterrazz.baseline.json'), text);
    return root;
}

const FLOOR = { 'all/branches': 70, 'all/functions': 80, 'all/lines': 76, 'all/statements': 76 };

const READ = 'read: docs/03-testing.md#coverage-is-a-ratchet-not-a-threshold';

describe('coverage', () => {
    test('the coverage ratchet — says nothing when every metric holds its floor', () => {
        // Given - a run that matches the floor exactly
        // Then - equal is not a drop: the gate asks "worse than last time", not "better"
        expect(drops(FLOOR, { ...FLOOR })).toStrictEqual([]);
    });

    test('the coverage ratchet — names every metric that fell, and by how much', () => {
        // Given - a run that lost statements and functions
        const now = { ...FLOOR, 'all/functions': 79.5, 'all/statements': 74.25 };

        // Then - one lesson per metric, each carrying both numbers
        expect(drops(FLOOR, now).map(({ teaching }) => teaching.found)).toStrictEqual([
            '`all/functions` fell to 79.50, below its floor of 80.00',
            '`all/statements` fell to 74.25, below its floor of 76.00',
        ]);
    });

    test('the coverage ratchet — raises each metric on its own, and keeps every other scope', () => {
        // Given - a file holding two scopes, and a run of one that gained statements and lost branches
        const unit = {
            'unit/branches': 50,
            'unit/functions': 50,
            'unit/lines': 50,
            'unit/statements': 50,
        };
        const root = rootWith(`{ "test.coverage": ${JSON.stringify({ ...FLOOR, ...unit })} }\n`);
        const now = { ...FLOOR, 'all/branches': 60, 'all/statements': 80 };

        // When - the floor is recorded
        recordFloor(root, readFloor(root).floor, now);

        // Then - the floor takes the better of the two per metric, and the other scope stands
        expect(readFloor(root)).toStrictEqual({
            floor: { ...FLOOR, ...unit, 'all/statements': 80 },
            problem: null,
        });
    });

    test('the coverage ratchet — records its floor as a section of the family file, the others kept', () => {
        // Given - a family file holding the checker's section
        const root = rootWith('{\n    "test": {}\n}\n');

        // When - the first floor is recorded
        recordFloor(root, {}, FLOOR);

        // Then - the whole file holds the checker's section and the floor beside it
        expect(readFileSync(join(root, 'jterrazz.baseline.json'), 'utf8')).toBe(
            '{\n    "test.coverage": {\n        "all/branches": 70,\n        "all/functions": 80,\n        "all/lines": 76,\n        "all/statements": 76\n    },\n    "test": {}\n}\n',
        );
    });

    test('the coverage ratchet — reports the four metrics of a scope in one line, in the order it always prints them', () => {
        // Given - a recorded scope
        // Then - statements, branches, functions, lines — the order v8's own summary uses
        expect(report('all', FLOOR)).toBe(
            'all: statements 76.00%, branches 70.00%, functions 80.00%, lines 76.00%',
        );
    });

    test.each([
        [
            'a floor missing a metric',
            '{ "test.coverage": { "all/branches": 69.89 } }',
            `found: jterrazz.baseline.json › test.coverage: the \`all\` floor has no statements, functions, lines · why: the floor is what the suite reached, and a floor read wrong forbids nothing · fix: run \`npm run coverage\` to record the whole floor · ${READ}`,
        ],
        [
            'a key naming no scope',
            '{ "test.coverage": { "branches": 69.89 } }',
            `found: jterrazz.baseline.json › test.coverage keys \`branches\` to no scope · why: the floor is what the suite reached, and a floor read wrong forbids nothing · fix: write each key as \`<scope>/<metric>\`, or run \`npm run coverage\` to record the floor again · ${READ}`,
        ],
        [
            'a file whose floor is not a count',
            '{ "test.coverage": { "all/branches": "high" } }',
            `found: jterrazz.baseline.json keys \`test.coverage\` to something that is not a section of counts · why: the floor is what the suite reached, and a floor read wrong forbids nothing · fix: correct jterrazz.baseline.json until it is one JSON object of sections, then run again · ${READ}`,
        ],
    ])('the coverage ratchet — refuses %s in four parts, naming it', (_, text, refusal) => {
        // Given - a family file holding it
        const root = rootWith(text);

        // Then - it is refused rather than read as no floor, which would forbid nothing
        expect(readFloor(root)).toStrictEqual({ floor: {}, problem: refusal });
    });
});
