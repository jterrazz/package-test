import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { isValidSqliteTemplate, sqliteTemplateDir, sqliteTemplateName } from './sqlite-template.js';
import { sqlite } from './sqlite.adapter.js';

const workdir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-key-'));

const guardDir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-guard-'));

const lockDir = mkdtempSync(resolve(tmpdir(), 'sqlite-lock-'));

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
        expect(db.started).toBe(true);
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
        expect(handles.map((db) => [db.started, db.connectionString])).toStrictEqual(
            handles.map(() => [true, `file:${templatePath}`]),
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
        const root = mkdtempSync(resolve(tmpdir(), 'sqlite-reset-'));
        const initSqlPath = resolve(root, 'init.sql');
        writeFileSync(
            initSqlPath,
            'CREATE TABLE "users" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);',
        );
        const db = sqlite({ init: initSqlPath });
        await db.initialize(root, root);
        await db.seed(`INSERT INTO "users" (name) VALUES ('Ada'), ('Grace')`);
        await db.reset();
        await db.seed(`INSERT INTO "users" (name) VALUES ('Linus')`);

        // Then - the one row, numbered from 1 again
        await expect(db.query('users', ['id', 'name'])).resolves.toStrictEqual([[1, 'Linus']]);
        rmSync(root, { force: true, recursive: true });
    });

    test('sqlite() — the columns a whole-table comparison reads — names every column of a table in the order the table declares them', async () => {
        // Given - a table declared with three columns
        const root = mkdtempSync(resolve(tmpdir(), 'sqlite-columns-'));
        const initSqlPath = resolve(root, 'init.sql');
        writeFileSync(
            initSqlPath,
            'CREATE TABLE "orders" (id INTEGER PRIMARY KEY, reference TEXT, total REAL);',
        );
        const db = sqlite({ init: initSqlPath });
        await db.initialize(root, root);

        // Then - the three, in their order; a table it does not hold has none
        await expect(db.columns('orders')).resolves.toStrictEqual(['id', 'reference', 'total']);
        await expect(db.columns('ghost')).resolves.toStrictEqual([]);
        rmSync(root, { force: true, recursive: true });
    });
});
