import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('no-empty-expected-stream', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('warns about a stream that is only {{any}}', async () => {
        // Given - a run that executes and proves nothing
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-empty-expected-stream/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:6:1: warning jterrazz-check(no-empty-expected-stream): found: a stream that is only {{string}} · why: An expected stream whose whole content is \`{{string}}\` → warning: the run executes and proves nothing. · fix: write what the command actually printed, tokens for what moves · read: docs/19-linting.md#no-empty-expected-stream
        `);
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/spec-document-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./_expected/clean.txt'));
    });
});
