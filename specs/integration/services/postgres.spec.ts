import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { file, postgres } from '../../../src/index.js';
import { integration } from '../integration.specification.js';

/*
 * The postgres seam, met the way a consumer meets it: the facet starts the
 * container, the chain hands the started handle to the call, and every chain
 * begins on a reset database. What needs no container — the refusals a handle
 * answers before it ever connects — is a module test beside `postgres.ts`.
 */

describe('postgres', () => {
    test('builds a connection string carrying the credentials and the database', async () => {
        // Given - the service the runner started
        const result = await integration.call(({ db }) => {
            const url = new URL(db.connectionString);
            return { database: url.pathname, protocol: url.protocol, username: url.username };
        });

        // Then - the parts a consumer reads come from the compose file
        expect(result.value).toMatch({
            database: '/test',
            protocol: 'postgresql:',
            username: 'test',
        });
    });

    test('runs on a memory disk with every crash-only write turned off', async () => {
        // Given - the durability settings the started server answers with
        const result = await integration.call(async ({ db }) => {
            const { Client } = await import('pg');
            const client = new Client({ connectionString: db.connectionString });
            await client.connect();
            try {
                const settings = await client.query<{ name: string; setting: string }>(
                    "SELECT name, setting FROM pg_settings WHERE name IN ('fsync', 'full_page_writes', 'synchronous_commit') ORDER BY name",
                );
                return settings.rows.map(({ name, setting }) => [name, setting]);
            } finally {
                await client.end();
            }
        });

        // Then - a test database pays for no write that only survives a crash
        expect(result.value).toMatch([
            ['fsync', 'off'],
            ['full_page_writes', 'off'],
            ['synchronous_commit', 'off'],
        ]);
    });

    test('passes its healthcheck on a reachable container', async () => {
        // Given - the started service asked whether it answers
        const result = await integration.call(async ({ db }) => {
            await db.healthcheck();
        });

        // Then - it resolved, and refused nothing
        expect(result.error.text).toBe('');
    });

    test('executes the statements it is handed', async () => {
        // Given - one row inserted through the handle
        const result = await integration.call(async ({ db }) => {
            await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')");
            return await db.query('users', ['name']);
        });

        // Then - the row is readable
        expect(result.value).toMatch([['Alice']]);
    });

    test('executes every statement of a seed file', async () => {
        // Given - a seed file holding two inserts
        const result = await integration
            .seed(file('../../shared/seeds/two-users.sql'))
            .call(async ({ db }) => await db.query('users', ['name']));

        // Then - both rows landed
        expect(result.value).toMatch([['Alice'], ['Bob']]);
    });

    test('returns rows as value arrays, in the column order asked for', async () => {
        // Given - two seeded users, the columns requested in reverse
        const result = await integration
            .seed(file('../../shared/seeds/two-users.sql'))
            .call(async ({ db }) => await db.query('users', ['email', 'name']));

        // Then - each row is a value array following the requested order
        expect(result.value).toMatch([
            ['alice@test.com', 'Alice'],
            ['bob@test.com', 'Bob'],
        ]);
    });

    test('starts every chain on an empty table', async () => {
        // Given - a chain that seeded, then a chain that only reads
        await integration
            .seed(file('../../shared/seeds/two-users.sql'))
            .call(async ({ db }) => await db.query('users', ['name']));
        const result = await integration.call(async ({ db }) => await db.query('users', ['name']));

        // Then - the second chain never saw the first one's rows
        expect(result.value).toMatch([]);
    });

    test('truncates every table on reset, its generated ids restarted, and takes rows again afterwards', async () => {
        // Given - seeded rows, a reset, then one insert
        const result = await integration
            .seed(file('../../shared/seeds/two-users.sql'))
            .call(async ({ db }) => {
                await db.reset();
                await db.seed(
                    "INSERT INTO \"users\" (name, email) VALUES ('Second', 'second@test.com')",
                );
                return await db.query('users', ['id', 'name']);
            });

        // Then - only the row written after the reset remains, numbered from 1 again
        expect(result.value).toMatch([[1, 'Second']]);
    });

    test('names the columns of a table in the order the table declares them', async () => {
        // Given - the users table the compose init declares
        const result = await integration.call(async ({ db }) => await db.columns('users'));

        // Then - every column, in its order
        expect(result.value).toMatch(['id', 'name', 'email']);
    });

    test('runs the init script the compose directory carries', async () => {
        // Given - a docker/ directory holding postgres/init.sql
        const result = await integration.call(async ({ db }) => {
            const dockerDir = mkdtempSync(resolve(tmpdir(), 'postgres-init-'));
            mkdirSync(resolve(dockerDir, 'postgres'), { recursive: true });
            writeFileSync(
                resolve(dockerDir, 'postgres/init.sql'),
                'CREATE TABLE IF NOT EXISTS "init_probe" (id SERIAL, val TEXT);' +
                    ' INSERT INTO "init_probe" (val) VALUES (\'ok\');',
            );
            const initDb = postgres();
            initDb.serviceName = 'db';
            initDb.connectionString = db.connectionString;
            initDb.started = true;

            await initDb.initialize(dockerDir);
            const rows = await db.query('init_probe', ['val']);
            await db.seed('DROP TABLE "init_probe"');
            return rows;
        });

        // Then - the script ran against the real database
        expect(result.value).toMatch([['ok']]);
    });

    /*
     * CONVENTIONS D11 scalpel (e): the reason inside each message is
     * postgres's own wording, unstable across image versions — probe the
     * framework's half of the sentence, never snapshot the driver's.
     */

    test('what the database refuses — a failing statement surfaces the database own complaint', async () => {
        // Given - a statement naming a table that does not exist
        const result = await integration.call(async ({ db }) => {
            await db.seed('SELECT * FROM "nonexistent_table_xyz"');
        });

        // Then - the refusal names the table the statement asked for
        expect(result.error.text).toContain('nonexistent_table_xyz');
    });

    test('what the database refuses — a query on a table that does not exist names that table', async () => {
        // Given - a read of a table no schema declares
        const result = await integration.call(
            async ({ db }) => await db.query('nonexistent_table_xyz', ['id']),
        );

        // Then - the refusal names it
        expect(result.error.text).toContain('nonexistent_table_xyz');
    });

    test('what the database refuses — a broken init script names the file and the SQL error', async () => {
        // Given - a docker/ directory whose init.sql declares a bogus type
        const result = await integration.call(async ({ db }) => {
            const dockerDir = mkdtempSync(resolve(tmpdir(), 'postgres-init-broken-'));
            mkdirSync(resolve(dockerDir, 'postgres'), { recursive: true });
            writeFileSync(
                resolve(dockerDir, 'postgres/init.sql'),
                'CREATE TABLE "broken" (id INTEGERRR);',
            );
            const initDb = postgres();
            initDb.serviceName = 'db';
            initDb.connectionString = db.connectionString;
            initDb.started = true;

            await initDb.initialize(dockerDir);
        });

        // Then - the message carries the script's path and the type error
        expect(result.error.text).toContain('init script failed');
        expect(result.error.text).toContain('postgres/init.sql');
    });

    // RUNTIME G2 — two workers on one container never share a row.
    test('two workers take two schemas, and a row one writes the other never reads', async () => {
        // Given - two handles on the runner's container, acquired by two workers, one of them seeding
        const result = await integration.call(async ({ db }) => {
            const container = new URL(db.connectionString);
            container.searchParams.delete('options');
            const [first, second] = [postgres(), postgres()];
            await Promise.all(
                [first, second].map(async (handle, index) => {
                    handle.connectionString = container.toString();
                    handle.started = true;
                    await handle.isolation().acquire(String(7 + index));
                }),
            );

            await first.seed(
                "INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')",
            );
            const rows = {
                first: await first.query('users', ['name']),
                second: await second.query('users', ['name']),
            };
            const schemas = [first, second].map((handle) =>
                new URL(handle.connectionString).searchParams.get('options'),
            );

            await first.isolation().release();
            await second.isolation().release();
            return { rows, schemas };
        });

        // Then - each worker has its own schema, and the row stayed in the one that wrote it
        expect(result.value).toMatch({
            rows: {
                first: [['Alice']],
                second: [],
            },
            schemas: ['-c search_path=worker_7,public', '-c search_path=worker_8,public'],
        });
    });
});
