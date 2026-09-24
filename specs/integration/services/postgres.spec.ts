import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { file, postgres } from '../../../src/index.js';
import { integration } from '../integration.specification.js';

/** The docker directory the specimen's services initialise from. */
const SPECIMEN_DOCKER = resolve(import.meta.dirname, '../../shared/fixtures/specimen-api/docker');

/*
 * The postgres seam, met the way a consumer meets it: the facet starts the
 * container, the chain hands the started handle to the call, and every chain
 * begins on a reset database. What needs no container — the refusals a handle
 * answers before it ever connects — is a module test beside `postgres.ts`.
 */

describe('postgres', () => {
    test('builds a connection string carrying the credentials and the worker own database', async () => {
        // Given - the service the runner started, the worker's number read off its database
        const result = await integration.call(({ db }) => {
            const url = new URL(db.connectionString);
            return {
                database: url.pathname.replace(/_\d+$/u, '_<worker>'),
                protocol: url.protocol,
                username: url.username,
            };
        });

        // Then - the credentials are the handle's, and the database is this worker's clone of the service's
        expect(result.value).toMatch({
            database: '/test_db_<worker>',
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

    test('runs in a container labelled for cleanup, its data on a memory disk, reused only when asked', async () => {
        // Given - the container publishing the service's port, as the runtime describes it
        const result = await integration.call(async ({ db }) => {
            const { getContainerRuntimeClient } = await import('testcontainers');
            const runtime = await getContainerRuntimeClient();
            const { dockerode } = runtime.container;
            const port = Number(new URL(db.connectionString).port);
            const listed = await dockerode.listContainers();
            const running = listed.find(({ Ports }) =>
                Ports.some(({ PublicPort }) => PublicPort === port),
            );
            const inspected = await dockerode.getContainer(running?.Id ?? '').inspect();
            const labels = inspected.Config.Labels;
            return {
                data: inspected.HostConfig.Tmpfs?.['/var/lib/postgresql/data'],
                hashed: 'org.testcontainers.container-hash' in labels,
                labelled: labels['com.jterrazz.test'],
                reused: labels['com.jterrazz.test.reuse'] === 'true',
            };
        });

        // Then - a cleanup finds it, its data never touches a disk, and reuse is on exactly when the run asked
        const asked =
            process.env.TESTCONTAINERS_REUSE_ENABLE === 'true' &&
            [undefined, '', 'false'].includes(process.env.CI);
        expect(result.value).toMatch({
            data: 'rw',
            hashed: asked,
            labelled: 'true',
            reused: asked,
        });
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

    test('builds its template from the init script the docker directory carries, and a worker clones it', async () => {
        // Given - a docker/ directory holding postgres/init.sql, and a handle initialised from it then acquired
        const result = await integration.call(async ({ db }) => {
            const dockerDir = mkdtempSync(resolve(tmpdir(), 'postgres-init-'));
            mkdirSync(resolve(dockerDir, 'postgres'), { recursive: true });
            writeFileSync(
                resolve(dockerDir, 'postgres/init.sql'),
                'CREATE TABLE IF NOT EXISTS "init_probe" (id SERIAL, val TEXT);' +
                    ' INSERT INTO "init_probe" (val) VALUES (\'ok\');',
            );
            const initDb = postgres();
            initDb.serviceName = 'probe';
            initDb.connectionString = db.connectionString;
            initDb.started = true;

            await initDb.initialize(dockerDir);
            await initDb.isolation().acquire('1');
            try {
                return await initDb.query('init_probe', ['val']);
            } finally {
                await initDb.isolation().release();
            }
        });

        // Then - the clone holds what the script created and inserted
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
    test('two workers take two databases cloned from the template, and a row one writes the other never reads', async () => {
        // Given - two handles on the runner's container, initialised from the specimen's docker directory and acquired by two workers, one of them seeding
        const result = await integration.call(async ({ db }) => {
            const container = new URL(db.connectionString);
            container.pathname = '/test';
            const [first, second] = [postgres(), postgres()];
            await Promise.all(
                [first, second].map(async (handle, index) => {
                    handle.serviceName = 'worker';
                    handle.connectionString = container.toString();
                    handle.started = true;
                    await handle.initialize(SPECIMEN_DOCKER);
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
            const databases = [first, second].map(
                (handle) => new URL(handle.connectionString).pathname,
            );

            await first.isolation().release();
            await second.isolation().release();
            return { databases, rows };
        });

        // Then - each worker has its own database, and the row stayed in the one that wrote it
        expect(result.value).toMatch({
            databases: ['/test_worker_7', '/test_worker_8'],
            rows: {
                first: [['Alice']],
                second: [],
            },
        });
    });

    test('drops a worker database on release, and hands the handle back the container own', async () => {
        // Given - a handle acquired then released by one worker
        const result = await integration.call(async ({ db }) => {
            const container = new URL(db.connectionString);
            container.pathname = '/test';
            const handle = postgres();
            handle.serviceName = 'released';
            handle.connectionString = container.toString();
            handle.started = true;
            await handle.isolation().acquire('3');
            await handle.isolation().release();

            const { Client } = await import('pg');
            const client = new Client({ connectionString: container.toString() });
            await client.connect();
            try {
                const left = await client.query(
                    "SELECT datname FROM pg_database WHERE datname = 'test_released_3'",
                );
                return { database: new URL(handle.connectionString).pathname, left: left.rows };
            } finally {
                await client.end();
            }
        });

        // Then - no clone is left on the container, and the handle speaks for the container again
        expect(result.value).toMatch({ database: '/test', left: [] });
    });
});
