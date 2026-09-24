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

    test("`--fix` applies the plugin's own fixes before it counts: one run settles what they write", async () => {
        // Given - every chain of a spec states one clock, and another rulebook's fixer is armed
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-own-fixes/'))
            .exec('. --fix');

        // Then - the view written and held, the other fixer left to the toolchain, no wrapper behind
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: 0 held across 0 rules\n');
        expect(result.file('specs/api/events/list/pagination.spec.ts').content).toBe(
            [
                "import { describe, expect, test } from 'vitest';",
                '',
                "import { api } from '../../api.specification.js';",
                '',
                "const events = api.with({ clock: '2026-03-04T09:30:00Z' });",
                '',
                "describe('pagination', () => {",
                "    test('lists the first page', async () => {",
                '        // Given - the calendar the file reads',
                "        const result = await events.get('/events');",
                '',
                '        // Then - the whole page',
                '        expect(result.response).toMatch(`HTTP/1.1 200 OK`);',
                '    });',
                '',
                "    test('lists the second page', async () => {",
                '        // Given - the same calendar',
                "        const result = await events.get('/events?page=2');",
                '',
                '        // Then - the whole page',
                '        expect(result.response).toMatch(`HTTP/1.1 200 OK`);',
                '    });',
                '});',
                '',
            ].join('\n'),
        );
        expect(result.file('src/nothing.ts').content).toBe(
            "export function nothing(value?: string): string {\n    return value ?? 'nothing';\n}\n\nexport const empty = nothing(undefined);\n",
        );
        expect(result.file('oxlint.test-fix.config.mjs').exists).toBe(false);
    });

    test('`--fix` refuses a report written before its fixes', async () => {
        // Given - the fixable project, and a report handed in beside the fixer
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-own-fixes/'))
            .exec('. --fix --oxlint-report package.json');

        // Then - the run stops before it writes, naming the flag to drop
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            conventions checker: \`--fix\` counts what its own fixes leave, and a report written before them counts the tree they changed — drop \`--oxlint-report\`
        `);
    });
});
