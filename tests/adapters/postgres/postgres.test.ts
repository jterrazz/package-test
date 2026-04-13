import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { postgres } from '../../../src/adapters/postgres.adapter.js';
import { TestcontainersAdapter } from '../../../src/adapters/testcontainers.adapter.js';

describe('postgres service', () => {
    const db = postgres();
    let container: TestcontainersAdapter;

    beforeAll(async () => {
        container = new TestcontainersAdapter({
            image: 'postgres:17',
            port: 5432,
            env: { POSTGRES_DB: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_USER: 'test' },
        });
        await container.start();

        const host = container.getHost();
        const port = container.getMappedPort(5432);
        db.connectionString = db.buildConnectionString(host, port);
        db.started = true;

        await db.seed(
            'CREATE TABLE IF NOT EXISTS "users" (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE)',
        );
    }, 30_000);

    afterAll(async () => {
        await container.stop();
    });

    describe('connectionString', () => {
        test('builds a valid postgresql connection string', () => {
            expect(db.connectionString).toMatch(/^postgresql:\/\/test:test@/);
            expect(db.connectionString).toContain('/test');
        });
    });

    describe('healthcheck', () => {
        test('passes on healthy container', async () => {
            await expect(db.healthcheck()).resolves.not.toThrow();
        });

        test('fails on unreachable host', async () => {
            // Given — connection string pointing to closed port
            const badDb = postgres();
            badDb.connectionString = 'postgresql://test:test@localhost:1/test';

            // Then — healthcheck fails with context
            await expect(badDb.healthcheck()).rejects.toThrow('healthcheck failed');
        });

        test('fails when no connection string set', async () => {
            await expect(postgres().healthcheck()).rejects.toThrow('no connection string');
        });
    });

    describe('seed', () => {
        test('executes SQL statements', async () => {
            // Given — clean table
            await db.reset();
            await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')");

            // Then — row exists
            expect(await db.query('users', ['name'])).toEqual([['Alice']]);
        });

        test('executes multiple statements from file', async () => {
            // Given — SQL file with two inserts
            await db.reset();
            const sql = readFileSync(resolve(import.meta.dirname, 'seeds/two-users.sql'), 'utf8');
            await db.seed(sql);

            // Then — both rows exist
            expect(await db.query('users', ['name'])).toEqual([['Alice'], ['Bob']]);
        });

        test('fails fast on invalid SQL', async () => {
            await expect(db.seed('CREATE TABLE "bad" (id INTEGERRR)')).rejects.toThrow();
        });
    });

    describe('initialize', () => {
        test('runs init.sql from compose directory', async () => {
            // Given — compose dir with postgres/init.sql
            await db.reset();
            const tmpDir = mkdtempSync(resolve(tmpdir(), 'init-test-'));
            mkdirSync(resolve(tmpDir, 'postgres'), { recursive: true });
            writeFileSync(
                resolve(tmpDir, 'postgres/init.sql'),
                'CREATE TABLE IF NOT EXISTS "init_test" (id SERIAL, val TEXT); INSERT INTO "init_test" (val) VALUES (\'ok\');',
            );

            const initDb = postgres({ compose: 'db' });
            initDb.connectionString = db.connectionString;
            initDb.started = true;

            // When — initialize from compose dir
            await initDb.initialize(tmpDir);

            // Then — init script executed
            expect(await db.query('init_test', ['val'])).toEqual([['ok']]);
            await db.seed('DROP TABLE "init_test"');
        });

        test('reports SQL error context on failure', async () => {
            // Given — compose dir with invalid init.sql
            const tmpDir = mkdtempSync(resolve(tmpdir(), 'init-fail-'));
            mkdirSync(resolve(tmpDir, 'postgres'), { recursive: true });
            writeFileSync(
                resolve(tmpDir, 'postgres/init.sql'),
                'CREATE TABLE "bad" (id INTEGERRR);',
            );

            const initDb = postgres({ compose: 'db' });
            initDb.connectionString = db.connectionString;
            initDb.started = true;

            // Then — error includes "init script failed"
            await expect(initDb.initialize(tmpDir)).rejects.toThrow('init script failed');
        });
    });

    describe('query', () => {
        test('returns rows as arrays of column values', async () => {
            await db.reset();
            await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')");

            expect(await db.query('users', ['name', 'email'])).toEqual([
                ['Alice', 'alice@test.com'],
            ]);
        });

        test('returns empty array when table is empty', async () => {
            await db.reset();
            expect(await db.query('users', ['name'])).toEqual([]);
        });

        test('respects column order', async () => {
            await db.reset();
            await db.seed("INSERT INTO \"users\" (name, email) VALUES ('Alice', 'alice@test.com')");

            // Then — columns returned in requested order
            expect(await db.query('users', ['email', 'name'])).toEqual([
                ['alice@test.com', 'Alice'],
            ]);
        });
    });

    describe('reset', () => {
        test('truncates all tables', async () => {
            // Given — data in table
            await db.reset();
            await db.seed(
                "INSERT INTO \"users\" (name, email) VALUES ('ResetUser', 'reset@test.com')",
            );

            // When — reset
            await db.reset();

            // Then — table is empty
            expect(await db.query('users', ['name'])).toEqual([]);
        });

        test('allows re-inserting after reset', async () => {
            // Given — insert, reset, insert again
            await db.reset();
            await db.seed("INSERT INTO \"users\" (name, email) VALUES ('First', 'first@test.com')");
            await db.reset();
            await db.seed(
                "INSERT INTO \"users\" (name, email) VALUES ('Second', 'second@test.com')",
            );

            // Then — only second insert remains
            expect(await db.query('users', ['name'])).toEqual([['Second']]);
        });
    });

    describe('failure scenarios', () => {
        test('healthcheck error includes connection context', async () => {
            // Given — bad connection string
            const badDb = postgres();
            badDb.connectionString = 'postgresql://test:test@localhost:1/test';

            // Then — error message includes "healthcheck failed" with detail
            try {
                await badDb.healthcheck();
                expect.fail('should have thrown');
            } catch (error: any) {
                expect(error.message).toContain('postgres healthcheck failed');
                // The message should not end with just ": " — it should include the underlying reason
                expect(error.message).not.toBe('postgres healthcheck failed: ');
                expect(error.cause).toBeDefined();
            }
        });

        test('seed error includes the SQL context', async () => {
            // Given — invalid SQL
            try {
                await db.seed('SELECT * FROM "nonexistent_table_xyz"');
                expect.fail('should have thrown');
            } catch (error: any) {
                // Then — error includes the table name that doesn't exist
                expect(error.message).toContain('nonexistent_table_xyz');
            }
        });

        test('init script error includes file path and SQL error', async () => {
            // Given — compose dir with broken init.sql
            const tmpDir = mkdtempSync(resolve(tmpdir(), 'fail-scenario-'));
            mkdirSync(resolve(tmpDir, 'postgres'), { recursive: true });
            writeFileSync(
                resolve(tmpDir, 'postgres/init.sql'),
                'CREATE TABLE "broken" (id INTEGERRR);',
            );

            const initDb = postgres({ compose: 'db' });
            initDb.connectionString = db.connectionString;
            initDb.started = true;

            // Then — error includes "init script failed" and the file path
            try {
                await initDb.initialize(tmpDir);
                expect.fail('should have thrown');
            } catch (error: any) {
                expect(error.message).toContain('init script failed');
                expect(error.message).toContain('postgres/init.sql');
            }
        });

        test('query error on nonexistent table', async () => {
            // Given — query a table that doesn't exist
            try {
                await db.query('nonexistent_table_xyz', ['id']);
                expect.fail('should have thrown');
            } catch (error: any) {
                // Then — error includes the table name
                expect(error.message).toContain('nonexistent_table_xyz');
            }
        });
    });
});
