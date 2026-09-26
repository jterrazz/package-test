import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { BASELINE_FILE, drops, raised, readBaseline, report } from './floor.js';

function rootWith(contents: string): string {
    const root = mkdtempSync(join(tmpdir(), 'coverage-baseline-'));
    writeFileSync(join(root, BASELINE_FILE), contents);
    return root;
}

const floor = { branches: 70, functions: 80, lines: 76, statements: 76 };

describe('floor', () => {
    test('the coverage ratchet — says nothing when every metric holds its floor', () => {
        // Given - a run that matches the floor exactly
        const now = { ...floor };

        // Then - equal is not a drop: the gate asks "worse than last time", not "better"
        expect(drops(floor, now)).toStrictEqual([]);
    });

    test('the coverage ratchet — names every metric that fell, and by how much', () => {
        // Given - a run that lost statements and functions
        const now = { ...floor, functions: 79.5, statements: 74.25 };

        // Then - one line per metric, each carrying both numbers
        expect(drops(floor, now)).toStrictEqual([
            'statements fell to 74.25% — the floor is 76.00%',
            'functions fell to 79.50% — the floor is 80.00%',
        ]);
    });

    test('the coverage ratchet — has nothing to say before a floor exists', () => {
        // Given - the first run of a project, with no recorded floor
        // Then - the ratchet does not fail a run it has no comparison for
        expect(drops(undefined, floor)).toStrictEqual([]);
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
        // Given - a baseline whose `all` entry carries branches alone
        const root = rootWith('{ "all": { "branches": 69.89 } }');

        // Then - it is refused rather than read as three floors of zero, which would forbid nothing
        expect(() => readBaseline(root)).toThrow(/statements, functions, lines/u);
    });

    test('the coverage ratchet — reads a complete floor', () => {
        // Given - a baseline with the four metrics
        const root = rootWith(
            '{ "all": { "branches": 1, "functions": 2, "lines": 3, "statements": 4 } }',
        );

        // Then - the four come back, rounded the way the file records them
        expect(readBaseline(root).all).toStrictEqual({
            branches: 1,
            functions: 2,
            lines: 3,
            statements: 4,
        });
    });

    test('what the count reaches — the child processes the suite spawns (meta-test) — every child is counted, and judged on the source its bundle maps back to', async () => {
        // Given - this repository's own config, which the documents running `dist/checker.js` run under
        const { default: config } = await import('../../../vitest.config.js');
        const coverage = config.test?.coverage;

        // Then - children attached, `dist/` read, and every path judged after the remap
        expect(
            coverage?.provider === 'v8'
                ? {
                      afterRemap: coverage.excludeAfterRemap,
                      attached: coverage.autoAttachSubprocess,
                      distRead: !(coverage.exclude ?? []).includes('dist/**'),
                  }
                : coverage,
        ).toStrictEqual({ afterRemap: true, attached: true, distRead: true });
    });

    test('what the count reaches — the child processes the suite spawns (meta-test) — every bundle carries the map back to its modules, and the tarball none of them', async () => {
        // Given - the build groups, and the files the package publishes
        const { default: groups } = await import('../../../tsdown.config.js');
        const manifest: unknown = JSON.parse(
            readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8'),
        );
        const files: unknown =
            typeof manifest === 'object' && manifest !== null && 'files' in manifest
                ? manifest.files
                : [];

        // Then - a map from every group, and none shipped
        expect({
            mapped: [groups].flat().map((group) => group.sourcemap),
            shipped: !(Array.isArray(files) && files.includes('!dist/**/*.map')),
        }).toStrictEqual({ mapped: [true, true, true], shipped: false });
    });
});
