import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('document-description-unique', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects two documents of one directory sharing a description', async () => {
        // Given - two .spec.yaml files whose description: is the same sentence
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/document-description-unique/'))
            .exec('.');

        // Then - the second one is named, with the first it collides with
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/rebuilds.spec.yaml:1:1: error jterrazz-check(document-description-unique): found: "builds the widget", already the description of widget/builds.spec.yaml · why: Two \`<case>.spec.yaml\` documents in one directory do not share a \`description:\`. · fix: retitle one of the two for what it proves apart from the other · read: docs/19-linting.md#document-description-unique

            conventions checker: 1 error(s) found under {{workdir}}
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
