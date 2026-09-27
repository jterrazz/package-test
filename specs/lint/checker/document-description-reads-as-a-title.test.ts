import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('document-description-reads-as-a-title', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a description that is a capitalised sentence', async () => {
        // Given - a description: starting on a capital and ending on a period
        const result = await cli
            .fixture(
                directory('./_fixtures/lint-violations/document-description-reads-as-a-title/'),
            )
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:1:1: error jterrazz-check(document-description-reads-as-a-title): found: a \`description:\` ending with a period · why: A document's \`description:\` is a title: one line, lowercase initial (an all-caps identifier exempted), no trailing period, under 100 characters. · fix: drop the period — a title is a fragment, not a sentence · read: docs/19-linting.md#document-description-reads-as-a-title
            specs/widget/builds.spec.yaml:1:1: error jterrazz-check(document-description-reads-as-a-title): found: a \`description:\` starting with a capital · why: A document's \`description:\` is a title: one line, lowercase initial (an all-caps identifier exempted), no trailing period, under 100 characters. · fix: start it lowercase: "builds the widget." · read: docs/19-linting.md#document-description-reads-as-a-title

            conventions checker: 2 error(s) found under {{workdir}}
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
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
