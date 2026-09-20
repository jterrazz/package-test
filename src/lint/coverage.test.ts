import { describe, expect, test } from 'vitest';

import { drops, raised, report } from './coverage.js';

const floor = { branches: 70, functions: 80, lines: 76, statements: 76 };

describe('the coverage ratchet', () => {
    test('says nothing when every metric holds its floor', () => {
        // Given - a run that matches the floor exactly
        const now = { ...floor };

        // Then - equal is not a drop: the gate asks "worse than last time", not "better"
        expect(drops(floor, now)).toStrictEqual([]);
    });

    test('names every metric that fell, and by how much', () => {
        // Given - a run that lost statements and functions
        const now = { ...floor, functions: 79.5, statements: 74.25 };

        // Then - one line per metric, each carrying both numbers
        expect(drops(floor, now)).toStrictEqual([
            'statements fell to 74.25% — the floor is 76.00%',
            'functions fell to 79.50% — the floor is 80.00%',
        ]);
    });

    test('has nothing to say before a floor exists', () => {
        // Given - the first run of a project, with no recorded floor
        // Then - the ratchet does not fail a run it has no comparison for
        expect(drops(undefined, floor)).toStrictEqual([]);
    });

    test('raises each metric on its own', () => {
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

    test('starts from zero when nothing was recorded', () => {
        // Given - no floor at all
        // Then - the first run IS the floor
        expect(raised(undefined, floor)).toStrictEqual(floor);
    });

    test('reports the four metrics in one line, in the order it always prints them', () => {
        // Given - a recorded scope
        // Then - statements, branches, functions, lines — the order v8's own summary uses
        expect(report('all', floor)).toBe(
            'all: statements 76.00%, branches 70.00%, functions 80.00%, lines 76.00%',
        );
    });
});
