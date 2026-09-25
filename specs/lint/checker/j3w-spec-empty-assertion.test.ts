import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('j3w-spec-empty-assertion', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('warns about a stream that is only {{any}}', async () => {
        // Given - a run that executes and proves nothing
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/j3w-spec-empty-assertion/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:6:1: warning jterrazz-check(j3w): found: a stream that is only {{string}} · why: An expected stream whose whole content is \`{{string}}\` → warning: the run executes and proves nothing. · fix: write what the command actually printed, tokens for what moves · read: docs/19-linting.md#j3w-spec-empty-assertion
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
