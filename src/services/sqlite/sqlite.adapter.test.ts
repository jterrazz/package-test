import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { isValidSqliteTemplate, sqliteTemplateDir, sqliteTemplateName } from './sqlite-template.js';
import { sqlite } from './sqlite.adapter.js';
import type { SqliteHandle } from './sqlite.adapter.js';

const workdir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-key-'));

const guardDir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-guard-'));

const lockDir = mkdtempSync(resolve(tmpdir(), 'sqlite-lock-'));

/** A handle started over a schema in a root of its own. */
async function started(schema: string): Promise<{ db: SqliteHandle; templatePath: string }> {
    const root = mkdtempSync(resolve(tmpdir(), 'sqlite-started-'));
    const init = resolve(root, 'init.sql');
    writeFileSync(init, schema);
    const db = sqlite({ init });
    await db.initialize(root, root);
    return { db, templatePath: db.connectionString.slice('file:'.length) };
}

describe('sqlite', () => {
    afterAll(() => {
        rmSync(workdir, { force: true, recursive: true });
        rmSync(guardDir, { force: true, recursive: true });
        rmSync(lockDir, { force: true, recursive: true });
    });

    test('sqlite() initialize() — stale template recovery — rebuilds instead of reusing a pre-existing 0-byte template', async () => {
        // Given - the template path a crashed earlier run left behind as a 0-byte file (an early return on `existsSync()` alone never runs the init SQL, and every later run hits "no such table" against the empty file forever after).
        const root = mkdtempSync(resolve(tmpdir(), 'sqlite-guard-root-'));
        const initSqlPath = resolve(root, 'init.sql');
        writeFileSync(
            initSqlPath,
            'CREATE TABLE "regression_guard" (id INTEGER PRIMARY KEY, label TEXT NOT NULL);',
        );

        const templatePath = resolve(
            sqliteTemplateDir(root),
            sqliteTemplateName({ init: initSqlPath }),
        );
        writeFileSync(templatePath, '');
        expect(isValidSqliteTemplate(templatePath)).toBe(false);

        // When - a fresh handle initializes against that poisoned path
        const db = sqlite({ init: initSqlPath });
        await db.initialize(root, root);

        // Then - the template was detected as invalid and rebuilt: the schema from init.sql is actually present (proving the file was NOT reused as-is) and the file now passes the validity guard.
        expect(isValidSqliteTemplate(templatePath)).toBe(true);

        const check = new Database(templatePath, { readonly: true });
        try {
            const query = `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'regression_guard'`;
            const tables = check.prepare(query).all();
            expect(tables).toHaveLength(1);
        } finally {
            check.close();
        }

        rmSync(root, { force: true, recursive: true });
    });

    test('sqlite() initialize() — the template is a PROJECT artefact — caches under <root>/.artifacts/vitest/sqlite, never the OS tmpdir', async () => {
        // Given - two checkouts of one project: same schema content, two roots. A machine-global tmpdir gave them ONE file, so whichever ran first built it and the other silently inherited that schema.
        const schema = 'CREATE TABLE "shared_schema" (id INTEGER PRIMARY KEY);';
        const roots = ['a', 'b'].map((suffix) => {
            const root = mkdtempSync(resolve(tmpdir(), `sqlite-checkout-${suffix}-`));
            const initSqlPath = resolve(root, 'init.sql');
            writeFileSync(initSqlPath, schema);
            return { initSqlPath, root };
        });

        // When - each checkout initializes its own handle
        const templates: { root: string; templatePath: string }[] = [];
        for (const { initSqlPath, root } of roots) {
            const db = sqlite({ init: initSqlPath });
            await db.initialize(root, root);
            templates.push({ root, templatePath: db.connectionString.replace('file:', '') });
        }

        // Then - each template sits inside its own project, and the two are different files that both exist
        expect(
            templates.map(
                ({ root, templatePath }) =>
                    templatePath.startsWith(`${resolve(root, '.artifacts/vitest/sqlite')}/`) &&
                    isValidSqliteTemplate(templatePath),
            ),
        ).toStrictEqual([true, true]);
        expect(templates[0]?.templatePath).not.toBe(templates[1]?.templatePath);

        for (const { root } of roots) {
            rmSync(root, { force: true, recursive: true });
        }
    });

    test('the template build lock (regression guard) — concurrent handles on a cold cache all end up with the schema', async () => {
        // Given - a fresh project root, no template yet, and four handles initializing at once — the cold-cache race that made a consumer keep `fileParallelism: false`
        const root = mkdtempSync(resolve(tmpdir(), 'sqlite-race-'));
        const initSqlPath = resolve(root, 'init.sql');
        writeFileSync(initSqlPath, 'CREATE TABLE "raced" (id INTEGER PRIMARY KEY);');

        // When - they all initialize together
        const handles = [0, 1, 2, 3].map(() => sqlite({ init: initSqlPath }));
        await Promise.all(
            handles.map(async (db) => {
                await db.initialize(root, root);
            }),
        );

        // Then - every one of them points at the same finished template, and it carries the schema: no partial build was ever observable
        const templatePath = resolve(
            root,
            '.artifacts/vitest/sqlite',
            sqliteTemplateName({ init: initSqlPath }),
        );
        expect(handles.map((db) => db.connectionString)).toStrictEqual(
            handles.map(() => `file:${templatePath}`),
        );

        const check = new Database(templatePath, { readonly: true });
        try {
            const query = `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'raced'`;
            expect(check.prepare(query).all()).toHaveLength(1);
        } finally {
            check.close();
        }

        rmSync(root, { force: true, recursive: true });
    });

    test('sqlite() — a reset starts the next chain from the same state — a reset empties every table and restarts its generated ids', async () => {
        // Given - an AUTOINCREMENT table holding two rows, then a reset and one insert
        const { db } = await started(
            'CREATE TABLE "users" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);',
        );
        await db.seed(`INSERT INTO "users" (name) VALUES ('Ada'), ('Grace')`);
        await db.reset();
        await db.seed(`INSERT INTO "users" (name) VALUES ('Linus')`);

        // Then - the one row, numbered from 1 again
        await expect(db.query('users', ['id', 'name'])).resolves.toStrictEqual([[1, 'Linus']]);
    });

    test('sqlite() — the columns a whole-table comparison reads — names every column of a table in the order the table declares them', async () => {
        // Given - a table declared with three columns
        const { db } = await started(
            'CREATE TABLE "orders" (id INTEGER PRIMARY KEY, reference TEXT, total REAL);',
        );

        // Then - the three, in their order; a table it does not hold has none
        await expect(db.columns('orders')).resolves.toStrictEqual(['id', 'reference', 'total']);
        await expect(db.columns('ghost')).resolves.toStrictEqual([]);
    });

    test('sqlite() — a handle before it starts — is a file service on no port, reading the template it has not built yet', () => {
        // Given - a handle never initialized
        const db = sqlite();

        // Then - its declared shape, and itself as its database
        expect([
            {
                connectionString: db.connectionString,
                defaultImage: db.defaultImage,
                defaultPort: db.defaultPort,
                environment: db.environment,
                serviceName: db.serviceName,
                type: db.type,
            },
            db.buildConnectionString(),
            db.createDatabaseAdapter() === db,
        ]).toStrictEqual([
            {
                connectionString: '',
                defaultImage: '',
                defaultPort: 0,
                environment: {},
                serviceName: null,
                type: 'sqlite',
            },
            'file:',
            true,
        ]);
    });

    test('sqlite() — isolation — a worker writes to a copy of the template of its own, reset empties it, and release removes it', async () => {
        // Given - a started handle over a one-table schema
        const { db, templatePath } = await started(
            'CREATE TABLE "users" (id INTEGER PRIMARY KEY, name TEXT);',
        );
        const isolation = db.isolation();

        // When - the template is read, then a worker acquires, seeds, resets, seeds again, then releases twice
        const before = await db.query('users', ['name']);
        await isolation.acquire('w1');
        const acquired = [db.connectionString, db.buildConnectionString()];
        await db.seed(`INSERT INTO "users" (name) VALUES ('Ada')`);
        await isolation.reset();
        await db.seed(`INSERT INTO "users" (name) VALUES ('Grace')`);
        const seen = await db.query('users', ['name']);
        await isolation.release();
        await isolation.release();

        // Then - the worker's file was its own, the template untouched, and the handle back on the template
        const workerPath = String(acquired[0]).slice('file:'.length);
        expect([
            new RegExp(`^file:.*/test-worker-w1-${process.pid}-\\d+\\.sqlite$`, 'u').test(
                String(acquired[0]),
            ),
            acquired[1] === acquired[0],
            before,
            seen,
            existsSync(workerPath),
            db.connectionString,
            await db.query('users', ['name']),
        ]).toStrictEqual([true, true, [], [['Grace']], false, `file:${templatePath}`, []]);
    });

    test('sqlite() initialize() — a valid template is reused as it is, and the leftovers of a crashed build are removed before one', async () => {
        // Given - a valid template already holding another schema, and a root whose last build crashed
        const reused = mkdtempSync(resolve(tmpdir(), 'sqlite-reused-'));
        const reusedInit = resolve(reused, 'init.sql');
        writeFileSync(reusedInit, 'CREATE TABLE "fresh" (id INTEGER PRIMARY KEY);');
        const reusedTemplate = resolve(
            sqliteTemplateDir(reused),
            sqliteTemplateName({ init: reusedInit }),
        );
        const seeded = new Database(reusedTemplate);
        seeded.exec('CREATE TABLE "cached" (id INTEGER PRIMARY KEY);');
        seeded.close();
        const crashed = mkdtempSync(resolve(tmpdir(), 'sqlite-crashed-'));
        const crashedTemplate = resolve(sqliteTemplateDir(crashed), sqliteTemplateName());
        const leftovers = ['', '-wal', '-shm'].map(
            (suffix) => `${crashedTemplate}.${process.pid}.building${suffix}`,
        );
        for (const leftover of leftovers) {
            writeFileSync(leftover, 'partial');
        }

        // When - each initializes
        const cached = sqlite({ init: reusedInit });
        await cached.initialize(reused, reused);
        await sqlite().initialize(crashed, crashed);

        const failing = mkdtempSync(resolve(tmpdir(), 'sqlite-failing-'));
        const badInit = resolve(failing, 'init.sql');
        writeFileSync(badInit, 'CREATE NOTHING;');
        const failingBuild = `${resolve(sqliteTemplateDir(failing), sqliteTemplateName({ init: badInit }))}.${process.pid}.building`;
        await expect(sqlite({ init: badInit }).initialize(failing, failing)).rejects.toThrow(
            'syntax error',
        );

        // Then - the cached schema is the one read, nothing of either build is left, and the rebuilt template is whole
        expect([
            await cached.columns('cached'),
            await cached.columns('fresh'),
            leftovers.map((path) => existsSync(path)),
            isValidSqliteTemplate(crashedTemplate),
            existsSync(failingBuild),
        ]).toStrictEqual([['id'], [], [false, false, false], true, false]);
    });

    test('the template build lock (regression guard) — a lock a dead worker left is broken, and the lock is released once built', async () => {
        // Given - a root whose lock a dead worker left long ago
        const root = mkdtempSync(resolve(tmpdir(), 'sqlite-stale-'));
        const lock = `${resolve(sqliteTemplateDir(root), sqliteTemplateName())}.lock`;
        writeFileSync(lock, '1');
        const old = new Date('2020-01-01T00:00:00Z');
        utimesSync(lock, old, old);

        // When - a handle initializes
        const db = sqlite();
        await db.initialize(root, root);

        // Then - it built its template, and no lock is left
        expect([db.connectionString.startsWith('file:'), existsSync(lock)]).toStrictEqual([
            true,
            false,
        ]);
    });

    test('sqlite() — a reset of tables with no generated ids — empties them, with no sequence to restart', async () => {
        // Given - a table without AUTOINCREMENT holding a row
        const { db } = await started('CREATE TABLE "tags" (label TEXT);');
        await db.seed(`INSERT INTO "tags" (label) VALUES ('a')`);

        // When - it is reset
        await db.reset();

        // Then - the table is empty
        await expect(db.query('tags', ['label'])).resolves.toStrictEqual([]);
    });
});
