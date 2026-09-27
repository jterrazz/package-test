import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('no-empty-expected-stream', () => {
    test('refuses a stream that is only {{any}}', async () => {
        // Given - a run that executes and proves nothing
        const result = await checker
            .fixture(directory('./_fixtures/no-empty-expected-stream/'))
            .run();

        // Then - the pass names the document, the line and what to write instead
        expect(result.report).toMatch(`
            specs/widget/builds.spec.yaml:6:1  jterrazz-check(no-empty-expected-stream)
                found: a stream that is only {{any}}
                why: An expected stream whose whole content is \`{{any}}\` → error: the run executes and proves nothing.
                fix: write what the command actually printed, tokens for what moves
                read: docs/19-linting.md#no-empty-expected-stream
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
