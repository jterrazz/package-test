import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { parseSpecDocument } from '../../../kit/project/spec-document.js';
import { packageWith } from '../../../kit/testing/package-tree.fixtures.js';
import { checkPinnedValueFromTheInput } from '../pinned-value-from-the-input.js';

const PIPED = '0b3d4f6a-1c2e-4a5b-8c9d-0e1f2a3b4c5d';
const LAID = '2024-01-02T03:04:05Z';
const LOOSE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const LOOSE_TIME = '2025-06-07T08:09:10.123+02:00';

describe('checkPinnedValueFromTheInput', () => {
    test('a time or id a stream asserts is pinned by what the document hands its command, or found on its line', () => {
        // Given - a document piping one id, laying a fixture holding one time, and asserting those beside values nothing pins
        const root = packageWith({
            'specs/cli/build/__fixtures__/data.json': `{ "at": "${LAID}" }`,
        });
        const document = parseSpecDocument(
            [
                'description: pins its values',
                'runs:',
                '  - command: a',
                `    stdin: "${PIPED}"`,
                '    exit: 0',
                '    stdout: |',
                `      id ${PIPED}`,
                `      at ${LAID}`,
                `      new ${LOOSE_ID} at ${LOOSE_TIME}`,
                '    files:',
                '      out.txt:',
                `        equals: "${LOOSE_ID}"`,
                '',
            ].join('\n'),
            'case.spec.yaml',
        );

        // Then - each unpinned value on its line, a time and an id on the same line apart
        expect(
            checkPinnedValueFromTheInput(document, join(root, 'specs/cli/build')).map(
                ({ fix, found, line, rule }) => `${rule} ${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            `pinned-value-from-the-input 9 "${LOOSE_TIME}", which no \`fixture:\` or \`stdin:\` of this document pins — write {{iso8601}} where "${LOOSE_TIME}" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document`,
            `pinned-value-from-the-input 9 "${LOOSE_ID}", which no \`fixture:\` or \`stdin:\` of this document pins — write {{uuid}} where "${LOOSE_ID}" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document`,
            `pinned-value-from-the-input 12 "${LOOSE_ID}", which no \`fixture:\` or \`stdin:\` of this document pins — write {{uuid}} where "${LOOSE_ID}" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document`,
        ]);
    });
});
