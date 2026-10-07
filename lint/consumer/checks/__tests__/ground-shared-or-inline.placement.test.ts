import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { checkGroundPlacement, fixGroundPlacement } from '../ground-shared-or-inline.placement.js';
import {
    API_READS,
    APP_KEPT_FOR_API,
    NOT_MISPLACED,
    POOL,
    READERS,
} from './ground-shared-or-inline.placement.fixtures.js';

function findingsIn(files: Record<string, string>): string[] {
    const root = packageWith(files);
    return checkGroundPlacement(root).map(
        ({ fix, found, line, path, rule }) =>
            `${path}: ${found} — ${fix}${line === 1 && rule === 'ground-shared-or-inline' ? '' : ' (misfiled)'}`,
    );
}

function singleReaderPool(git: boolean): string {
    const root = mkdtempSync(join(tmpdir(), 'pool-'));
    mkdirSync(join(root, 'specs', '__fixtures__', 'app'), { recursive: true });
    mkdirSync(join(root, 'specs', 'api'), { recursive: true });
    writeFileSync(join(root, 'specs', '__fixtures__', 'app', 'index.txt'), 'app\n');
    writeFileSync(
        join(root, 'specs', 'api', 'boot.spec.ts'),
        "await api.fixture(directory('../__fixtures__/app/')).get('/');\n",
    );
    if (git) {
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        execFileSync('git', ['add', '.'], { cwd: root });
    }
    return root;
}

describe('ground-shared-or-inline.placement', () => {
    test('keeps the history of a pool fixture `ground-shared-or-inline` moves in a git checkout', () => {
        // Given - a tracked single-reader pool fixture
        const root = singleReaderPool(true);

        // When - the fixer moves it beside its leaf
        fixGroundPlacement(join(root, 'specs'));

        // Then - the index holds the new path and not the old one
        const indexed = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
        expect(indexed.split('\n').filter(Boolean).toSorted()).toStrictEqual([
            'specs/api/__fixtures__/app/index.txt',
            'specs/api/boot.spec.ts',
        ]);
    });

    test('moves a pool fixture by plain rename where git places the tree in no work tree', () => {
        // Given - the same tree, and no repository
        const root = singleReaderPool(false);

        // When - the fixer moves it beside its leaf
        fixGroundPlacement(join(root, 'specs'));

        // Then - the disk holds it at its new place only
        expect(existsSync(join(root, 'specs', 'api', '__fixtures__', 'app', 'index.txt'))).toBe(
            true,
        );
        expect(existsSync(join(root, 'specs', '__fixtures__'))).toBe(false);
    });

    test('a pool entry one leaf reads is named, by the form that names it from there', () => {
        // Given - a directory and a file of the pool, each read by one leaf
        const directory = findingsIn({ ...POOL, ...API_READS });
        const file = findingsIn({
            'specs/__fixtures__/a.json': '{}\n',
            'specs/api/boot.spec.ts': "api.fixture(file('../__fixtures__/a.json'));\n",
        });

        // Then - each is to move beside its reader, named as a directory or a file
        expect([directory, file]).toStrictEqual([
            APP_KEPT_FOR_API,
            [
                "specs/__fixtures__/a.json: ground only specs/api reaches for, kept above it — move it to specs/api/__fixtures__/a.json and name it file('./__fixtures__/a.json') — `typescript fix` does both",
            ],
        ]);
    });

    test('a pool entry the leaves of one folder read, the folder among them or not, is to move to that folder', () => {
        // Given - two leaves under specs/api reading the pool, then specs/api and one leaf under it
        const found = findingsIn({
            ...POOL,
            'specs/api/a/x.spec.ts': "api.fixture(directory('../../__fixtures__/app/'));\n",
            'specs/api/b/y.spec.ts': "api.fixture(directory('../../__fixtures__/app/'));\n",
        });
        const withTheFolderItself = findingsIn({
            ...POOL,
            ...API_READS,
            'specs/api/b/y.spec.ts': "api.fixture(directory('../../__fixtures__/app/'));\n",
        });

        // Then - the lowest folder they share is its home, whether or not it reads the entry itself
        const spread = [
            'specs/__fixtures__/app: ground only the leaves under specs/api reach for, kept above them — move it to specs/api/__fixtures__/app, the ground of the lowest folder its readers share, and name it from each leaf by the path that climbs to it — `typescript fix` does both',
        ];
        expect([found, withTheFolderItself]).toStrictEqual([spread, spread]);
    });

    test.each(NOT_MISPLACED)('a pool entry is not misplaced when %s', (_, files) => {
        // Given - a tree whose pool entry is shared, outside the placement's reach, or not a read
        // Then - nothing is to move
        expect(findingsIn(files)).toStrictEqual([]);
    });

    test.each(READERS)('a pool entry read by %s is a read like a spec module', (_, reader) => {
        // Given - the pool entry, read by that reader alone
        // Then - its leaf is the one that reaches for it
        expect(findingsIn({ ...POOL, ...reader })).toStrictEqual(APP_KEPT_FOR_API);
    });

    test('the fix moves the entry and repoints every reader by the path that reaches it now', () => {
        // Given - a single-reader entry, and one read by two leaves of a folder whose ground already holds another entry
        const root = packageWith({
            ...POOL,
            ...API_READS,
            'specs/__fixtures__/users.json': '[]\n',
            'specs/cli/__fixtures__/kept.txt': '',
            'specs/cli/a/x.spec.ts': "cli.fixture(file('../../__fixtures__/users.json'));\n",
            'specs/cli/b/y.spec.ts': "cli.fixture(file('../../__fixtures__/users.json'));\n",
        });

        // When - the fixer runs
        const moved = fixGroundPlacement(root);

        // Then - both moved, each reader names the new place, and the emptied pool is gone
        const read = (path: string): string => readFileSync(join(root, path), 'utf8');
        expect([
            moved,
            read('specs/api/boot.spec.ts'),
            read('specs/cli/a/x.spec.ts'),
            existsSync(join(root, 'specs/cli/__fixtures__/users.json')),
            existsSync(join(root, 'specs/__fixtures__')),
        ]).toStrictEqual([
            [
                'specs/__fixtures__/app → specs/api/__fixtures__/app',
                'specs/__fixtures__/users.json → specs/cli/__fixtures__/users.json',
            ],
            "api.fixture(directory('./__fixtures__/app/'));\n",
            "cli.fixture(file('../__fixtures__/users.json'));\n",
            true,
            false,
        ]);
    });

    test('the fix leaves an entry whose new place is taken', () => {
        // Given - a single-reader entry whose destination already exists
        const root = packageWith({
            ...POOL,
            ...API_READS,
            'specs/api/__fixtures__/app/index.txt': 'other\n',
        });

        // When - the fixer runs
        // Then - nothing moved, and the reader still names the pool
        expect([
            fixGroundPlacement(root),
            readFileSync(join(root, 'specs/api/boot.spec.ts'), 'utf8'),
        ]).toStrictEqual([[], API_READS['specs/api/boot.spec.ts']]);
    });
});
