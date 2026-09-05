import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { isValidSqliteTemplate, prismaPushCommand, sqlite, sqliteTemplateName } from './sqlite.js';

describe('sqliteTemplateName (regression guard)', () => {
    const workdir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-key-'));

    afterAll(() => {
        rmSync(workdir, { force: true, recursive: true });
    });

    const writeSchema = (name: string, sql: string): string => {
        const path = resolve(workdir, name);
        writeFileSync(path, sql);
        return path;
    };

    test('two different schemas get two different template files', () => {
        // Given - two projects sharing one machine-global tmpdir, each with its own
        // Schema (the real poisoning: one fixed filename meant the second project
        // Found a header-valid template full of the FIRST project's tables)
        const posts = writeSchema('posts.sql', 'CREATE TABLE "post" (id INTEGER PRIMARY KEY);');
        const users = writeSchema('users.sql', 'CREATE TABLE "user" (id INTEGER PRIMARY KEY);');

        // Then - the two never meet
        expect(sqliteTemplateName({ init: posts })).not.toBe(sqliteTemplateName({ init: users }));
    });

    test('the same schema gets the same template file — the cache still caches', () => {
        // Given - the same declared schema, read twice
        const schema = writeSchema('stable.sql', 'CREATE TABLE "t" (id INTEGER PRIMARY KEY);');

        // Then - one key, so this project's workers share one build
        expect(sqliteTemplateName({ init: schema })).toBe(sqliteTemplateName({ init: schema }));
    });

    test('editing the schema changes the key, so the stale template is not reused', () => {
        // Given - a schema whose content changed between two runs at the same path
        const schema = writeSchema('edited.sql', 'CREATE TABLE "a" (id INTEGER PRIMARY KEY);');
        const before = sqliteTemplateName({ init: schema });
        writeFileSync(schema, 'CREATE TABLE "a" (id INTEGER PRIMARY KEY, label TEXT);');

        // Then - a new key: the content is part of the digest, not just the path
        expect(sqliteTemplateName({ init: schema })).not.toBe(before);
    });

    test('two identical schemas at different paths stay separate', () => {
        // Given - two projects with byte-identical schemas in different checkouts
        const sql = 'CREATE TABLE "t" (id INTEGER PRIMARY KEY);';
        const left = writeSchema('left.sql', sql);
        const right = writeSchema('right.sql', sql);

        // Then - the resolved path is in the digest too, so they never share a file
        expect(sqliteTemplateName({ init: left })).not.toBe(sqliteTemplateName({ init: right }));
    });

    test('a prisma schema and an init SQL file never collide', () => {
        // Given - the same path declared under each option
        const path = writeSchema('both.sql', 'CREATE TABLE "t" (id INTEGER PRIMARY KEY);');

        // Then - the kind of schema is part of the digest
        expect(sqliteTemplateName({ prismaSchema: path })).not.toBe(
            sqliteTemplateName({ init: path }),
        );
    });

    test('an empty database has one stable, prefixed name', () => {
        // Given - no schema at all (the consumer seeds it)
        // Then - a stable key, and the file is still recognisably ours
        expect(sqliteTemplateName()).toBe(sqliteTemplateName({}));
        expect(sqliteTemplateName()).toMatch(/^jterrazz-test-sqlite-template-[\da-f]{8}\.sqlite$/);
    });

    test('an unreadable schema still keys on its path', () => {
        // Given - a declared schema that is not on disk (yet)
        const missing = resolve(workdir, 'absent.sql');

        // Then - no throw, and two absent schemas at two paths remain distinct
        expect(sqliteTemplateName({ init: missing })).not.toBe(
            sqliteTemplateName({ init: resolve(workdir, 'absent-other.sql') }),
        );
    });
});

describe('prismaPushCommand (regression guard)', () => {
    test('carries --schema with the path resolved against the cwd', () => {
        // Given - a prismaSchema declared relative to the project root, in a repo whose
        // Prisma config does NOT sit at the cwd (the exact shape that made the option a
        // Lie: db push discovered nothing and died with "Could not find Prisma Schema")
        const declared = 'apps/dashboard/prisma/schema.prisma';
        const absolute = resolve(process.cwd(), declared);

        // Then - the CLI is told the schema explicitly, as an absolute path
        const command = prismaPushCommand(declared);
        expect(command).toBe(`npx prisma db push --force-reset --schema "${absolute}"`);
        expect(command).toContain('--schema');
        expect(command).toContain(absolute);
    });

    test('leaves an already absolute path untouched', () => {
        // Given - a consumer that resolved the path itself
        const absolute = resolve(tmpdir(), 'somewhere', 'schema.prisma');

        // Then - resolve() is idempotent: the same absolute path reaches the CLI
        expect(prismaPushCommand(absolute)).toBe(
            `npx prisma db push --force-reset --schema "${absolute}"`,
        );
    });

    test('quotes a path containing spaces', () => {
        // Given - a checkout under a directory with a space (execSync runs a shell)
        const spaced = resolve(tmpdir(), 'my apps', 'schema.prisma');

        // Then - the argument survives as one token
        expect(prismaPushCommand(spaced)).toContain(`--schema "${spaced}"`);
    });

    test('without the option, keeps the bare invocation Prisma discovers for itself', () => {
        // Given - no prismaSchema declared
        // Then - the command is unchanged, so discovery-based setups keep working
        expect(prismaPushCommand(null)).toBe('npx prisma db push --force-reset');
    });
});

describe('isValidSqliteTemplate (regression guard)', () => {
    const workdir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-guard-'));

    afterAll(() => {
        rmSync(workdir, { force: true, recursive: true });
    });

    test('rejects a path that does not exist', () => {
        // Given - a path nothing was ever written to
        const missing = resolve(workdir, 'missing.sqlite');

        // Then - it is not treated as a usable template
        expect(existsSync(missing)).toBe(false);
        expect(isValidSqliteTemplate(missing)).toBe(false);
    });

    test('rejects a 0-byte file — the exact shape a crashed run leaves behind', () => {
        // Given - a stale, empty file (e.g. a worker crashed right after `touch`-ing
        // The template but before better-sqlite3 ever wrote the format header)
        const stale = resolve(workdir, 'stale-empty.sqlite');
        writeFileSync(stale, '');

        // Then - the guard refuses to treat it as a real template
        expect(isValidSqliteTemplate(stale)).toBe(false);
    });

    test('rejects a short file that is not a SQLite database at all', () => {
        // Given - some unrelated, too-short content at the template path
        const garbage = resolve(workdir, 'garbage.sqlite');
        writeFileSync(garbage, 'not a database');

        // Then - the guard refuses it (fails the magic-header check)
        expect(isValidSqliteTemplate(garbage)).toBe(false);
    });

    test('accepts a real SQLite database file', () => {
        // Given - an actual SQLite file created by better-sqlite3
        const real = resolve(workdir, 'real.sqlite');
        const db = new Database(real);
        db.exec('CREATE TABLE "t" (id INTEGER PRIMARY KEY)');
        db.close();

        // Then - the header check passes
        expect(isValidSqliteTemplate(real)).toBe(true);
    });
});

describe('sqlite() initialize() — stale template recovery', () => {
    test('rebuilds instead of reusing a pre-existing 0-byte template', async () => {
        // Given - the shared template path a crashed earlier run left behind as a
        // 0-byte file (this is the exact real-world failure: initialize() used to
        // Early-return on `existsSync()` alone and never ran the init SQL, so every
        // Later run hit "no such table" against the empty file forever after).
        const initSqlDir = mkdtempSync(resolve(tmpdir(), 'sqlite-guard-init-'));
        const initSqlPath = resolve(initSqlDir, 'init.sql');
        writeFileSync(
            initSqlPath,
            'CREATE TABLE "regression_guard" (id INTEGER PRIMARY KEY, label TEXT NOT NULL);',
        );

        const templatePath = resolve(tmpdir(), sqliteTemplateName({ init: initSqlPath }));
        const lockPath = `${templatePath}.lock`;
        try {
            unlinkSync(lockPath);
        } catch {
            /* Ignore — no stale lock to clear */
        }
        writeFileSync(templatePath, '');
        expect(isValidSqliteTemplate(templatePath)).toBe(false);

        // When - a fresh handle initializes against that poisoned path
        const db = sqlite({ init: initSqlPath });
        await db.initialize();

        // Then - the template was detected as invalid, deleted, and rebuilt: the
        // Schema from init.sql is actually present (proving the file was NOT
        // Reused as-is) and the file now passes the validity guard.
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
    });
});
