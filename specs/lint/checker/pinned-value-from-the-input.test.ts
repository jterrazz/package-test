import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('pinned-value-from-the-input', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('warns about a timestamp no fixture fixed', async () => {
        // Given - a golden spelling an ISO-8601 instant out
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/pinned-value-from-the-input/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            specs/widget/stamps.spec.yaml:6:1: warning jterrazz-check(pinned-value-from-the-input): found: "2026-07-17T10:00:00.000Z", which no \`fixture:\` or \`stdin:\` of this document pins · why: A literal ISO-8601 timestamp or uuid in an expected stream of a \`<case>.spec.yaml\` → warning, unless the same value appears in a \`fixture:\`, the document's sibling \`fixtures/\`, a \`stdin:\`, a command argument or an \`env:\`/\`serve:\` value of the same document (it is then pinned, not volatile). · fix: write {{string}} where "2026-07-17T10:00:00.000Z" stands, or pin the value in a \`fixture:\` or \`stdin:\` of this document · read: docs/19-linting.md#pinned-value-from-the-input
        `);
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/spec-document-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
    });
});
