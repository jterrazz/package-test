import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('pinned-value-from-the-input', () => {
    test('refuses a timestamp no fixture fixed', async () => {
        // Given - a golden spelling an ISO-8601 instant out
        const result = await checker
            .fixture(directory('./_fixtures/pinned-value-from-the-input/'))
            .run();

        // Then - the pass names the document, the line and what to write instead
        expect(result.report).toMatch(`
            specs/widget/stamps.spec.yaml:6:1  jterrazz-check(pinned-value-from-the-input)
                found: "2026-07-17T10:00:00.000Z", which no \`fixture:\` or \`stdin:\` of this document pins
                why: A literal ISO-8601 timestamp or uuid in an expected stream of a \`<case>.spec.yaml\` → error, unless the same value appears in a \`fixture:\`, the document's sibling \`_fixtures/\`, a \`stdin:\`, a command argument or an \`env:\`/\`serve:\` value of the same document (it is then pinned, not volatile).
                fix: write {{string}} where "2026-07-17T10:00:00.000Z" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document
                read: docs/19-linting.md#pinned-value-from-the-input
        `);
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .run();

        // Then - the clean summary (0 warnings) on stdout
        expect(result.report).toMatch('');
    });
});
