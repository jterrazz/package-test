import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

describe('sqlite-template', () => {
    test('sqliteTemplateName (regression guard) — the name keys on the kind of schema, its path and its bytes, a folder by every file in it', () => {
        // Given - schemas differing by content, by path alone, by kind alone, edited in place, and a folder with a file edited
        const sql = 'CREATE TABLE "t" (id INTEGER PRIMARY KEY);';
        const posts = writeSchema('posts.sql', 'CREATE TABLE "post" (id INTEGER PRIMARY KEY);');
        const left = writeSchema('left.sql', sql);
        const right = writeSchema('right.sql', sql);
        const edited = writeSchema('edited.sql', sql);
        const before = sqliteTemplateName({ init: edited });
        writeFileSync(edited, 'CREATE TABLE "t" (id INTEGER PRIMARY KEY, label TEXT);');
        const folder = resolve(workdir, 'prisma');
        mkdirSync(folder);
        writeFileSync(resolve(folder, 'a.prisma'), 'model A {}');
        const folderBefore = sqliteTemplateName({ prismaSchema: folder });
        writeFileSync(resolve(folder, 'a.prisma'), 'model A { id Int }');

        // Then - every one a name of its own, and the same schema read twice one name
        const names = [
            sqliteTemplateName({ init: posts }),
            sqliteTemplateName({ init: left }),
            sqliteTemplateName({ init: right }),
            sqliteTemplateName({ prismaSchema: left }),
            before,
            sqliteTemplateName({ init: edited }),
            folderBefore,
            sqliteTemplateName({ prismaSchema: folder }),
        ];
        expect([new Set(names).size, sqliteTemplateName({ init: left })]).toStrictEqual([
            names.length,
            names[1],
        ]);
    });

    test('sqliteTemplateName (regression guard) — an empty database and an unreadable schema have stable names, keyed on the path alone', () => {
        // Given - no schema, and schemas declared at paths nothing is on
        // Then - the names each always gets
        expect([
            sqliteTemplateName(),
            sqliteTemplateName({}),
            sqliteTemplateName({ init: '/no/such/schema.sql' }),
            sqliteTemplateName({ prismaSchema: '/no/such/schema.sql' }),
        ]).toStrictEqual([
            'template-2e1cfa82.sqlite',
            'template-2e1cfa82.sqlite',
            'template-68ada90d.sqlite',
            'template-dd35a52b.sqlite',
        ]);
    });

    test('prismaPushCommand (regression guard) — carries --schema with the path resolved against the cwd and quoted, or the bare invocation Prisma discovers for itself', () => {
        // Given - a schema relative to the project root, an absolute one under a folder with a space, and none
        const declared = 'apps/dashboard/prisma/schema.prisma';
        const spaced = resolve(tmpdir(), 'my apps', 'schema.prisma');

        // Then - the CLI is told the schema explicitly, as one absolute token
        expect([
            prismaPushCommand(declared),
            prismaPushCommand(spaced),
            prismaPushCommand(null),
        ]).toStrictEqual([
            `npx prisma db push --force-reset --schema "${resolve(process.cwd(), declared)}"`,
            `npx prisma db push --force-reset --schema "${spaced}"`,
            'npx prisma db push --force-reset',
        ]);
    });

    test('isValidSqliteTemplate (regression guard) — accepts a real SQLite database, and nothing a crash or a stranger leaves at the path', () => {
        // Given - a real database, a missing path, a 0-byte file, an unrelated file, and the header text without its closing NUL
        const guardDir = mkdtempSync(resolve(tmpdir(), 'sqlite-template-guard-'));
        const real = resolve(guardDir, 'real.sqlite');
        const db = new Database(real);
        db.exec('CREATE TABLE "t" (id INTEGER PRIMARY KEY)');
        db.close();
        const files = { empty: '', garbage: 'not a database', truncated: 'SQLite format 3' };
        for (const [name, content] of Object.entries(files)) {
            writeFileSync(resolve(guardDir, name), content);
        }

        // Then - only the real one is a template
        expect(
            [
                real,
                resolve(guardDir, 'missing'),
                ...Object.keys(files).map((name) => resolve(guardDir, name)),
            ].map((path) => isValidSqliteTemplate(path)),
        ).toStrictEqual([true, false, false, false, false]);
    });

    test('the template build lock (regression guard) — exactly one caller wins it, naming its pid, and a lock that cannot be created is no lost race', () => {
        // Given - a free lock path, and one in a folder that does not exist. The defect: a check-then-write pair let two workers both believe they had won.
        const lockDir = mkdtempSync(resolve(tmpdir(), 'sqlite-lock-'));
        const lockPath = resolve(lockDir, 'exclusive.lock');

        // Then - the exclusive create hands the lock to one caller only, until released
        expect([
            acquireTemplateLock(lockPath),
            readFileSync(lockPath, 'utf8'),
            acquireTemplateLock(lockPath),
        ]).toStrictEqual([true, String(process.pid), false]);
        releaseTemplateLock(lockPath);
        releaseTemplateLock(lockPath);
        expect(acquireTemplateLock(lockPath)).toBe(true);
        expect(() => acquireTemplateLock(resolve(lockDir, 'missing/held.lock'))).toThrow('ENOENT');
    });

    test('the template build lock (regression guard) — a lock older than the build budget is breakable, one at the budget or fresh is not, and a lock that is gone is not stale', () => {
        // Given - a lock just taken, and one never taken
        const lockDir = mkdtempSync(resolve(tmpdir(), 'sqlite-lock-'));
        const lockPath = resolve(lockDir, 'stale.lock');
        acquireTemplateLock(lockPath);
        const taken = statSync(lockPath).mtimeMs;

        // Then - presumed alive within two minutes, dead past them; nothing to break when absent
        expect([
            isStaleTemplateLock(lockPath),
            isStaleTemplateLock(lockPath, taken + 120_000),
            isStaleTemplateLock(lockPath, taken + 120_001),
            isStaleTemplateLock(resolve(lockDir, 'absent.lock')),
            existsSync(resolve(lockDir, 'absent.lock')),
        ]).toStrictEqual([false, false, true, false, false]);
    });
});
