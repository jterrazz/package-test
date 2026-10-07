import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-unused-ground', () => {
    test('rejects a fixture file no test literal references', async () => {
        // Given - a feature whose __seeds__/ holds a file no test string references
        const result = await checker
            .fixture(directory('../../__fixtures__/no-unused-ground/'))
            .run();

        // Then - the checker fails with the full diagnostic naming the dead fixture
        expect(result.report).toMatch(`
            specs/widget/__seeds__/dead.sql:1:1  jterrazz-check(no-unused-ground)
                found: __seeds__/dead.sql, which no test of widget names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced — a folder's, by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete __seeds__/dead.sql, or name it from the test that stands on it
                read: docs/reference/linting.md#no-unused-ground
        `);
    });

    test('accepts a feature whose fixtures are all referenced', async () => {
        // Given - the compliant twin (only the referenced seed exists)
        const result = await checker
            .fixture(directory('../../__fixtures__/no-unused-ground-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('reports a feature dir with conventional subdirs but no *.test.ts as an orphan', async () => {
        // Given - a feature whose __expected__/ subdir exists with no test file beside it
        const result = await checker
            .fixture(directory('./__fixtures__/no-unused-ground-orphan-dir/'))
            .run();

        // Then - the orphan directory is flagged (the no-test branch)
        expect(result.report).toMatch(`
            specs/widget:1:1  jterrazz-check(no-unused-ground)
                found: a domain folder holding __expected__ and no test or document
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced — a folder's, by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: write the test that stands on __expected__, or delete the folder
                read: docs/reference/linting.md#no-unused-ground
        `);
    });

    test('refuses a dead fixture even when a test seeds from a computed name', async () => {
        // Given - a feature whose test seeds from a computed (non-literal) name
        const result = await checker
            .fixture(directory('./__fixtures__/no-unused-ground-nonliteral/'))
            .run();

        // Then - the unreferenced seed is an error like every other: a rule errors, or goes
        expect(result.report).toMatch(`
            specs/widget/__seeds__/orphaned.sql:1:1  jterrazz-check(no-unused-ground)
                found: __seeds__/orphaned.sql, which no test of widget names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced — a folder's, by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete __seeds__/orphaned.sql, or name it from the test that stands on it
                read: docs/reference/linting.md#no-unused-ground
        `);
    });

    test('reports a dead pool entry no spec references', async () => {
        // Given - a shared pool with one referenced app and one orphaned entry
        const result = await checker
            .fixture(directory('./__fixtures__/no-unused-ground-pool/'))
            .run();

        // Then - the pool-scan branch flags the orphaned entry
        expect(result.report).toMatch(`
            specs/__fixtures__/orphan.sql:1:1  jterrazz-check(no-unused-ground)
                found: the pool entry orphan.sql, which no spec under specs names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced — a folder's, by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete orphan.sql, or name it from the specs that share it
                read: docs/reference/linting.md#no-unused-ground
            specs/__fixtures__/used-app:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only widget reaches for, kept above it
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to widget/__fixtures__/used-app and name it directory('./__fixtures__/used-app/') — \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test("reports a dead entry of the specs root's __seeds__/, the shared one kept", async () => {
        // Given - a root seed two leaves share, and one no document names
        const result = await checker
            .fixture(directory('./__fixtures__/no-unused-ground-root-seed/'))
            .run();

        // Then - the unnamed seed is dead, the shared one is not
        expect(result.report).toMatch(`
            specs/__seeds__/orphan.sql:1:1  jterrazz-check(no-unused-ground)
                found: the pool entry orphan.sql, which no spec under specs names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced — a folder's, by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete orphan.sql, or name it from the specs that share it
                read: docs/reference/linting.md#no-unused-ground
            specs/__seeds__/two-users.sql:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only the leaves under api reach for, kept above them
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to api/__seeds__/two-users.sql, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it — \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
        `);
    });

    test('a reference vouches for the entry its path resolves to, never for one of the same name', async () => {
        // Given - a leaf seed and a root seed of one name, each named by one path; and a leaf copy of a root seed, the root one named
        const result = await checker
            .fixture(directory('./__fixtures__/no-unused-ground-matched-by-path/'))
            .run();

        // Then - the entry no path resolves to is dead, whichever of the two it is
        expect(result.report).toMatch(`
            specs/__seeds__/one-user.sql:1:1  jterrazz-check(ground-shared-or-inline)
                found: ground only the leaves under api reach for, kept above them
                why: A ground file exists only if it is shared, and a value lives in a test only while it stays short.
                fix: move it to api/__seeds__/one-user.sql, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it — \`typescript fix\` does both
                read: docs/reference/linting.md#ground-shared-or-inline
            specs/__seeds__/two-users.sql:1:1  jterrazz-check(no-unused-ground)
                found: the pool entry two-users.sql, which no spec under specs names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced — a folder's, by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete two-users.sql, or name it from the specs that share it
                read: docs/reference/linting.md#no-unused-ground
            specs/api/orders/__seeds__/one-user.sql:1:1  jterrazz-check(no-unused-ground)
                found: __seeds__/one-user.sql, which no test of orders names
                why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced — a folder's, by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan.
                fix: delete __seeds__/one-user.sql, or name it from the test that stands on it
                read: docs/reference/linting.md#no-unused-ground
        `);
    });

    test('a golden named by a template literal in a table is a reference, not silence', async () => {
        // Given - the form the Integration specs page prescribes for the golden half: one row per case, `toMatch(file(`./__expected__/${name}.json`))`, three goldens beside the test
        const result = await checker
            .fixture(directory('./__fixtures__/no-unused-ground-table-golden-ok/'))
            .run();

        // Then - none of the three is dead: the literal's static ends say which files the table could have asked for
        expect(result.report).toMatch('');
    });

    test('an escaped literal preceding a fixture reference does not desync quote scanning', async () => {
        // Given - a test whose escaped-newline string precedes a .seed(file('./__seeds__/used.sql')) reference
        const result = await checker
            .fixture(directory('./__fixtures__/no-unused-ground-escaped-literal-ok/'))
            .run();

        // Then - the reference is still seen; no false dead-fixture finding
        expect(result.report).toMatch('');
    });

    test('a pool entry a shared __setup__ module names after a template with a hole is a reference', async () => {
        // Given - a shared module whose template literal holds a quoted hole, and a later string naming the pool's app
        const result = await checker
            .fixture(directory('./__fixtures__/no-unused-ground-shared-setup-ok/'))
            .run();

        // Then - the app is named: the literal is read from the syntax tree, not paired quote by quote
        expect(result.report).toMatch('');
    });
});
