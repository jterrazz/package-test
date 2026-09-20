import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkMember, checkMembers, discoverMembers, discoverSpecRoots } from './checker-member.js';

/** The fixture workspace: one member per finding, plus one that is clean. */
const WORKSPACE = resolve(import.meta.dirname, '../../specs/_fixtures/member-workspace');
const memberAt = (name: string): string => resolve(WORKSPACE, 'packages', name);

/** The codes a run produced, in order. */
function codes(dir: string, root = WORKSPACE): string[] {
    return checkMember(dir, root).map((violation) => violation.rule);
}

describe('the member pass — what a workspace member owes', () => {
    test('a member with tests and no config is told what it is running on (E3)', () => {
        // Given - a member declaring a test script and carrying no config
        const [violation] = checkMember(memberAt('tested-no-config'), WORKSPACE);

        // Then - the finding names the budget and the fixtures that are running
        expect(violation?.rule).toBe('e3');
        expect(violation?.message).toContain('no vitest.config.ts');
        expect(violation?.message).toContain('defineSpecConfig()');
    });

    test('the pass reaches a member with no specs/ root at all (E3)', () => {
        // Given - that same member, which has no spec tree
        // Then - the pass judged it anyway: E3 is about a member, not a tree
        expect(codes(memberAt('tested-no-config'))).toStrictEqual(['e3']);
    });

    test("a root whose only tests are its members' owes no config (E3)", () => {
        // Given - a workspace root that delegates `test` and holds no test file of its own, while `packages/clean` holds one
        // Then - the root is silent: the walk stops at the next package.json
        expect(codes(WORKSPACE)).toStrictEqual([]);
    });

    test('a config that gives every file it collects a drawing of a browser (E5b)', () => {
        // Given - a member whose config names happy-dom
        const [violation] = checkMember(memberAt('simulated-dom'), WORKSPACE);

        // Then - the finding names the line and the move
        expect(violation?.rule).toBe('e5b');
        expect(violation?.line).toBe(5);
        expect(violation?.message).toContain('a drawing of a browser');
    });

    test('a dependency the framework carries, and a seam it replaced (F8)', () => {
        // Given - a member declaring msw, a testing-library package, and the optional peer a consumer declares on purpose
        const found = checkMember(memberAt('seam-dependency'), WORKSPACE);

        // Then - the two are named, each by what it actually is, and playwright - an optional peer a consumer declares - is not
        expect(found.map((violation) => violation.rule)).toStrictEqual(['f8', 'f8']);
        expect(found[0]?.message).toContain('@testing-library/react');
        expect(found[0]?.message).toContain('is a seam `@jterrazz/test` replaced');
        expect(found[1]?.message).toContain('`msw` is a transitive of `@jterrazz/test`');
        expect(found.every((violation) => !violation.message.includes('playwright'))).toBe(true);
    });

    test('a finding points at the line the declaration is written on (F8)', () => {
        // Given - the same member, whose manifest spells msw on its own line
        const found = checkMember(memberAt('seam-dependency'), WORKSPACE);

        // Then - the anchor is the declaration, not the opening brace
        expect(found.map((violation) => violation.line)).toStrictEqual([4, 5]);
    });

    test("a runtime `yaml` is the product's, a dev one is the seam's (F8)", () => {
        // Given - `clean` declares yaml as a RUNTIME dependency
        // Then - nothing fires: the framework never ships its yaml to a product
        expect(codes(memberAt('clean'))).toStrictEqual([]);
    });

    test('a member that owes nothing produces nothing', () => {
        // Given - a member with a config, a test script and only optional peers
        // Then - the pass is silent
        expect(codes(memberAt('clean'))).toStrictEqual([]);
    });

    test('the RN testing library stands where jest is the runner (F8)', () => {
        // Given - a member whose test script is jest and whose vocabulary is the React Native one
        // Then - nothing fires: the facet that would replace it does not reach that runtime yet
        expect(codes(memberAt('rn-jest'))).toStrictEqual([]);
    });

    test('discovers every member the root manifest declares, and the root', () => {
        // Given - a workspace whose root declares `packages/*`
        const members = discoverMembers(WORKSPACE).map((dir) => dir.replace(`${WORKSPACE}/`, ''));

        // Then - every package a glob claims is there, at whatever depth the pattern reaches, and so is the root itself
        expect(members.toSorted()).toStrictEqual([
            WORKSPACE,
            'apps/site/packages/nested',
            'packages/clean',
            'packages/rn-jest',
            'packages/seam-dependency',
            'packages/simulated-dom',
            'packages/stray-spec',
            'packages/tested-no-config',
            'specs',
        ]);
    });

    test('a member whose own root is the specs tree holds specs, not strays (C12)', () => {
        // Given - `@fixture/specs-rooted`, a member declared as `specs` (spwn's shape), holding `cli/agent/agent-list.spec.ts`
        // Then - the member pass reads the tree it IS: nothing is outside a specs tree here
        expect(codes(resolve(WORKSPACE, 'specs'))).toStrictEqual([]);
    });

    test('a member whose own root is the specs tree is a specs root (C12/C18/C21w)', () => {
        // Given - that member run on its own, the way the toolchain runs it
        const roots = discoverSpecRoots(resolve(WORKSPACE, 'specs'));

        // Then - the tree passes have a tree to walk: the member IS the root
        expect(roots).toStrictEqual([resolve(WORKSPACE, 'specs')]);
    });

    test('a member that nests its facet tree is still a specs root', () => {
        // Given - `@fixture/clean` keeps its trees under `web/`
        const roots = discoverSpecRoots(WORKSPACE).map((dir) => dir.replace(`${WORKSPACE}/`, ''));

        // Then - the path-less run walks it, the way the toolchain's own does
        expect(roots).toContain('packages/clean/web/specs');
    });

    test('every member is judged in one run', () => {
        // Given - the whole fixture workspace
        const found = checkMembers(WORKSPACE).map((violation) => violation.rule);

        // Then - one E3, one E5b, three F8 and one C12, whatever the order they walk in
        expect(found.toSorted()).toStrictEqual([
            'c12-spec-file-name',
            'e3',
            'e5b',
            'f8',
            'f8',
            'f8',
        ]);
    });

    test('the path-less run reaches a specs-rooted member of the workspace', () => {
        // Given - the whole fixture workspace, which declares `specs` as a member
        const roots = discoverSpecRoots(WORKSPACE).map((dir) => dir.replace(`${WORKSPACE}/`, ''));

        // Then - both trees are walked, the nested one and the member that is one
        expect(roots.toSorted()).toStrictEqual(['packages/clean/web/specs', 'specs']);
    });
});
