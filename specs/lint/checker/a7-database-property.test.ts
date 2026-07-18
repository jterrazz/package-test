import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — a7 database property (CONVENTIONS A7)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (third-party linters) does not apply — the
    // Whole stderr is asserted, tokens covering the run cwd.
    test('rejects a .seed() without { database } when two databases are declared', async () => {
        // Given - a spec with two SQL databases and a test that omits { database }
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a7-database-property/')
            .exec('.');

        // Then - the checker fails with the full cross-file diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('a7-database-property.txt');
    });

    test('accepts seeds that name their database under a multi-database spec', async () => {
        // Given - the compliant twin (every seed names { database })
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a7-database-property-ok/')
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });

    test('rejects a .seed() naming { database } when only one database is declared', async () => {
        // Given - a spec with a single SQL database and a seed that redundantly names it
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a7-database-single-forbidden/')
            .exec('.');

        // Then - the inverse branch fails: a lone database must not be named
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('a7-database-single-forbidden.txt');
    });

    test('a checker-disable-next-line comment suppresses the A7 finding', async () => {
        // Given - a two-database spec whose seed omits { database } but is suppressed with a reason
        const result = await cli
            .fixture('$FIXTURES/lint-violations/a7-database-suppressed/')
            .exec('.');

        // Then - the suppression clears the finding: a clean pass
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
