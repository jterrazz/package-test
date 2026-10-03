import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    acquireTemplateLock,
    isStaleTemplateLock,
    isValidSqliteTemplate,
    prismaPushCommand,
    releaseTemplateLock,
    sqliteTemplateName,
} from './sqlite-template.js';

const workdir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-key-'));

const writeSchema = (name: string, sql: string): string => {
    const path = resolve(workdir, name);
    writeFileSync(path, sql);
    return path;
};

const guardDir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-guard-'));

const lockDir = mkdtempSync(resolve(tmpdir(), 'sqlite-lock-'));

describe('sqlite-template', () => {
    test('sqliteTemplateName (regression guard) — two different schemas get two different template files', () => {
        // Given - two projects sharing one machine-global tmpdir, each with its own schema (the real poisoning: one fixed filename meant the second project found a header-valid template full of the FIRST project's tables)
        const posts = writeSchema('posts.sql', 'CREATE TABLE "post" (id INTEGER PRIMARY KEY);');
        const users = writeSchema('users.sql', 'CREATE TABLE "user" (id INTEGER PRIMARY KEY);');

        // Then - the two never meet
        expect(sqliteTemplateName({ init: posts })).not.toBe(sqliteTemplateName({ init: users }));
    });

    test('sqliteTemplateName (regression guard) — the same schema gets the same template file — the cache still caches', () => {
        // Given - the same declared schema, read twice
        const schema = writeSchema('stable.sql', 'CREATE TABLE "t" (id INTEGER PRIMARY KEY);');

        // Then - one key, so this project's workers share one build
        expect(sqliteTemplateName({ init: schema })).toBe(sqliteTemplateName({ init: schema }));
    });

    test('sqliteTemplateName (regression guard) — editing the schema changes the key, so the stale template is not reused', () => {
        // Given - a schema whose content changed between two runs at the same path
        const schema = writeSchema('edited.sql', 'CREATE TABLE "a" (id INTEGER PRIMARY KEY);');
        const before = sqliteTemplateName({ init: schema });
        writeFileSync(schema, 'CREATE TABLE "a" (id INTEGER PRIMARY KEY, label TEXT);');

        // Then - a new key: the content is part of the digest, not just the path
        expect(sqliteTemplateName({ init: schema })).not.toBe(before);
    });

    test('sqliteTemplateName (regression guard) — two identical schemas at different paths stay separate', () => {
        // Given - two projects with byte-identical schemas in different checkouts
        const sql = 'CREATE TABLE "t" (id INTEGER PRIMARY KEY);';
        const left = writeSchema('left.sql', sql);
        const right = writeSchema('right.sql', sql);

        // Then - the resolved path is in the digest too, so they never share a file
        expect(sqliteTemplateName({ init: left })).not.toBe(sqliteTemplateName({ init: right }));
    });

    test('sqliteTemplateName (regression guard) — a prisma schema and an init SQL file never collide', () => {
        // Given - the same path declared under each option
        const path = writeSchema('both.sql', 'CREATE TABLE "t" (id INTEGER PRIMARY KEY);');

        // Then - the kind of schema is part of the digest
        expect(sqliteTemplateName({ prismaSchema: path })).not.toBe(
            sqliteTemplateName({ init: path }),
        );
    });

    test('sqliteTemplateName (regression guard) — an empty database has one stable, prefixed name', () => {
        // Given - no schema at all (the consumer seeds it)
        // Then - a stable key; the folder it lands in already says whose it is
        expect(sqliteTemplateName()).toBe(sqliteTemplateName({}));
        expect(sqliteTemplateName()).toMatch(/^template-[\da-f]{8}\.sqlite$/u);
    });

    test('sqliteTemplateName (regression guard) — an unreadable schema still keys on its path', () => {
        // Given - a declared schema that is not on disk (yet)
        const missing = resolve(workdir, 'absent.sql');

        // Then - no throw, and two absent schemas at two paths remain distinct
        expect(sqliteTemplateName({ init: missing })).not.toBe(
            sqliteTemplateName({ init: resolve(workdir, 'absent-other.sql') }),
        );
    });

    test('prismaPushCommand (regression guard) — carries --schema with the path resolved against the cwd', () => {
        // Given - a prismaSchema declared relative to the project root, in a repo whose prisma config does NOT sit at the cwd (the exact shape that made the option a lie: db push discovered nothing and died with "Could not find Prisma Schema")
        const declared = 'apps/dashboard/prisma/schema.prisma';
        const absolute = resolve(process.cwd(), declared);

        // Then - the CLI is told the schema explicitly, as an absolute path
        const command = prismaPushCommand(declared);
        expect(command).toBe(`npx prisma db push --force-reset --schema "${absolute}"`);
        expect(command).toContain('--schema');
        expect(command).toContain(absolute);
    });

    test('prismaPushCommand (regression guard) — leaves an already absolute path untouched', () => {
        // Given - a consumer that resolved the path itself
        const absolute = resolve(tmpdir(), 'somewhere', 'schema.prisma');

        // Then - resolve() is idempotent: the same absolute path reaches the CLI
        expect(prismaPushCommand(absolute)).toBe(
            `npx prisma db push --force-reset --schema "${absolute}"`,
        );
    });

    test('prismaPushCommand (regression guard) — quotes a path containing spaces', () => {
        // Given - a checkout under a directory with a space (execSync runs a shell)
        const spaced = resolve(tmpdir(), 'my apps', 'schema.prisma');

        // Then - the argument survives as one token
        expect(prismaPushCommand(spaced)).toContain(`--schema "${spaced}"`);
    });

    test('prismaPushCommand (regression guard) — without the option, keeps the bare invocation Prisma discovers for itself', () => {
        // Given - no prismaSchema declared
        // Then - the command is unchanged, so discovery-based setups keep working
        expect(prismaPushCommand(null)).toBe('npx prisma db push --force-reset');
    });

    test('isValidSqliteTemplate (regression guard) — rejects a path that does not exist', () => {
        // Given - a path nothing was ever written to
        const missing = resolve(guardDir, 'missing.sqlite');

        // Then - it is not treated as a usable template
        expect(existsSync(missing)).toBe(false);
        expect(isValidSqliteTemplate(missing)).toBe(false);
    });

    test('isValidSqliteTemplate (regression guard) — rejects a 0-byte file — the exact shape a crashed run leaves behind', () => {
        // Given - a stale, empty file (e.g. a worker crashed right after `touch`-ing the template but before better-sqlite3 ever wrote the format header)
        const stale = resolve(guardDir, 'stale-empty.sqlite');
        writeFileSync(stale, '');

        // Then - the guard refuses to treat it as a real template
        expect(isValidSqliteTemplate(stale)).toBe(false);
    });

    test('isValidSqliteTemplate (regression guard) — rejects a short file that is not a SQLite database at all', () => {
        // Given - some unrelated, too-short content at the template path
        const garbage = resolve(guardDir, 'garbage.sqlite');
        writeFileSync(garbage, 'not a database');

        // Then - the guard refuses it (fails the magic-header check)
        expect(isValidSqliteTemplate(garbage)).toBe(false);
    });

    test('isValidSqliteTemplate (regression guard) — accepts a real SQLite database file', () => {
        // Given - an actual SQLite file created by better-sqlite3, in a folder of this run's own
        const real = resolve(mkdtempSync(resolve(guardDir, 'real-')), 'real.sqlite');
        const db = new Database(real);
        db.exec('CREATE TABLE "t" (id INTEGER PRIMARY KEY)');
        db.close();

        // Then - the header check passes
        expect(isValidSqliteTemplate(real)).toBe(true);
    });

    test('the template build lock (regression guard) — exactly one caller wins it — the loser is told, not let through', () => {
        // Given - a free lock path. The defect: a check-then-write pair let two workers both believe they had won, and both ran `prisma db push` against the same file — "database is locked".
        const lockPath = resolve(lockDir, 'exclusive.lock');

        // Then - the exclusive create hands the lock to one caller only
        expect(acquireTemplateLock(lockPath)).toBe(true);
        expect(acquireTemplateLock(lockPath)).toBe(false);

        releaseTemplateLock(lockPath);
        expect(acquireTemplateLock(lockPath)).toBe(true);
        releaseTemplateLock(lockPath);
    });

    test('the template build lock (regression guard) — a lock nobody has touched for minutes is breakable, a fresh one is not', () => {
        // Given - a lock just taken
        const lockPath = resolve(lockDir, 'stale.lock');
        acquireTemplateLock(lockPath);

        // Then - its holder is presumed alive, so a waiter waits
        expect(isStaleTemplateLock(lockPath)).toBe(false);

        // invariant: long past the build budget the holder is presumed dead: a crashed worker must not wedge the suite.
        expect(isStaleTemplateLock(lockPath, statSync(lockPath).mtimeMs + 10 * 60 * 1000)).toBe(
            true,
        );
        releaseTemplateLock(lockPath);
    });

    test('the template build lock (regression guard) — a lock that is gone is not stale — the waiter just retries', () => {
        // Given - no lock at all
        const lockPath = resolve(lockDir, 'absent.lock');

        // Then - nothing to break
        expect(isStaleTemplateLock(lockPath)).toBe(false);
        expect(existsSync(lockPath)).toBe(false);
    });
});
