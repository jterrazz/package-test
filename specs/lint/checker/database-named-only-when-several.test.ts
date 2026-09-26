import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('database-named-only-when-several', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a .seed() without { database } when two databases are declared', async () => {
        // Given - a spec with two SQL databases and a test that omits { database }
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/database-named-only-when-several/'))
            .exec('.');

        // Then - the checker fails with the full cross-file diagnostic
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/widget.test.ts:9:1: error jterrazz-check(database-named-only-when-several): found: \`.seed()\` with no \`{ database }\`, while 2 SQL databases are declared · why: With ≥ 2 databases, \`database:\` is required on every \`.seed()\`/\`.table()\`; with exactly one it is forbidden — checked by crossing the \`services:\` record with the calls in the tests. · fix: pass \`.seed(…, { database: '<key>' })\`, naming one of the 2 databases the services record declares · read: docs/19-linting.md#database-named-only-when-several

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('accepts seeds that name their database under a multi-database spec', async () => {
        // Given - the compliant twin (every seed names { database })
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/database-named-only-when-several-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });

    test('rejects a .seed() naming { database } when only one database is declared', async () => {
        // Given - a spec with a single SQL database and a seed that redundantly names it
        const result = await cli
            .fixture(
                directory('./fixtures/lint-violations/database-named-only-when-several-single/'),
            )
            .exec('.');

        // Then - the inverse branch fails: a lone database must not be named
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/widget.test.ts:9:1: error jterrazz-check(database-named-only-when-several): found: \`.seed()\` passes \`{ database }\`, while a single SQL database is declared · why: With ≥ 2 databases, \`database:\` is required on every \`.seed()\`/\`.table()\`; with exactly one it is forbidden — checked by crossing the \`services:\` record with the calls in the tests. · fix: delete the \`{ database }\` option of \`.seed()\` · read: docs/19-linting.md#database-named-only-when-several

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('a checker-disable-next-line comment suppresses the database-named-only-when-several finding', async () => {
        // Given - a two-database spec whose seed omits { database } but is suppressed with a reason
        const result = await cli
            .fixture(
                directory(
                    './fixtures/lint-violations/database-named-only-when-several-suppressed/',
                ),
            )
            .exec('.');

        // Then - the suppression clears the finding: a clean pass
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
