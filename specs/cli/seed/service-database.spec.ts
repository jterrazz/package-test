import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../db-cli.specification.js';

describe('service-database', () => {
    // RUNTIME service-urls-injected — the record key injects `<KEY>_URL` into the child process; `.env()` is for overriding it, never for restating it.
    test('runs a SQL seed against the declared service database', async () => {
        // Given - a SQL seed applied to the single sqlite service
        const result = await cli
            .fixture(directory('../_fixtures/specimen-cli/'))
            .seed(file('./_seeds/users.sql'))
            .exec('help');

        // Then - the rows are queryable through the table accessor
        expect(result.exitCode).toBe(0);
        await expect(result.table('users')).toMatch([
            [1, 'Ada'],
            [2, 'Grace'],
        ]);
    });

    test('combines a SQL seed and a file fixture in one chain', async () => {
        // Given - a SQL seed (database state) plus a file fixture (file state)
        const result = await cli
            .fixture(directory('../_fixtures/specimen-cli/'))
            .fixture(file('./_fixtures/note.txt'))
            .seed(file('./_seeds/users.sql'))
            .exec('help');

        // Then - the fixture landed in the cwd AND the SQL seed reached the db
        expect(result.file('note.txt').exists).toBe(true);
        expect(result.file('note.txt').content).toContain('hello from seed');
        await expect(result.table('users')).toMatch([
            [1, 'Ada'],
            [2, 'Grace'],
        ]);
    });

    test('a seed naming the lone database is refused as redundant, before anything runs', () => {
        // Given - the one sqlite service, named on the seed
        // Then - the option is refused where it is stated
        // checker-disable-next-line database-named-only-when-several -- the run-time twin of the rule is the subject: the name is written to be refused
        expect(() => cli.seed(file('./_seeds/users.sql'), { database: 'db' })).toThrow(
            [
                'found: seed() names a database, and "db" is the only one declared',
                'why: With two SQL databases or more, a seed or a table names the `database:` it reads, and with exactly one it names none.',
                "fix: delete { database: 'db' }",
                'read: docs/19-linting.md#database-named-only-when-several-at-runtime',
            ].join('\n'),
        );
    });

    test('a seed handed a directory, or a path as a plain string, is refused naming the one file it reads', () => {
        // Given - a caller the types do not reach, seeding a folder and then a bare path
        // Then - each is refused before anything runs, with the `file()` to write
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a directory is what the type refuses; this test IS the caller the type does not reach
        expect(() => cli.seed(directory('./_seeds/') as never)).toThrow(
            [
                'found: seed(directory("./_seeds/")), a directory where one file is read',
                'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
                "fix: name one file: seed(file('./_seeds/rows.sql'))",
                'read: docs/19-linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
        );
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a bare path is what the type refuses; this test IS the caller the type does not reach
        expect(() => cli.seed('./_seeds/users.sql' as never)).toThrow(
            [
                'found: seed("./_seeds/users.sql"), a value where a file is read',
                'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
                "fix: name one file: seed(file('./_seeds/rows.sql'))",
                'read: docs/19-linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
        );
    });

    test('a seed handed a file that is not a .sql one is refused naming the file it reads', () => {
        // Given - a caller the types do not reach, seeding a csv where the seed reads SQL
        // Then - it is refused before anything runs, with the `.sql` file to write
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a csv is what the type refuses; this test IS the caller the type does not reach
        expect(() => cli.seed(file('./_fixtures/users.csv') as never)).toThrow(
            [
                'found: seed(file("./_fixtures/users.csv")), a file not ending in .sql',
                'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
                "fix: name the .sql file seed() reads: seed(file('./_seeds/rows.sql'))",
                'read: docs/19-linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
        );
    });
});
