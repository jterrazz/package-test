import { describe, expect, test } from 'vitest';

import { parseSpecDocument } from '../../kit/project/spec-document.js';
import { checkNoEmptyExpectedStream } from './no-empty-expected-stream.js';

describe('checkNoEmptyExpectedStream', () => {
    test('a stream that is {{any}} and nothing else is found, wherever the document asserts it', () => {
        // Given - streams of tokens alone, of words around a token, of words alone, and file contents of each
        const document = parseSpecDocument(
            [
                'description: prints what it prints',
                'runs:',
                '    - command: a',
                '      exit: 0',
                '      stdout: "{{any}}"',
                '      stderr: |',
                '          {{any}} {{any}}',
                '    - command: b',
                '      exit: 0',
                '      stdout: "built {{any}}"',
                '      stderr: "warned"',
                '      files:',
                '          out.txt:',
                '              contains: ["{{any}}", "done"]',
                '              equals: " {{any}} "',
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - the stdout and stderr of the first run, and the token-only content of the file
        expect(
            checkNoEmptyExpectedStream(document).map(
                ({ fix, found, line, rule }) => `${rule} ${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'no-empty-expected-stream 5 a stream that is only {{any}} — write what the command actually printed, tokens for what moves',
            'no-empty-expected-stream 7 a stream that is only {{any}} — write what the command actually printed, tokens for what moves',
            'no-empty-expected-stream 14 a stream that is only {{any}} — write what the command actually printed, tokens for what moves',
            'no-empty-expected-stream 15 a stream that is only {{any}} — write what the command actually printed, tokens for what moves',
        ]);
    });
});
