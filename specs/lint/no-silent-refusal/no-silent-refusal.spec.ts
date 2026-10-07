import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('no-silent-refusal', () => {
    test('refuses a non-zero exit with neither stream', async () => {
        // Given - a refusal the document never quotes
        const result = await checker.fixture(directory('./__fixtures__/no-silent-refusal/')).run();

        // Then - the pass names the document, the line and what to write instead
        expect(result.report).toMatch(`
            specs/widget/refuses.spec.yaml:3:1  jterrazz-check(no-silent-refusal)
                found: \`exit: 1\` with no \`stdout:\` and no \`stderr:\`
                why: A run whose \`exit:\` is non-zero with neither \`stdout:\` nor \`stderr:\` → error: the document does not say why the command refused.
                fix: write the words the refusal printed under \`stderr:\` (or \`stdout:\`)
                read: docs/reference/linting.md#no-silent-refusal
        `);
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await checker
            .fixture(directory('../../__fixtures__/spec-document-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
