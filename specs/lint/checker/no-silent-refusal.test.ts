import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('no-silent-refusal', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('warns about a non-zero exit with neither stream', async () => {
        // Given - a refusal the document never quotes
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-silent-refusal/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            specs/widget/refuses.spec.yaml:3:1: warning jterrazz-check(no-silent-refusal): found: \`exit: 1\` with no \`stdout:\` and no \`stderr:\` · why: A run whose \`exit:\` is non-zero with neither \`stdout:\` nor \`stderr:\` → warning: the document does not say why the command refused. · fix: write the words the refusal printed under \`stderr:\` (or \`stdout:\`) · read: docs/19-linting.md#no-silent-refusal
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
