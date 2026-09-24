import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('lint — checker CLI, the ratchet is exact', () => {
    test('a count below its entry breaks the ratchet: the debt fell, and the entry says so', async () => {
        // Given - one dead fixture, held by an entry of three, and an entry whose rule is at zero
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures/'))
            .fixture(file('./fixtures/lint-violations/fallen-baseline/jterrazz.baseline.json'))
            .exec('.');

        // Then - both falls, each naming its gesture; the run's own key is never the checker's
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/seeds/dead.sql:1:1: error jterrazz-check(c9): found: seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#c9-dead-fixtures
            baseline-ratchet  jterrazz.baseline.json › test  jterrazz-check/c9 is at 1, below its baseline of 3 — the debt fell, \`--fix\` re-records it
            baseline-ratchet  jterrazz.baseline.json › test  jterrazz-check/c15 is at zero — the ratchet moved, delete its entry
            Run 'jterrazz-test-check baseline' to record where the project stands.
        `);
    });

    test('`--fix` re-records what fell, and the run it records is held', async () => {
        // Given - the same fallen ratchet, fixed
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures/'))
            .fixture(file('./fixtures/lint-violations/fallen-baseline/jterrazz.baseline.json'))
            .exec('. --fix');

        // Then - each entry at its count, the paid one gone, the run's key and the other section kept
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe(
            [
                'conventions checker: re-recorded jterrazz.baseline.json › test › jterrazz-check/c15 2 → 0',
                'conventions checker: re-recorded jterrazz.baseline.json › test › jterrazz-check/c9 3 → 1',
                'jterrazz.baseline.json › test: 1 held across 1 rule',
                '',
            ].join('\n'),
        );
        expect(result.file('jterrazz.baseline.json').content).toBe(
            '{\n    "typescript": { "eslint/complexity": 3 },\n    "test": {\n        "jterrazz-check/c9": 1,\n        "routes/unreached": 2\n    }\n}\n',
        );
    });

    test('`--fix` never records debt that grew: a new key stays a breach', async () => {
        // Given - a paid entry and an unrecorded finding, fixed
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-ratchet/'))
            .exec('. --fix');

        // Then - the paid entry goes, the new debt still fails the run and is not written
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toBe(
            'conventions checker: re-recorded jterrazz.baseline.json › test › jterrazz-check/c14 1 → 0\n',
        );
        expect(result.stderr).toMatch(`
            specs/widget/seeds/dead.sql:1:1: error jterrazz-check(c9): found: seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#c9-dead-fixtures
            baseline-ratchet  jterrazz.baseline.json › test  jterrazz-check/c9 has 1 finding(s) and no entry — it is new debt
            Run 'jterrazz-test-check baseline' to record where the project stands.
        `);
        expect(result.file('jterrazz.baseline.json').content).toBe(
            '{\n    "typescript": { "eslint/complexity": 3 },\n    "test": {}\n}\n',
        );
    });
});
