import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runMember } from '../../engine/checker/member-run.js';
import { checkerMessage } from '../../engine/checker/tree-run.js';
import { CHECKER } from './checker.js';

const WORKSPACE = resolve(import.meta.dirname, '../../../specs/shared/fixtures/member-workspace');
const memberAt = (name: string): string => resolve(WORKSPACE, 'packages', name);

function codes(dir: string, root = WORKSPACE): string[] {
    return runMember(dir, root, CHECKER).map((violation) => violation.rule);
}

describe('checkMemberHasVitestConfig', () => {
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
});
