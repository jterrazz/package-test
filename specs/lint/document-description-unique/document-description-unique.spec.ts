import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('document-description-unique', () => {
    test('rejects two documents of one directory sharing a description', async () => {
        // Given - two .spec.yaml files whose description: is the same sentence
        const result = await checker
            .fixture(directory('./_fixtures/document-description-unique/'))
            .run();

        // Then - the second one is named, with the first it collides with
        expect(result.report).toMatch(`
            specs/widget/rebuilds.spec.yaml:1:1  jterrazz-check(document-description-unique)
                found: "builds the widget", already the description of widget/builds.spec.yaml
                why: Two \`<case>.spec.yaml\` documents in one directory do not share a \`description:\`.
                fix: retitle one of the two for what it proves apart from the other
                read: docs/24-linting.md#document-description-unique
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
