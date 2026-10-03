import { describe, expect, test } from 'vitest';

import { parseSpecDocument } from '../../kit/project/spec-document.js';
import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import {
    checkNoVolatileLiteral,
    noVolatileLiteralsInGround,
    volatileLiteralIn,
} from './no-volatile-literal.js';

describe('no-volatile-literal', () => {
    test.each([
        [
            'listening on localhost:3000',
            { found: 'localhost:3000', token: '{{url}} (or {{port}})', word: 'localhost:3000' },
        ],
        [
            'cd /private/tmp/abc/x;',
            { found: '/private/tmp/', token: '{{workdir}}', word: '/private/tmp/abc/x' },
        ],
        [
            '/var/folders/x/y',
            { found: '/var/folders/', token: '{{workdir}}', word: '/var/folders/x/y' },
        ],
        [
            'home="/Users/ada/x"',
            { found: '/Users/ada/', token: '{{workdir}} or {{path}}', word: '/Users/ada/x' },
        ],
        [
            "('/home/bo/z')",
            { found: '/home/bo/', token: '{{workdir}} or {{path}}', word: '/home/bo/z' },
        ],
        [
            'at http://localhost:3000/x',
            {
                found: 'localhost:3000',
                token: '{{url}} (or {{port}})',
                word: 'http://localhost:3000/x',
            },
        ],
        ['at {{workdir}}/tmp/x', undefined],
        ['at {{url}} and {{port}}', undefined],
        ['a calm line', undefined],
    ])('the line %j holds %j', (line, volatile) => {
        // Given - a line of an asserted stream
        // Then - the volatile value, without the character before it, and the whole word around it
        expect(volatileLiteralIn(line)).toStrictEqual(volatile);
    });

    test('a document names each volatile line of its streams, unless it states the value itself', () => {
        // Given - a document whose stdout holds two volatile values, one of them stated by its command
        const document = parseSpecDocument(
            [
                'description: serves',
                'runs:',
                '  - command: serve --dir /tmp/kept/a',
                '    exit: 0',
                '    stdout: |',
                '      calm',
                '      saved to /tmp/kept/a',
                '      listening on localhost:3000',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - the one the run minted, at its line
        expect(checkNoVolatileLiteral(document, packageWith({}))).toStrictEqual([
            {
                fix: 'write {{url}} (or {{port}}) where "localhost:3000" stands',
                found: '"localhost:3000", a value the next run will not reproduce',
                line: 8,
                rule: 'no-volatile-literal',
            },
        ]);
    });

    test('a ground file names each volatile line it holds', () => {
        // Given - a golden with a volatile value on its second line
        // Then - that line, with what to write in its place
        expect(
            noVolatileLiteralsInGround('specs/x/_expected/a.txt', 'calm\nat /tmp/run/x\n'),
        ).toStrictEqual([
            {
                fix: 'write {{workdir}} where "/tmp/" stands',
                found: '"/tmp/", a value the next run will not reproduce',
                line: 2,
                path: 'specs/x/_expected/a.txt',
                rule: 'no-volatile-literal',
            },
        ]);
    });
});
