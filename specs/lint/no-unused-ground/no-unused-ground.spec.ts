import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-unused-ground', () => {
    test('rejects a fixture file no test literal references', async () => {
        // Given - a feature whose _seeds/ holds a file no test string references
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/no-unused-ground/'))
            .run();

        // Then - the checker fails with the full diagnostic naming the dead fixture
        expect(result.report).toMatch(`
            specs/widget/_seeds/dead.sql:1:1  jterrazz-check(no-unused-ground)
                found: _seeds/dead.sql, which no test of widget names
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete _seeds/dead.sql, or name it from the test that stands on it
                read: docs/19-linting.md#no-unused-ground
        `);
    });

    test('accepts a feature whose fixtures are all referenced', async () => {
        // Given - the compliant twin (only the referenced seed exists)
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/no-unused-ground-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('reports a feature dir with conventional subdirs but no *.test.ts as an orphan', async () => {
        // Given - a feature whose _expected/ subdir exists with no test file beside it
        const result = await checker
            .fixture(directory('./_fixtures/no-unused-ground-orphan-dir/'))
            .run();

        // Then - the orphan directory is flagged (the no-test branch)
        expect(result.report).toMatch(`
            specs/widget:1:1  jterrazz-check(no-unused-ground)
                found: a domain folder holding _expected and no test or document
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: write the test that stands on _expected, or delete the folder
                read: docs/19-linting.md#no-unused-ground
        `);
    });

    test('refuses a dead fixture even when a test seeds from a computed name', async () => {
        // Given - a feature whose test seeds from a computed (non-literal) name
        const result = await checker
            .fixture(directory('./_fixtures/no-unused-ground-nonliteral/'))
            .run();

        // Then - the unreferenced seed is an error like every other: a rule errors, or goes
        expect(result.report).toMatch(`
            specs/widget/_seeds/orphaned.sql:1:1  jterrazz-check(no-unused-ground)
                found: _seeds/orphaned.sql, which no test of widget names
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete _seeds/orphaned.sql, or name it from the test that stands on it
                read: docs/19-linting.md#no-unused-ground
        `);
    });

    test('reports a dead pool entry no spec references', async () => {
        // Given - a shared pool with one referenced app and one orphaned entry
        const result = await checker.fixture(directory('./_fixtures/no-unused-ground-pool/')).run();

        // Then - the pool-scan branch flags the orphaned entry
        expect(result.report).toMatch(`
            specs/_shared/_fixtures/orphan.sql:1:1  jterrazz-check(no-unused-ground)
                found: the pool entry orphan.sql, which no spec under specs names
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete orphan.sql, or name it from the specs that share it
                read: docs/19-linting.md#no-unused-ground
            specs/_shared/_fixtures/used-app:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only widget reaches for, kept above it
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to widget/_fixtures/used-app and name it directory('./_fixtures/used-app/') — \`make fix\` does both
                read: docs/19-linting.md#ground-shared-or-inline
        `);
    });

    test("reports a dead entry of the specs root's _seeds/, the shared one kept", async () => {
        // Given - a root seed two leaves share, and one no document names
        const result = await checker
            .fixture(directory('./_fixtures/no-unused-ground-root-seed/'))
            .run();

        // Then - the unnamed seed is dead, the shared one is not
        expect(result.report).toMatch(`
            specs/_shared/_seeds/orphan.sql:1:1  jterrazz-check(no-unused-ground)
                found: the pool entry orphan.sql, which no spec under specs names
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete orphan.sql, or name it from the specs that share it
                read: docs/19-linting.md#no-unused-ground
            specs/_shared/_seeds/two-users.sql:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only the leaves under api reach for, kept above them
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to api/_seeds/two-users.sql, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it — \`make fix\` does both
                read: docs/19-linting.md#ground-shared-or-inline
        `);
    });

    test('a reference vouches for the entry its path resolves to, never for one of the same name', async () => {
        // Given - a leaf seed and a root seed of one name, each named by one path; and a leaf copy of a root seed, the root one named
        const result = await checker
            .fixture(directory('./_fixtures/no-unused-ground-matched-by-path/'))
            .run();

        // Then - the entry no path resolves to is dead, whichever of the two it is
        expect(result.report).toMatch(`
            specs/_shared/_seeds/one-user.sql:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only the leaves under api reach for, kept above them
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to api/_seeds/one-user.sql, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it — \`make fix\` does both
                read: docs/19-linting.md#ground-shared-or-inline
            specs/_shared/_seeds/two-users.sql:1:1  jterrazz-check(no-unused-ground)
                found: the pool entry two-users.sql, which no spec under specs names
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete two-users.sql, or name it from the specs that share it
                read: docs/19-linting.md#no-unused-ground
            specs/api/orders/_seeds/one-user.sql:1:1  jterrazz-check(no-unused-ground)
                found: _seeds/one-user.sql, which no test of orders names
                why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete _seeds/one-user.sql, or name it from the test that stands on it
                read: docs/19-linting.md#no-unused-ground
        `);
    });

    test('a golden named by a template literal in a table is a reference, not silence', async () => {
        // Given - the form chapter 06 prescribes for the golden half: one row per case, `toMatch(file(`./_expected/${name}.json`))`, three goldens beside the test
        const result = await checker
            .fixture(directory('./_fixtures/no-unused-ground-table-golden-ok/'))
            .run();

        // Then - none of the three is dead: the literal's static ends say which files the table could have asked for
        expect(result.report).toMatch('');
    });

    test('an escaped literal preceding a fixture reference does not desync quote scanning', async () => {
        // Given - a test whose escaped-newline string precedes a .seed(file('./_seeds/used.sql')) reference
        const result = await checker
            .fixture(directory('./_fixtures/no-unused-ground-escaped-literal-ok/'))
            .run();

        // Then - the reference is still seen; no false dead-fixture finding
        expect(result.report).toMatch('');
    });
});
