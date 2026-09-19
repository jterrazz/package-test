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
        // Given - a workspace root that delegates `test` and holds no test file
        // Of its own, while `packages/clean` holds one
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
        // Given - a member declaring msw, a testing-library package, and the
        // Optional peer a consumer declares on purpose
        const found = checkMember(memberAt('seam-dependency'), WORKSPACE);

        // Then - the two are named, each by what it actually is, and
        // Playwright - an optional peer a consumer declares - is not
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

    test('discovers every member the root manifest declares, and the root', () => {
        // Given - a workspace whose root declares `packages/*`
        const members = discoverMembers(WORKSPACE).map((dir) => dir.replace(`${WORKSPACE}/`, ''));

        // Then - every package a glob claims is there, at whatever depth the
        // Pattern reaches, and so is the root itself
        expect(members.toSorted()).toStrictEqual([
            WORKSPACE,
            'apps/site/packages/nested',
            'packages/clean',
            'packages/seam-dependency',
            'packages/simulated-dom',
            'packages/tested-no-config',
        ]);
    });

    test('a member that nests its facet tree is still a specs root', () => {
        // Given - `@fixture/clean` keeps its trees under `web/`
        const roots = discoverSpecRoots(WORKSPACE).map((dir) => dir.replace(`${WORKSPACE}/`, ''));

        // Then - the path-less run walks it, the way the toolchain's own does
        expect(roots).toStrictEqual(['packages/clean/web/specs']);
    });

    test('every member is judged in one run', () => {
        // Given - the whole fixture workspace
        const found = checkMembers(WORKSPACE).map((violation) => violation.rule);

        // Then - one E3, one E5b and three F8, whatever the order they walk in
        expect(found.toSorted()).toStrictEqual(['e3', 'e5b', 'f8', 'f8', 'f8']);
    });
});
