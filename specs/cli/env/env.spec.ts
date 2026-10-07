import { directory, file } from '@jterrazz/test';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { cli } from '../cli.specification.js';
// invariant: a single SQL database: DB_URL and the unambiguous DATABASE_URL are both injected (`service-urls-injected`).
import { cli as dbCli } from '../db-cli.specification.js';
import { cli as defaultsCli } from '../defaults-cli.specification.js';

/* invariant: the `env` fixture dumps the whole child environment, ephemeral ports included: each test probes its one variable (`output-asserted-as-a-golden` scalpel). */

/** macOS's own `$TMPDIR` shape (`/var` → `/private/var`), made explicit so the guard holds on Linux: only the resolved spelling is what a child reports. */
async function underSymlinkedTmp<T>(action: () => Promise<T>): Promise<T> {
    const realTmp = realpathSync(tmpdir());
    const base = mkdtempSync(resolve(realTmp, 'spec-symlinked-'));
    const target = resolve(base, 'real');
    const link = resolve(base, 'link');
    mkdirSync(target);
    symlinkSync(target, link, 'dir');
    vi.stubEnv('TMPDIR', link);
    try {
        return await action();
    } finally {
        vi.unstubAllEnvs();
        rmSync(base, { force: true, recursive: true });
    }
}

describe('env', () => {
    test('passes user-supplied env vars to the process', async () => {
        // Given - a custom env var
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .env({ MY_VAR: 'hello' })
            .exec('env');

        // Then - the command sees it
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('MY_VAR=hello');
    });

    test('a view made with() starts every command from the file’s environment', async () => {
        // Given - the environment a whole file shares, and one chain adding to it
        const shared = cli.with({ env: { MY_VAR: 'shared' } });
        const result = await shared
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .env({ EXTRA: 'own' })
            .exec('env');

        // Then - the command sees both, the file's and the chain's
        expect(result.stdout.text).toContain('MY_VAR=shared');
        expect(result.stdout.text).toContain('EXTRA=own');
    });

    test('merges multiple .env() calls', async () => {
        // Given - two .env() calls setting different keys
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
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
            .fixture(directory('../__fixtures__/specimen-cli/'))
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
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .env({ HOME: '$WORKDIR' })
            .exec('env');

        // Then - HOME points to a real (non-default) path
        expect(result.exitCode).toBe(0);
        const homeLine = result.stdout.text.split('\n').find((l: string) => l.startsWith('HOME='));
        expect(homeLine).toBeDefined();
        expect(homeLine).not.toBe('HOME=unset');
        expect(homeLine).toContain('/spec-command-');
    });

    test('$WORKDIR in a document env: expands to that same path', async () => {
        // Given - the same pair declared inline in a spec document, whose stdout block asserts {{workdir}}/sub
        const result = await underSymlinkedTmp(
            async () => await cli.run(file('./expanded-workdir.spec.yaml')),
        );

        // Then - the document passed through the other door too
        expect(result.exitCode).toBe(0);
    });

    test("a chained .env() lies under a document's env:", async () => {
        // Given - a chain stating two variables, and a document stating one of them again
        const result = await cli
            .env({ EXTRA: 'from-the-chain', MY_VAR: 'from-the-chain' })
            .run(file('./under-document.spec.yaml'));

        // Then - the document's run saw the chain's variable, and the document's own value where both state one
        expect(result.exitCode).toBe(0);
    });

    test('null value unsets a variable', async () => {
        // Given - set then unset (HOME is set on the host)
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .env({ HOME: null })
            .exec('env');

        // Then - the child sees the variable as unset
        expect(result.stdout.text).toContain('HOME=unset');
    });

    test('env without .env() keeps process.env intact', async () => {
        // Given - no .env() — host PATH should still be available so the script runs
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('env');

        // Then - HOME should be the host's HOME, not "unset"
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).not.toContain('HOME=unset');
    });

    test('injects <KEY>_URL for every declared service', async () => {
        // Given - a runner declaring { db: sqlite() }
        const result = await dbCli.exec('env');

        // Then - DB_URL carries the connection string
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toMatch(/DB_URL=file:/u);
    });

    test('injects the DATABASE_URL alias when exactly one SQL database is declared', async () => {
        // Given - a single SQL database in the record
        const result = await dbCli.exec('env');

        // Then - the unambiguous alias points at the same database
        const lines = result.stdout.text.split('\n');
        const valueOf = (name: string): string | undefined =>
            lines.find((line) => line.startsWith(`${name}=`))?.slice(`${name}=`.length);
        expect(valueOf('DB_URL')).toMatch(/^\S+$/u);
        expect(valueOf('DATABASE_URL')).toBe(valueOf('DB_URL'));
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
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('env');

        // Then - no URL vars appear in the child env
        expect(result.stdout.text).toContain('DB_URL=unset');
        expect(result.stdout.text).toContain('DATABASE_URL=unset');
    });

    test('applies to a run that states nothing', async () => {
        // Given - a runner declaring defaults, and a run that adds nothing
        const result = await defaultsCli.exec('env');

        // Then - both defaults reached the child
        expect(result.stdout.text).toContain('MY_VAR=from-defaults');
        expect(result.stdout.text).toContain('EXTRA=from-defaults');
    });

    test('yields to the chain that states its own', async () => {
        // Given - a chain overriding one of the two
        const result = await defaultsCli.env({ MY_VAR: 'from-the-chain' }).exec('env');

        // Then - the chain wins on its own, the default holds on the other
        expect(result.stdout.text).toContain('MY_VAR=from-the-chain');
        expect(result.stdout.text).toContain('EXTRA=from-defaults');
    });
});
