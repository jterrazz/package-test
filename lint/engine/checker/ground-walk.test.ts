import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { Finding } from './finding.js';
import { walkGround } from './ground-walk.js';
import type { GroundPasses } from './registry.js';

const TREE = resolve(
    import.meta.dirname,
    '../../../specs/lint/checker/fixtures/lint-violations/no-unknown-token',
);

function visited(kind: string, rel: string): Finding {
    return { file: rel, fix: '', found: kind, line: 1, rule: 'probe', severity: 'error' };
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
        // Given - a specs tree holding one test and one file under expected/
        // Then - the one ground file reaches the expected pass, at the top of its folder, and the test reaches none
        expect(walkGround(resolve(TREE, 'specs'), RECORDING)).toStrictEqual([
            visited('expected at top', 'widget/expected/out.txt'),
        ]);
    });

    test('walks nothing under a folder that does not exist', () => {
        // Given - a root nothing was written at
        // Then - no pass is handed anything
        expect(walkGround(resolve(TREE, 'nowhere'), RECORDING)).toStrictEqual([]);
    });
});
