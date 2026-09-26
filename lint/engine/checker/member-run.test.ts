import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { CHECKER } from '../../consumer/checks/checker.js';
import { checkoutUnder } from '../testing/package-tree.fixtures.js';
import { runMember, runMembers } from './member-run.js';
import { checkerMessage } from './tree-run.js';

const WORKSPACE = resolve(import.meta.dirname, '../../../specs/shared/fixtures/member-workspace');
const memberAt = (name: string): string => resolve(WORKSPACE, 'packages', name);

function codes(dir: string, root = WORKSPACE): string[] {
    return runMember(dir, root, CHECKER).map((violation) => violation.rule);
}

describe('member-run', () => {
    test('members — members — the member pass — what a workspace member owes — a member with tests and no config is told what it is running on (`member-has-vitest-config`)', () => {
        // Given - a member declaring a test script and carrying no config
        const [violation] = runMember(memberAt('tested-no-config'), WORKSPACE, CHECKER);

        // Then - the finding names the budget and the fixtures that are running
        expect(violation?.rule).toBe('member-has-vitest-config');
        expect(violation === undefined ? '' : checkerMessage(CHECKER, violation)).toContain(
            'no vitest.config.ts',
        );
        expect(violation === undefined ? '' : checkerMessage(CHECKER, violation)).toContain(
            'defineSpecConfig()',
        );
    });

    test('members — members — the member pass — what a workspace member owes — the pass reaches a member with no specs/ root at all (`member-has-vitest-config`)', () => {
        // Given - that same member, which has no spec tree
        // Then - the pass judged it anyway: `member-has-vitest-config` is about a member, not a tree
        expect(codes(memberAt('tested-no-config'))).toStrictEqual(['member-has-vitest-config']);
    });

    test("members — members — the member pass — what a workspace member owes — a root whose only tests are its members' owes no config (`member-has-vitest-config`)", () => {
        // Given - a workspace root that delegates `test` and holds no test file of its own, while `packages/clean` holds one
        // Then - the root is silent: the walk stops at the next package.json
        expect(codes(WORKSPACE)).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — a config that gives every file it collects a drawing of a browser (`no-simulated-dom-in-config`)', () => {
        // Given - a member whose config names happy-dom
        const [violation] = runMember(memberAt('simulated-dom'), WORKSPACE, CHECKER);

        // Then - the finding names the line and the move
        expect(violation?.rule).toBe('no-simulated-dom-in-config');
        expect(violation?.line).toBe(5);
        expect(violation === undefined ? '' : checkerMessage(CHECKER, violation)).toContain(
            'a drawing of a browser',
        );
    });

    test('members — members — the member pass — what a workspace member owes — a dependency the framework carries, and a seam it replaced (`no-redundant-test-dependency`)', () => {
        // Given - a member declaring msw, a testing-library package, and the optional peer a consumer declares on purpose
        const found = runMember(memberAt('seam-dependency'), WORKSPACE, CHECKER);

        // Then - the two are named, each by what it actually is, and playwright - an optional peer a consumer declares - is not
        expect(found.map((violation) => violation.rule)).toStrictEqual([
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
        ]);
        expect(found[0] === undefined ? '' : checkerMessage(CHECKER, found[0])).toContain(
            '@testing-library/react',
        );
        expect(found[0] === undefined ? '' : checkerMessage(CHECKER, found[0])).toContain(
            'is a seam `@jterrazz/test` replaced',
        );
        expect(found[1] === undefined ? '' : checkerMessage(CHECKER, found[1])).toContain(
            '`msw` is a transitive of `@jterrazz/test`',
        );
        expect(found.every((violation) => !violation.found.includes('playwright'))).toBe(true);
    });

    test('members — members — the member pass — what a workspace member owes — a finding points at the line the declaration is written on (`no-redundant-test-dependency`)', () => {
        // Given - the same member, whose manifest spells msw on its own line
        const found = runMember(memberAt('seam-dependency'), WORKSPACE, CHECKER);

        // Then - the anchor is the declaration, not the opening brace
        expect(found.map((violation) => violation.line)).toStrictEqual([4, 5]);
    });

    test("members — members — the member pass — what a workspace member owes — a runtime `yaml` is the product's, a dev one is the seam's (`no-redundant-test-dependency`)", () => {
        // Given - `clean` declares yaml as a RUNTIME dependency
        // Then - nothing fires: the framework never ships its yaml to a product
        expect(codes(memberAt('clean'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — a member that owes nothing produces nothing', () => {
        // Given - a member with a config, a test script and only optional peers
        // Then - the pass is silent
        expect(codes(memberAt('clean'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the RN testing library stands where jest is the runner (`no-redundant-test-dependency`)', () => {
        // Given - a member whose test script is jest and whose vocabulary is the React Native one
        // Then - nothing fires: the facet that would replace it does not reach that runtime yet
        expect(codes(memberAt('rn-jest'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the RN testing library stands where jest runs it from ONE MEMBER AWAY (`no-redundant-test-dependency`)', () => {
        // Given - a library whose own script is `vitest --run`, whose render tests are co-located in its `src/`, and an app beside it whose jest config roots into exactly that folder
        // Then - nothing fires: jest runs those tests, and where it runs them from is not the library's business
        expect(codes(memberAt('rn-library'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the allowance reads the same from INSIDE the member as from the root (`no-redundant-test-dependency`)', () => {
        // Given - the run that member's own gate makes: anchored at the member, where the app that runs its tests is above the anchor, never below it
        const anchored = codes(memberAt('rn-library'), memberAt('rn-library'));

        // Then - the two directions agree, which is the contract the path-less run rests on
        expect(anchored).toStrictEqual([]);
        expect(anchored).toStrictEqual(codes(memberAt('rn-library')));
    });

    test('members — members — the member pass — what a workspace member owes — a jest config that reaches ANOTHER member clears nothing here (`no-redundant-test-dependency`)', () => {
        // Given - the same workspace, read from the member the playground does NOT root into
        // Then - the seam is still refused: the allowance follows the tests, not the workspace
        expect(codes(memberAt('seam-dependency'))).toStrictEqual([
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
        ]);
    });

    test('members — members — the member pass — what a workspace member owes — a member whose own root is the specs tree holds specs, not strays (`file-suffix-matches-place`)', () => {
        // Given - `@fixture/specs-rooted`, a member declared as `specs` (spwn's shape), holding `cli/agent/agent-list.spec.ts`
        // Then - the member pass reads the tree it IS: nothing is outside a specs tree here
        expect(codes(resolve(WORKSPACE, 'specs'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — a folder of code named like ground is read below the member, never above it (`no-snapshot-folder`)', () => {
        // Given - a package checked out under a folder named `specs/`, whose `src/goldens/` is matcher source
        const member = checkoutUnder('specs', ['src/goldens']);
        writeFileSync(join(member, 'src/goldens/matchers.ts'), 'export const golden = 1;\n');

        // Then - the `specs` above the checkout is the machine's: the folder holds code, and stays
        expect(codes(member, member)).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — every member is judged in one run', () => {
        // Given - the whole fixture workspace
        const found = runMembers(WORKSPACE, CHECKER).map((violation) => violation.rule);

        // Then - one `member-has-vitest-config`, one `no-simulated-dom-in-config`, three `no-redundant-test-dependency` and one `file-suffix-matches-place`, whatever the order they walk in
        expect(found.toSorted()).toStrictEqual([
            'file-suffix-matches-place',
            'member-has-vitest-config',
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
            'no-simulated-dom-in-config',
        ]);
    });
});
