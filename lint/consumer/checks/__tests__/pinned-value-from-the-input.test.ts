import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { parseSpecDocument } from '../../../kit/project/spec-document.js';
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
        const source = [
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
        ].join('\n');
        const document = parseSpecDocument(source, 'case.spec.yaml');

        // Then - each unpinned value on its line, a time and an id on the same line apart
        expect(
            checkPinnedValueFromTheInput(document, join(root, 'specs/cli/build'), source).map(
                ({ fix, found, line, rule }) => `${rule} ${line} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            `pinned-value-from-the-input 9 "${LOOSE_TIME}", which no \`fixture:\` or \`stdin:\` of this document pins — write {{iso8601}} where "${LOOSE_TIME}" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document`,
            `pinned-value-from-the-input 9 "${LOOSE_ID}", which no \`fixture:\` or \`stdin:\` of this document pins — write {{uuid}} where "${LOOSE_ID}" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document`,
            `pinned-value-from-the-input 12 "${LOOSE_ID}", which no \`fixture:\` or \`stdin:\` of this document pins — write {{uuid}} where "${LOOSE_ID}" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document`,
        ]);
    });

    test('a directive above a stream silences every line of it, inline or block, and nothing else', () => {
        // Given - a block stream and an inline one, each declared, beside an undeclared one
        const source = [
            'description: pins by a stub',
            'runs:',
            '  - command: a',
            '    exit: 0',
            '    # checker-disable-next-line pinned-value-from-the-input -- the stub clock starts there',
            '    stdout: |',
            `      at ${LOOSE_TIME}`,
            `      id ${LOOSE_ID}`,
            '    # checker-disable-next-line pinned-value-from-the-input -- the stub names it',
            `    stderr: "${LOOSE_ID}"`,
            '    files:',
            '      out.txt:',
            `        equals: "${LOOSE_ID}"`,
            '',
        ].join('\n');
        const document = parseSpecDocument(source, 'case.spec.yaml');

        // Then - only the undeclared stream is reported
        expect(
            checkPinnedValueFromTheInput(document, packageWith({}), source).map(({ line }) => line),
        ).toStrictEqual([13]);
    });
});
