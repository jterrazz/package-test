import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { BaseResult } from '../result.js';
import type { ResultConfig } from '../result.js';
import type { TableSource } from '../table/table.js';

function database(name: string): TableSource {
    return {
        columns: async () => await Promise.resolve(['source']),
        query: async () => await Promise.resolve([[name]]),
    };
}

function folderWith(text: string): string {
    const folder = mkdtempSync(join(tmpdir(), 'result-'));
    mkdirSync(join(folder, 'out'));
    writeFileSync(join(folder, 'notes.txt'), text);
    return folder;
}

function refusalOf(work: () => unknown): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('result', () => {
    test("result — the disk a run left — read in its working directory, else the spec's folder, the working directory resolved for {{workdir}}", () => {
        // Given - a run with a working directory, and one without
        const [testDir, workDir] = [folderWith('spec side'), folderWith('run side')];
        const ran = new BaseResult({ config: {}, testDir, workDir });
        const bare = new BaseResult({ config: {}, testDir });

        // Then - each reads its own side, and only the run with a directory carries it, resolved
        expect([
            ran.file('notes.txt').content,
            bare.file('notes.txt').content,
            ran.file('notes.txt').grep('run').text,
            ran.file('notes.txt').grep('run').captures === ran.captures,
            ran.file('absent.txt').exists,
            ran.directory('out').root,
            bare.directory().root,
            ran.captures.workdir,
            bare.captures.workdir,
        ]).toStrictEqual([
            'run side',
            'spec side',
            'run side',
            true,
            false,
            join(workDir, 'out'),
            testDir,
            realpathSync(workDir),
            undefined,
        ]);
    });

    test('result — the disk a run left — a file it did not leave is refused when read', () => {
        // Given - a run that left no such file
        const result = new BaseResult({ config: {}, testDir: folderWith('') });

        // Then - its content and its grep are refused whole
        const refused = [
            'found: file("absent.txt"), and the run left no such file',
            'why: A file is read only where it exists.',
            'fix: assert `.exists` first, or name a file the run left',
            'read: docs/reference/assertions.md#resultfilepath-single-files-in-the-cwd-cli',
        ].join('\n');
        expect([
            refusalOf(() => result.file('absent.txt').content),
            refusalOf(() => result.file('absent.txt').grep('x')),
        ]).toStrictEqual([refused, refused]);
    });

    test("result — a table — read from the database named, else the chain's first, and from the only one whatever a chain with no map names", async () => {
        // Given - a run over two databases, one over one, and one whose map no key list states
        const several: ResultConfig = {
            database: database('orders'),
            databaseKeys: ['orders', 'users'],
            databases: new Map([
                ['orders', database('orders')],
                ['users', database('users')],
            ]),
        };
        const named = new BaseResult({ config: several, testDir: '/spec' });
        const only = new BaseResult({ config: { database: database('only') }, testDir: '/spec' });
        const unkeyed = new BaseResult({
            config: {
                database: database('orders'),
                databases: new Map([['users', database('users')]]),
            },
            testDir: '/spec',
        });

        // Then - each read from its own
        await expect(
            Promise.all([
                named.table('t', { database: 'users' }).query(['source']),
                unkeyed.table('t').query(['source']),
                only.table('t').query(['source']),
                only.table('t', { database: 'unmapped' }).query(['source']),
            ]),
        ).resolves.toStrictEqual([[['users']], [['orders']], [['only']], [['only']]]);
    });

    test('result — a table — refused with no database declared, one named that is not, or the only one named', () => {
        // Given - a run with no database, one over two, and one over one
        const none = new BaseResult({ config: {}, testDir: '/spec' });
        const one = new BaseResult({
            config: { database: database('orders'), databaseKeys: ['orders'] },
            testDir: '/spec',
        });
        const several = new BaseResult({
            config: {
                databaseKeys: ['orders', 'users'],
                databases: new Map([['orders', database('orders')]]),
            },
            testDir: '/spec',
        });

        // Then - each refusal whole
        expect([
            refusalOf(() => none.table('users')),
            refusalOf(() => several.table('users', { database: 'billing' })),
            refusalOf(() => one.table('users', { database: 'orders' })).split('\n')[0],
        ]).toStrictEqual([
            [
                'found: table("users"), and no database is declared',
                'why: A table is read from a declared database.',
                "fix: declare a database in the specification's `services`: `postgres()` or `sqlite()`",
                'read: docs/reference/services.md#the-database-rule',
            ].join('\n'),
            [
                'found: table("users") reads the database "billing", and none is declared under that key',
                'why: `database:` names a key of the services record.',
                'fix: name a declared database: orders, users',
                'read: docs/reference/services.md#the-database-rule',
            ].join('\n'),
            'found: table() names a database, and "orders" is the only one declared',
        ]);
    });
});
