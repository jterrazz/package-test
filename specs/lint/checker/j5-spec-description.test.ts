import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('lint — j5 spec description (CONVENTIONS J5)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects a description that is a capitalised sentence', async () => {
        // Given - a description: starting on a capital and ending on a period
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/j5-spec-description/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:1:1: error jterrazz-check(j5): found: a \`description:\` ending with a period · why: A document's \`description:\` is a title: one line, lowercase initial (an all-caps identifier exempted), no trailing period, under 100 characters. · fix: drop the period — a title is a fragment, not a sentence · read: docs/19-linting.md#j5-spec-description
            specs/widget/builds.spec.yaml:1:1: error jterrazz-check(j5): found: a \`description:\` starting with a capital · why: A document's \`description:\` is a title: one line, lowercase initial (an all-caps identifier exempted), no trailing period, under 100 characters. · fix: start it lowercase: "builds the widget." · read: docs/19-linting.md#j5-spec-description

            conventions checker: 2 error(s) found under {{workdir}}
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
