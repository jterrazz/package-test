import { describe, expect, test } from 'vitest';

import { parseSpecDocument } from '../../../kit/project/spec-document.js';
import { checkDocumentDescriptionReadsAsATitle } from '../document-description-reads-as-a-title.js';

function foundFor(description: string): string[] {
    const document = parseSpecDocument(
        `# a case\ndescription: ${JSON.stringify(description)}\nruns:\n  - command: a\n    exit: 0\n`,
        'case.spec.yaml',
    );
    return checkDocumentDescriptionReadsAsATitle(document).map(
        ({ fix, found, line, rule }) => `${rule}:${line} ${found} — ${fix}`,
    );
}

const RULE = 'document-description-reads-as-a-title:2';

describe('checkDocumentDescriptionReadsAsATitle', () => {
    test.each([
        ['lists the orders', []],
        ['GET  orders', []],
        ['x Lists', []],
        ['a'.repeat(100), []],
        [
            'Lists.\nmore',
            [`${RULE} a \`description:\` of several lines — write the vitest title on one line`],
        ],
        [
            'a'.repeat(101),
            [
                `${RULE} a \`description:\` of 101 characters — shorten it under 100 characters — a title, not a paragraph`,
            ],
        ],
        [
            'lists the orders.',
            [
                `${RULE} a \`description:\` ending with a period — drop the period — a title is a fragment, not a sentence`,
            ],
        ],
        [
            'Lists the orders',
            [
                `${RULE} a \`description:\` starting with a capital — start it lowercase: "lists the orders"`,
            ],
        ],
    ])('the description %j reads %j', (description, found) => {
        // Given - a document with that description
        // Then - what keeps it from reading as a title
        expect(foundFor(description)).toStrictEqual(found);
    });
});
