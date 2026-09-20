import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { postgres } from '../../../src/index.js';
import { integration } from '../integration.specification.js';

/*
 * The postgres seam, met the way a consumer meets it: the facet starts the
 * container, the chain hands the started handle to the call, and every chain
 * begins on a reset database. What needs no container — the refusals a handle
 * answers before it ever connects — is a module test beside `postgres.ts`.
 */

describe('postgres — the handle against a real container', () => {
    test('builds a connection string carrying the credentials and the database', async () => {
        // Given - the service the runner started
        const result = await integration.call(({ db }) => {
            const url = new URL(db.connectionString);
            return { database: url.pathname, protocol: url.protocol, username: url.username };
        });

        // Then - the parts a consumer reads come from the compose file
        expect(result.value).toMatch('connection-string.json');
    });

    test('passes its healthcheck on a reachable container', async () => {
        // Given - the started service asked whether it answers
        const result = await integration.call(async ({ db }) => {
            await db.healthcheck();
        });

        // Then - it resolved, and refused nothing
        await expect(result.error).toBeEmpty();
    });

    test('executes the statements it is handed', async () => {
        // Given - one row inserted through the handle
        const result = await integration.call(async ({ db }) => {
            await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')");
            return await db.query('users', ['name']);
        });

        // Then - the row is readable
        expect(result.value).toMatch('alice.json');
    });

    test('executes every statement of a seed file', async () => {
        // Given - a seed file holding two inserts
        const result = await integration
            .seed('two-users.sql')
            .call(async ({ db }) => await db.query('users', ['name']));

        // Then - both rows landed
        expect(result.value).toMatch('two-users.json');
    });

    test('returns rows as value arrays, in the column order asked for', async () => {
        // Given - two seeded users, the columns requested in reverse
        const result = await integration
            .seed('two-users.sql')
            .call(async ({ db }) => await db.query('users', ['email', 'name']));

        // Then - each row is a value array following the requested order
        expect(result.value).toMatch('two-users-reversed.json');
    });

    test('starts every chain on an empty table', async () => {
        // Given - a chain that seeded, then a chain that only reads
        await integration
            .seed('two-users.sql')
            .call(async ({ db }) => await db.query('users', ['name']));
        const result = await integration.call(async ({ db }) => await db.query('users', ['name']));

        // Then - the second chain never saw the first one's rows
        expect(result.value).toMatch('empty.json');
    });

    test('truncates every table on reset, and takes rows again afterwards', async () => {
        // Given - seeded rows, a reset, then one insert
        const result = await integration.seed('two-users.sql').call(async ({ db }) => {
            await db.reset();
            await db.seed(
                "INSERT INTO \"users\" (name, email) VALUES ('Second', 'second@test.com')",
            );
            return await db.query('users', ['name']);
        });

        // Then - only the row written after the reset remains
        expect(result.value).toMatch('second.json');
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
        expect(result.value).toMatch('init-ok.json');
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
        expect(result.error).toContain('nonexistent_table_xyz');
    });

    test('what the database refuses — a query on a table that does not exist names that table', async () => {
        // Given - a read of a table no schema declares
        const result = await integration.call(
            async ({ db }) => await db.query('nonexistent_table_xyz', ['id']),
        );

        // Then - the refusal names it
        expect(result.error).toContain('nonexistent_table_xyz');
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
        expect(result.error).toContain('init script failed');
        expect(result.error).toContain('postgres/init.sql');
    });
});
