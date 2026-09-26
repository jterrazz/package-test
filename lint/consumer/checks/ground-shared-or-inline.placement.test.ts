import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { fixGroundPlacement } from './ground-shared-or-inline.placement.js';

function singleReaderPool(git: boolean): string {
    const root = mkdtempSync(join(tmpdir(), 'pool-'));
    mkdirSync(join(root, 'specs', '_shared', '_fixtures', 'app'), { recursive: true });
    mkdirSync(join(root, 'specs', 'api'), { recursive: true });
    writeFileSync(join(root, 'specs', '_shared', '_fixtures', 'app', 'index.txt'), 'app\n');
    writeFileSync(
        join(root, 'specs', 'api', 'boot.spec.ts'),
        "await api.fixture(directory('../_shared/_fixtures/app/')).get('/');\n",
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
            'specs/api/_fixtures/app/index.txt',
            'specs/api/boot.spec.ts',
        ]);
    });

    test('moves a pool fixture by plain rename where git places the tree in no work tree', () => {
        // Given - the same tree, and no repository
        const root = singleReaderPool(false);

        // When - the fixer moves it beside its leaf
        fixGroundPlacement(join(root, 'specs'));

        // Then - the disk holds it at its new place only
        expect(existsSync(join(root, 'specs', 'api', '_fixtures', 'app', 'index.txt'))).toBe(true);
        expect(existsSync(join(root, 'specs', '_shared'))).toBe(false);
    });
});
