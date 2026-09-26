import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runMember } from '../../engine/checker/member-run.js';
import { checkerMessage } from '../../engine/checker/tree-run.js';
import { CHECKER } from './checker.js';

const WORKSPACE = resolve(import.meta.dirname, '../../../specs/_shared/_fixtures/member-workspace');
const memberAt = (name: string): string => resolve(WORKSPACE, 'packages', name);

describe('checkNoSimulatedDomInConfig', () => {
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
});
