import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — c9 dead fixtures (CONVENTIONS C9)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply.
    test('rejects a fixture file no test literal references', async () => {
        // Given - a feature whose seeds/ holds a file no test string references
        const result = await cli.fixture('$FIXTURES/lint-violations/c9-dead-fixtures/').exec('.');

        // Then - the checker fails with the full diagnostic naming the dead fixture
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c9-dead-fixtures.txt');
    });

    test('accepts a feature whose fixtures are all referenced', async () => {
        // Given - the compliant twin (only the referenced seed exists)
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c9-dead-fixtures-ok/')
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });

    test('reports a feature dir with conventional subdirs but no *.test.ts as an orphan', async () => {
        // Given - a feature whose expected/ subdir exists with no test file beside it
        const result = await cli.fixture('$FIXTURES/lint-violations/c9-orphan-dir/').exec('.');

        // Then - the orphan directory is flagged (the no-test branch)
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c9-orphan-dir.txt');
    });

    test('downgrades a dead fixture to a warning when a test uses a non-literal fixture arg', async () => {
        // Given - a feature whose test seeds from a computed (non-literal) name
        const result = await cli.fixture('$FIXTURES/lint-violations/c9-nonliteral-warn/').exec('.');

        // Then - the unreferenced seed is advisory only (warn, exit 0)
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch('c9-nonliteral-warn.txt');
    });

    test('reports a dead $FIXTURES pool entry no spec references', async () => {
        // Given - a shared pool with one referenced app and one orphaned entry
        const result = await cli.fixture('$FIXTURES/lint-violations/c9-dead-pool/').exec('.');

        // Then - the pool-scan branch flags the orphaned entry
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c9-dead-pool.txt');
    });

    test('an escaped literal preceding a fixture reference does not desync quote scanning', async () => {
        // Given - a test whose escaped-newline string precedes a .seed('used.sql') reference
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c9-escaped-literal-ok/')
            .exec('.');

        // Then - the reference is still seen; no false dead-fixture finding
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
