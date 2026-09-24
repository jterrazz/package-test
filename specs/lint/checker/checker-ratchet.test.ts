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
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: nothing held\n');
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

    test("`--fix` applies the plugin's own fixes when the root arms it through `extends`", async () => {
        // Given - the same project, its plugin and the other fixer armed only by a config the root extends
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-own-fixes/'))
            .fixture(
                file('./fixtures/lint-violations/checker-own-fixes-extended/oxlint.config.mjs'),
            )
            .exec('. --fix');

        // Then - the view written and held, the other fixer still left to the toolchain
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: nothing held\n');
        expect(result.file('specs/api/events/list/pagination.spec.ts').content).toContain(
            "const events = api.with({ clock: '2026-03-04T09:30:00Z' });",
        );
        expect(result.file('src/nothing.ts').content).toContain('nothing(undefined)');
    });

    test('`--fix` settles a JSON root that extends a commented JSON, and a `.jsonc` subtree, in one run', async () => {
        // Given - recorded debt in two trees: the root's `.oxlintrc.json` extends a commented JSON, and a commented `.oxlintrc.jsonc` governs web/
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-own-fixes-json/'))
            .exec(['baseline .', '. --fix']);

        // Then - both views written, the debt paid, nothing held
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe(
            [
                'conventions checker: re-recorded jterrazz.baseline.json › test › jterrazz/b16w-file-context 2 → 0',
                'jterrazz.baseline.json › test: nothing held',
                '',
            ].join('\n'),
        );
        for (const tree of ['', 'web/']) {
            expect(
                result.file(`${tree}specs/api/events/list/pagination.spec.ts`).content,
            ).toContain("const events = api.with({ clock: '2026-03-04T09:30:00Z' });");
        }
    });

    test("`--fix` renames before the plugin's own fixes, so the check after it counts the same tree", async () => {
        // Given - a spec still named `.test.ts`, whose chains all state one clock, fixed on the root member
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-own-fixes/'))
            .fixture(directory('./fixtures/lint-violations/checker-own-fixes-moved/'))
            .exec(['--member . --fix', '--member .']);

        // Then - the renamed and moved spec carries its view, and the check after the fix holds nothing
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: nothing held\n');
        expect(result.file('specs/api/events/archive/archive.test.ts').exists).toBe(false);
        expect(result.file('specs/api/archive/get/archive.spec.ts').content).toBe(
            [
                "import { describe, expect, test } from 'vitest';",
                '',
                "import { api } from '../../api.specification.js';",
                '',
                "const archive = api.with({ clock: '2026-03-04T09:30:00Z' });",
                '',
                "describe('archive', () => {",
                "    test('lists the archive', async () => {",
                '        // Given - the calendar the file reads',
                "        const result = await archive.get('/archive');",
                '',
                '        // Then - the whole page',
                '        expect(result.response).toMatch(`HTTP/1.1 200 OK`);',
                '    });',
                '',
                "    test('lists the archive of a year', async () => {",
                '        // Given - the same calendar',
                "        const result = await archive.get('/archive?year=2025');",
                '',
                '        // Then - the whole page',
                '        expect(result.response).toMatch(`HTTP/1.1 200 OK`);',
                '    });',
                '});',
                '',
            ].join('\n'),
        );
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

    test('a green run over a section that holds nothing prints `nothing held`', async () => {
        // Given - a clean project, recorded — an emptied section — then judged
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures-ok/'))
            .exec(['baseline .', '.']);

        // Then - the same line as a project that keeps no section, never a count of nothing
        expect(result.exitCode).toBe(0);
        expect(result.file('jterrazz.baseline.json').content).toBe('{\n    "test": {}\n}\n');
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: nothing held\n');
    });
});
