import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('document-description-reads-as-a-title', () => {
    test('rejects a description that is a capitalised sentence', async () => {
        // Given - a description: starting on a capital and ending on a period
        const result = await checker
            .fixture(directory('./_fixtures/document-description-reads-as-a-title/'))
            .run();

        // Then - the pass names the document, the line and what to write instead
        expect(result.report).toMatch(`
            specs/widget/builds.spec.yaml:1:1  jterrazz-check(document-description-reads-as-a-title)
                found: a \`description:\` ending with a period
                why: A document's \`description:\` is a title: one line, lowercase initial (an all-caps identifier exempted), no trailing period, under 100 characters.
                fix: drop the period — a title is a fragment, not a sentence
                read: docs/19-linting.md#document-description-reads-as-a-title
            specs/widget/builds.spec.yaml:1:1  jterrazz-check(document-description-reads-as-a-title)
                found: a \`description:\` starting with a capital
                why: A document's \`description:\` is a title: one line, lowercase initial (an all-caps identifier exempted), no trailing period, under 100 characters.
                fix: start it lowercase: "builds the widget."
                read: docs/19-linting.md#document-description-reads-as-a-title
        `);
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
