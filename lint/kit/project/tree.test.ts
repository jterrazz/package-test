import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { specsTree } from '../testing/subject.fixtures.js';
import {
    columnAt,
    findPools,
    findSpecsRoots,
    isConventionalSubdir,
    isReferrer,
    isSharedFolder,
    lineAt,
    listDirs,
    listReaders,
    lowestCommonFolder,
    readText,
    removeIfEmpty,
} from './tree.js';

const MISSING = join(tmpdir(), 'no-such-file-here.txt');

const TREE = {
    '_shared/_expected/pool.json': '{}',
    '_shared/notes.md': '',
    'api/_fixtures/project/specs/_shared/_expected/inner.json': '{}',
    'api/node_modules/dep/specs/x.spec.ts': '',
    'api/users/_expected/users.json': '{}',
    'api/users/case.spec.yaml': '',
    'api/users/users.spec.ts': '',
    'api/users/helper.ts': '',
    'api/users/notes.md': '',
};

describe('tree', () => {
    test('listDirs — the folder and every folder below, past the pruned and ground ones', () => {
        // Given - a specs tree with ground, fixtures and a dependency folder
        const root = specsTree(TREE);

        // Then - the folders a walk enters
        expect(
            listDirs(root)
                .map((dir) => relative(root, dir))
                .toSorted(),
        ).toStrictEqual(['', '_shared', 'api', 'api/users']);
    });

    test('findSpecsRoots and findPools — the specs trees and shared pools, never inside pruned folders or ground', () => {
        // Given - the tree, under a package that also holds a dependency with a specs folder
        const root = specsTree(TREE);
        const above = join(root, '..');
        mkdirSync(join(above, 'node_modules/dep/specs/_shared/_expected'), { recursive: true });

        // Then - the one specs root and its one pool
        expect([
            findSpecsRoots(above).map((dir) => relative(above, dir)),
            findPools(above).map((dir) => relative(above, dir)),
        ]).toStrictEqual([['specs'], ['specs/_shared/_expected']]);
    });

    test('listReaders — the modules and documents of a tree, outside ground', () => {
        // Given - the tree, its notes and its ground
        const root = specsTree(TREE);

        // Then - every .ts and document the walk reaches
        expect(
            listReaders(root)
                .map((path) => relative(root, path))
                .toSorted(),
        ).toStrictEqual([
            'api/users/case.spec.yaml',
            'api/users/helper.ts',
            'api/users/users.spec.ts',
        ]);
    });

    test('isConventionalSubdir — a folder holding leaf fixtures alone, not one holding a test, a nested ground folder, or nothing at all', () => {
        // Given - folders of each kind
        const root = specsTree({
            'mixed/_expected/a.json': '{}',
            'mixed/sub/a.json': '{}',
            'plain/a/data.json': '{}',
            'tested/a.test.ts': '',
            'nested/_expected/a.json': '{}',
            'file.json': '{}',
        });

        // Then - only the plain one
        expect(
            ['plain', 'tested', 'nested', 'mixed', 'file.json', 'missing'].map((name) =>
                isConventionalSubdir(join(root, name)),
            ),
        ).toStrictEqual([true, false, false, false, false, false]);
    });

    test('isSharedFolder, isReferrer and readText — the names and texts a walk reads', () => {
        // Given - shared folders where they belong and elsewhere, reader names, and a missing file
        // Then - each answer
        expect([
            isSharedFolder(join('repo', 'specs', '_shared')),
            isSharedFolder(join('repo', 'specs', 'api', '_shared')),
            isSharedFolder(join('repo', 'other', '_shared')),
            isReferrer('a.spec.yaml'),
            isReferrer('a.test.ts'),
            isReferrer('a.ts'),
            readText(MISSING),
        ]).toStrictEqual([true, false, false, true, true, false, '']);
    });

    test('columnAt and lineAt — the place of an index, a newline itself ending its line', () => {
        // Given - a text of three lines
        const text = 'ab\ncd\n\nef';
        const placeOf = (index: number): number[] => [lineAt(text, index), columnAt(text, index)];

        // Then - each place, a newline counted on the line it ends
        expect([0, 2, 3, 4, 6, 7, 9].map(placeOf)).toStrictEqual([
            [1, 1],
            [1, 3],
            [2, 1],
            [2, 2],
            [3, 1],
            [4, 1],
            [4, 3],
        ]);
    });

    test('lowestCommonFolder — the folder every one sits in, or none of none', () => {
        // Given - sets of folders
        // Then - the lowest they share
        expect([
            lowestCommonFolder(['/a/b/c', '/a/b/d/e', '/a/b']),
            lowestCommonFolder(['/a/b']),
            lowestCommonFolder(['/a/x', '/b/y']),
            lowestCommonFolder([]),
        ]).toStrictEqual(['/a/b', '/a/b', '/', undefined]);
    });

    test('removeIfEmpty — an empty folder goes, a full or missing one stays as it is', () => {
        // Given - an empty folder, a full one and a missing one
        const root = specsTree({ 'full/a.txt': '' });
        const empty = mkdtempSync(join(root, 'empty-'));

        // When - each is offered for removal
        for (const folder of [empty, join(root, 'full'), join(root, 'missing')]) {
            removeIfEmpty(folder);
        }

        // Then - only the empty one is gone
        expect([existsSync(empty), existsSync(join(root, 'full'))]).toStrictEqual([false, true]);
    });
});
