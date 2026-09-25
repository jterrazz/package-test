import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('c9-dead-fixtures', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a fixture file no test literal references', async () => {
        // Given - a feature whose seeds/ holds a file no test string references
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures/'))
            .exec('.');

        // Then - the checker fails with the full diagnostic naming the dead fixture
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/seeds/dead.sql:1:1: error jterrazz-check(c9): found: seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#c9-dead-fixtures

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('accepts a feature whose fixtures are all referenced', async () => {
        // Given - the compliant twin (only the referenced seed exists)
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });

    test('reports a feature dir with conventional subdirs but no *.test.ts as an orphan', async () => {
        // Given - a feature whose expected/ subdir exists with no test file beside it
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-orphan-dir/'))
            .exec('.');

        // Then - the orphan directory is flagged (the no-test branch)
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget:1:1: error jterrazz-check(c9): found: a domain folder holding expected and no test or document · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: write the test that stands on expected, or delete the folder · read: docs/19-linting.md#c9-dead-fixtures

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('downgrades a dead fixture to a warning when a test uses a non-literal fixture arg', async () => {
        // Given - a feature whose test seeds from a computed (non-literal) name
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-nonliteral-warn/'))
            .exec('.');

        // Then - the unreferenced seed is advisory only (warn, exit 0)
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            specs/widget/seeds/orphaned.sql:1:1: warning jterrazz-check(c9): found: seeds/orphaned.sql, which no test of widget names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete seeds/orphaned.sql, or name it from the test that stands on it · read: docs/19-linting.md#c9-dead-fixtures
        `);
    });

    test('reports a dead pool entry no spec references', async () => {
        // Given - a shared pool with one referenced app and one orphaned entry
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-pool/'))
            .exec('.');

        // Then - the pool-scan branch flags the orphaned entry
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/shared/fixtures/orphan.sql:1:1: error jterrazz-check(c9): found: the pool entry orphan.sql, which no spec under specs names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete orphan.sql, or name it from the specs that share it · read: docs/19-linting.md#c9-dead-fixtures
            specs/shared/fixtures/used-app:1:1: error jterrazz-check(c28): found: a pool entry only widget reaches for · why: A ground file exists only if it is shared, and a value lives in a test only while it stays short. · fix: move it to widget/fixtures/used-app and name it directory('./fixtures/used-app/') — \`make fix\` does both · read: docs/19-linting.md#c28-ground-shared-or-inline

            conventions checker: 2 error(s) found under {{workdir}}
        `);
    });

    test("reports a dead entry of the specs root's seeds/, the shared one kept", async () => {
        // Given - a root seed two leaves share, and one no document names
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-root-seed/'))
            .exec('.');

        // Then - the unnamed seed is dead, the shared one is not
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/shared/seeds/orphan.sql:1:1: error jterrazz-check(c9): found: the pool entry orphan.sql, which no spec under specs names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete orphan.sql, or name it from the specs that share it · read: docs/19-linting.md#c9-dead-fixtures

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('a reference vouches for the entry its path resolves to, never for one of the same name', async () => {
        // Given - a leaf seed and a root seed of one name, each named by one path; and a leaf copy of a root seed, the root one named
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-matched-by-path/'))
            .exec('.');

        // Then - the entry no path resolves to is dead, whichever of the two it is
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/api/orders/seeds/one-user.sql:1:1: error jterrazz-check(c9): found: seeds/one-user.sql, which no test of orders names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete seeds/one-user.sql, or name it from the test that stands on it · read: docs/19-linting.md#c9-dead-fixtures
            specs/shared/seeds/two-users.sql:1:1: error jterrazz-check(c9): found: the pool entry two-users.sql, which no spec under specs names · why: No dead fixtures: every file under \`seeds/\`/\`requests/\`/\`fixtures/\` and every top-level entry of \`expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete two-users.sql, or name it from the specs that share it · read: docs/19-linting.md#c9-dead-fixtures

            conventions checker: 2 error(s) found under {{workdir}}
        `);
    });

    test('a golden named by a template literal in a table is a reference, not silence', async () => {
        // Given - the form chapter 06 prescribes for the golden half: one row per case, `toMatch(file(`./expected/${name}.json`))`, three goldens beside the test
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-table-golden-ok/'))
            .exec('.');

        // Then - none of the three is dead: the literal's static ends say which files the table could have asked for
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });

    test('an escaped literal preceding a fixture reference does not desync quote scanning', async () => {
        // Given - a test whose escaped-newline string precedes a .seed(file('./seeds/used.sql')) reference
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-escaped-literal-ok/'))
            .exec('.');

        // Then - the reference is still seen; no false dead-fixture finding
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
