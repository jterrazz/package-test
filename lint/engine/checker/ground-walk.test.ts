import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { walkGround } from './ground-walk.js';
import type { GroundPasses, Spotted } from './registry.js';

const TREE = resolve(
    import.meta.dirname,
    '../../../specs/lint/no-unknown-token/_fixtures/no-unknown-token',
);

function visited(kind: string, rel: string): Spotted {
    return { path: rel, fix: '', found: kind, line: 1, rule: 'probe' };
}

const RECORDING: GroundPasses = {
    document: ({ rel }) => [visited('document', rel)],
    expected: ({ atTop, rel }) => [visited(atTop ? 'expected at top' : 'expected', rel)],
    read: () => [],
    request: ({ rel }) => [visited('request', rel)],
    seed: ({ rel }) => [visited('seed', rel)],
};

describe('walkGround', () => {
    test('hands each ground file to the pass of the folder it sits in, and leaves a test file alone', () => {
        // Given - a specs tree holding one test and one file under _expected/
        // Then - the one ground file reaches the expected pass, at the top of its folder, and the test reaches none
        expect(walkGround(resolve(TREE, 'specs'), RECORDING)).toStrictEqual([
            visited('expected at top', 'widget/_expected/out.txt'),
        ]);
    });

    test('walks nothing under a folder that does not exist', () => {
        // Given - a root nothing was written at
        // Then - no pass is handed anything
        expect(walkGround(resolve(TREE, 'nowhere'), RECORDING)).toStrictEqual([]);
    });
});
