import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';
// A runner with a single SQL database — DB_URL and the unambiguous
// DATABASE_URL alias are both injected (CONVENTIONS B6).
import { cli as dbCli } from '../db-cli.specification.js';

/*
 * Scalpel by design: the `env` fixture dumps the whole child environment (PATH, HOME,
 * temp workdirs, injected service URLs with ephemeral ports) — a full snapshot is
 * unstable by nature. Each test probes the one variable whose injection/merge/unset
 * behaviour it exercises.
 */
/* oxlint-disable jterrazz/d8w-text-bypass -- A full-output golden is unstable here
   (the env dump carries ephemeral ports/paths, see the note above); grepping the one
   variable under test via `.text` is the sanctioned scalpel, not a bypass. */

describe('command — env', () => {
    test('passes user-supplied env vars to the process', async () => {
        // Given - a custom env var
        const result = await cli.fixture('$FIXTURES/cli-app/').env({ MY_VAR: 'hello' }).exec('env');

        // Then - the command sees it
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('MY_VAR=hello');
    });

    test('merges multiple .env() calls', async () => {
        // Given - two .env() calls setting different keys
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .env({ MY_VAR: 'first' })
            .env({ EXTRA: 'second' })
            .exec('env');

        // Then - the child sees both variables
        expect(result.stdout.text).toContain('MY_VAR=first');
        expect(result.stdout.text).toContain('EXTRA=second');
    });

    test('the later .env() call wins for the same key', async () => {
        // Given - the same key set by two successive .env() calls
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .env({ MY_VAR: 'first' })
            .env({ MY_VAR: 'second' })
            .exec('env');

        // Then - the last value reaches the child
        expect(result.stdout.text).toContain('MY_VAR=second');
        expect(result.stdout.text).not.toContain('MY_VAR=first');
    });

    test('expands $WORKDIR token to the actual cwd', async () => {
        // Given - $WORKDIR placeholder for HOME (the typical isolation pattern)
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .env({ HOME: '$WORKDIR' })
            .exec('env');

        // Then - HOME points to a real (non-default) path
        expect(result.exitCode).toBe(0);
        const homeLine = result.stdout.text.split('\n').find((l: string) => l.startsWith('HOME='));
        expect(homeLine).toBeDefined();
        expect(homeLine).not.toBe('HOME=unset');
        expect(homeLine).toContain('/spec-command-');
    });

    test('null value unsets a variable', async () => {
        // Given - set then unset (HOME is set on the host)
        const result = await cli.fixture('$FIXTURES/cli-app/').env({ HOME: null }).exec('env');

        // Then - the child sees the variable as unset
        expect(result.stdout.text).toContain('HOME=unset');
    });

    test('env without .env() keeps process.env intact', async () => {
        // Given - no .env() — host PATH should still be available so the script runs
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('env');

        // Then - HOME should be the host's HOME, not "unset"
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('HOME=unset');
    });
});

describe('command — automatic service env injection (CONVENTIONS B6)', () => {
    test('injects <KEY>_URL for every declared service', async () => {
        // Given - a runner declaring { db: sqlite() }
        const result = await dbCli.exec('env');

        // Then - DB_URL carries the connection string
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toMatch(/DB_URL=file:/);
    });

    test('injects the DATABASE_URL alias when exactly one SQL database is declared', async () => {
        // Given - a single SQL database in the record
        const result = await dbCli.exec('env');

        // Then - the unambiguous alias points at the same database
        const lines = result.stdout.text.split('\n');
        const dbUrl = lines.find((l) => l.startsWith('DB_URL='))!.slice('DB_URL='.length);
        const databaseUrl = lines
            .find((l) => l.startsWith('DATABASE_URL='))!
            .slice('DATABASE_URL='.length);
        expect(databaseUrl).toBe(dbUrl);
    });

    test('does not inject REDIS_URL when no redis is declared', async () => {
        // Given - a record without a redis handle
        const result = await dbCli.exec('env');

        // Then - the alias is absent
        expect(result.stdout.text).toContain('REDIS_URL=unset');
    });

    test('.env() overrides the injected values and null unsets them', async () => {
        // Given - explicit overrides on top of the injection
        const result = await dbCli.env({ DATABASE_URL: null, DB_URL: 'custom://url' }).exec('env');

        // Then - user env wins; null removed the alias
        expect(result.stdout.text).toContain('DB_URL=custom://url');
        expect(result.stdout.text).toContain('DATABASE_URL=unset');
    });

    test('runner without services injects nothing', async () => {
        // Given - the plain runner (no services record)
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('env');

        // Then - no URL vars appear in the child env
        expect(result.stdout.text).toContain('DB_URL=unset');
        expect(result.stdout.text).toContain('DATABASE_URL=unset');
    });
});
