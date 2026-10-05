import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { discoverMembers, discoverSpecRoots } from './members.js';

function treeOf(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'members-'));
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    return root;
}

const WORKSPACE = resolve(import.meta.dirname, '../../../specs/_shared/_fixtures/member-workspace');

describe('members', () => {
    test('members — where the member pass looks — discovers every member the root manifest declares, and the root', () => {
        // Given - a workspace whose root declares `packages/*`
        const members = discoverMembers(WORKSPACE).map((dir) => dir.replace(`${WORKSPACE}/`, ''));

        // Then - every package a glob claims is there, at whatever depth the pattern reaches, and so is the root itself
        expect(members.toSorted()).toStrictEqual([
            WORKSPACE,
            'apps/rn-playground',
            'apps/site/packages/nested',
            'packages/clean',
            'packages/rn-jest',
            'packages/rn-library',
            'packages/seam-dependency',
            'packages/simulated-dom',
            'packages/stray-spec',
            'packages/tested-no-config',
            'specs',
        ]);
    });

    test('members — where the member pass looks — a member whose own root is the specs tree is a specs root (`file-suffix-matches-place`, `specification-test-uses-its-runner`, `ground-beside-its-only-reader`)', () => {
        // Given - that member run on its own, the way the toolchain runs it
        const roots = discoverSpecRoots(resolve(WORKSPACE, 'specs'));

        // Then - the tree passes have a tree to walk: the member IS the root
        expect(roots).toStrictEqual([resolve(WORKSPACE, 'specs')]);
    });

    test('members — where the member pass looks — a member that nests its specification tree is still a specs root', () => {
        // Given - `@fixture/clean` keeps its trees under `web/`
        const roots = discoverSpecRoots(WORKSPACE).map((dir) => dir.replace(`${WORKSPACE}/`, ''));

        // Then - the path-less run walks it, the way the toolchain's own does
        expect(roots).toContain('packages/clean/web/specs');
    });

    test('members — where the member pass looks — the path-less run reaches a specs-rooted member of the workspace', () => {
        // Given - the whole fixture workspace, which declares `specs` as a member
        const roots = discoverSpecRoots(WORKSPACE).map((dir) => dir.replace(`${WORKSPACE}/`, ''));

        // Then - both trees are walked, the nested one and the member that is one
        expect(roots.toSorted()).toStrictEqual(['packages/clean/web/specs', 'specs']);
    });

    test('members — where the member pass looks — a tree named by hand is walked as it is, to six folders down, past what is no tree to walk', () => {
        // Given - a folder with no manifest, its specs trees at depths six and seven, and some under a dot folder, an output folder, a nested package, and a git-ignored folder
        const root = treeOf({
            '.cache/specs/x.txt': '',
            '.gitignore': 'ignored/\n',
            'a/b/c/d/e/f/g/specs/x.txt': '',
            'a/b/c/d/e/f/specs/x.txt': '',
            'ignored/specs/x.txt': '',
            'node_modules/m/specs/x.txt': '',
            'pkg/package.json': '{}',
            'pkg/specs/x.txt': '',
            'specs/x.txt': '',
        });
        execFileSync('git', ['init', '--quiet'], { cwd: root });

        // Then - no member, and the trees the walk reaches
        expect([
            discoverMembers(root),
            discoverSpecRoots(root).map((dir) => dir.replace(`${root}/`, '')),
        ]).toStrictEqual([[], ['a/b/c/d/e/f/specs', 'specs']]);
    });
});
