import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('document-env-and-serve-registered', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects env and serve names no runner registers', async () => {
        // Given - a typo in both registries, beside a specification file that has neither
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/document-env-and-serve-registered/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:3:1: error jterrazz-check(document-env-and-serve-registered): found: env: "frozn", which no specification registers · why: A document's bare \`env:\` words and \`serve:\` names are keys of the \`env\`/\`serve\` objects of a \`specification.cli(…)\` in the nearest directory carrying \`*.specification.ts\` files (literals read statically; ignored otherwise). · fix: name one of frozen, or register "frozn" in \`specification.cli({ env })\` · read: docs/19-linting.md#document-env-and-serve-registered
            specs/widget/builds.spec.yaml:5:1: error jterrazz-check(document-env-and-serve-registered): found: serve: "dashbord", which no specification registers · why: A document's bare \`env:\` words and \`serve:\` names are keys of the \`env\`/\`serve\` objects of a \`specification.cli(…)\` in the nearest directory carrying \`*.specification.ts\` files (literals read statically; ignored otherwise). · fix: name one of api, or register "dashbord" in \`specification.cli({ serve })\` · read: docs/19-linting.md#document-env-and-serve-registered

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
