import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { fixedData, isBlock, listSpecFiles, runMaps, streamScalars } from '../document-model.js';
import { parseSpecDocument, readSpecFile } from '../spec-document.js';

const STREAMS = [
    'description: reads its streams',
    'runs:',
    '  - command: a',
    '    stdin: in',
    '    exit: 0',
    '    stdout: |',
    '      out',
    '    stderr: err',
    '    files:',
    '      a.txt:',
    '        contains: [needle]',
    '        equals: whole',
    '      b.txt: absent',
    '      c.txt:',
    '        contains: other',
    '',
].join('\n');

describe('document-model', () => {
    test('listSpecFiles — every document below, past the fixtures ground and the pruned folders', () => {
        // Given - documents at two depths, one under __fixtures__/, one under node_modules/, and a file that is no document
        const root = packageWith({
            'specs/cli/__fixtures__/inner.spec.yaml': '',
            'specs/cli/build/deep.spec.yaml': '',
            'specs/cli/node_modules/x/dep.spec.yaml': '',
            'specs/cli/notes.yaml': '',
            'specs/cli/top.spec.yaml': '',
        });

        // Then - the two documents of the tree
        expect(
            listSpecFiles(join(root, 'specs'))
                .map((path) => relative(root, path))
                .toSorted(),
        ).toStrictEqual(['specs/cli/build/deep.spec.yaml', 'specs/cli/top.spec.yaml']);
    });

    test('streamScalars — the stdin, stdout and stderr of a run, and the equals of each file, keyed by where they sit', () => {
        // Given - a run with every stream, a file with contains and equals, a state, and a file with contains alone
        const [run] = runMaps(readSpecFile(STREAMS, 'case.spec.yaml'));

        // Then - each stream scalar, block or not
        expect(
            (run === undefined ? [] : streamScalars(run)).map(({ key, scalar }) => [
                key,
                scalar.value,
                isBlock(scalar),
            ]),
        ).toStrictEqual([
            ['stdin', 'in', false],
            ['stdout', 'out\n', true],
            ['stderr', 'err', false],
            ['files.a.txt.equals', 'whole', false],
        ]);
    });

    test('fixedData — what a document hands its command: stdin, commands, env, served values and every fixture file', () => {
        // Given - a document naming a fixture file and a fixture tree, beside a sibling __fixtures__/
        const root = packageWith({
            'specs/cli/build/__fixtures__/one.json': '{"id": "named"}',
            'specs/cli/build/__fixtures__/tree/a.txt': 'nested a',
            'specs/cli/build/__fixtures__/tree/sub/b.txt': 'nested b',
        });
        const document = parseSpecDocument(
            [
                'description: hands its data',
                'fixture: [./__fixtures__/tree/, ./__fixtures__/gone.json]',
                'env: [CI, MODE=fast]',
                'serve: [{ web: { PORT: "8080" } }]',
                'runs:',
                '  - command: first',
                '    stdin: piped',
                '    exit: 0',
                '  - command: second',
                '    exit: 0',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - each value on its own line, the fixture tree, then the whole sibling __fixtures__/
        expect(fixedData(document, join(root, 'specs/cli/build')).split('\n')).toStrictEqual([
            'piped',
            'first',
            '',
            'second',
            'CI',
            'MODE=fast',
            'web',
            '8080',
            'nested a',
            'nested b',
            '{"id": "named"}',
            'nested a',
            'nested b',
        ]);
    });
});
