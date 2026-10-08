import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { specsTree } from '../../../__tests__/subject.fixtures.js';
import { walkGround } from '../ground-walk.js';
import type { GroundPasses, Spotted } from '../registry.js';

const TREE = resolve(
    import.meta.dirname,
    '../../../../specs/lint/no-unknown-token/__fixtures__/no-unknown-token',
);

function visited(kind: string, rel: string): Spotted {
    return { path: rel, fix: '', found: kind, line: 1, rule: 'probe' };
}

const RECORDING: GroundPasses = {
    document: ({ rel }) => [visited('document', rel)],
    expected: ({ atTop, rel }) => [visited(atTop ? 'expected at top' : 'expected', rel)],
    read: () => [{ fix: '', found: 'read', line: 1, rule: 'probe' }],
    request: ({ rel }) => [visited('request', rel)],
    seed: ({ rel }) => [visited('seed', rel)],
};

describe('walkGround', () => {
    test('hands each ground file to the pass of the folder it sits in, and leaves a test file alone', () => {
        // Given - a specs tree holding one test and one file under __expected__/
        // Then - the one ground file reaches the expected pass, at the top of its folder, and the test reaches none
        expect(walkGround(resolve(TREE, 'specs'), RECORDING)).toStrictEqual([
            visited('expected at top', 'widget/__expected__/out.txt'),
        ]);
    });

    test('walks nothing under a folder that does not exist', () => {
        // Given - a root nothing was written at
        // Then - no pass is handed anything
        expect(walkGround(resolve(TREE, 'nowhere'), RECORDING)).toStrictEqual([]);
    });

    test('hands every file of every ground folder to its pass, reads each readable document, and skips what a tree prunes', () => {
        // Given - each ground folder, a nested file, binary files, documents readable and not, and ground under pruned folders
        const root = specsTree({
            'node_modules/dep/__expected__/hidden.txt': 'x\n',
            'widget/__expected__/nested/deep.txt': 'x\n',
            'widget/__expected__/out.txt': 'x\n',
            'widget/__expected__/shot.png': 'x\u0000y',
            'widget/__fixtures__/__expected__/hidden.txt': 'x\n',
            'widget/__requests__/create.http': 'POST /x\n',
            'widget/__requests__/upload.bin': 'x\u0000y',
            'widget/__seeds__/one.sql': 'select 1;\n',
            'widget/__seeds__/two.bin': 'x\u0000y',
            'widget/binary.spec.yaml': 'x\u0000y',
            'widget/broken.spec.yaml': 'runs: [\n',
            'widget/case.spec.yaml': 'description: reads\nruns:\n  - command: a\n    exit: 0\n',
            'widget/loose.txt': 'x\n',
        });

        // Then - each file at the pass of its folder, at the top or below it, and the documents read when they parse
        expect(
            walkGround(root, RECORDING)
                .map(({ found, path }) => `${found} ${path}`)
                .toSorted(),
        ).toStrictEqual([
            'document widget/binary.spec.yaml',
            'document widget/broken.spec.yaml',
            'document widget/case.spec.yaml',
            'expected at top widget/__expected__/out.txt',
            'expected widget/__expected__/nested/deep.txt',
            'read widget/case.spec.yaml',
            'request widget/__requests__/create.http',
            'seed widget/__seeds__/one.sql',
            'seed widget/__seeds__/two.bin',
        ]);
    });
});
