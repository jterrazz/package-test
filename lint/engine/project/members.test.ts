import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { discoverMembers, discoverSpecRoots } from './members.js';

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

    test('members — where the member pass looks — a member whose own root is the specs tree is a specs root (`file-suffix-matches-place`, `facet-test-uses-its-runner`, `ground-beside-its-only-reader`)', () => {
        // Given - that member run on its own, the way the toolchain runs it
        const roots = discoverSpecRoots(resolve(WORKSPACE, 'specs'));

        // Then - the tree passes have a tree to walk: the member IS the root
        expect(roots).toStrictEqual([resolve(WORKSPACE, 'specs')]);
    });

    test('members — where the member pass looks — a member that nests its facet tree is still a specs root', () => {
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
});
