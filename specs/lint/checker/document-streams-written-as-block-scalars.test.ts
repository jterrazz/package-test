import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('document-streams-written-as-block-scalars', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a stream written as a quoted string', async () => {
        // Given - a stdout: spelled with backslash-n escapes
        const result = await cli
            .fixture(
                directory('./fixtures/lint-violations/document-streams-written-as-block-scalars/'),
            )
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:5:1: error jterrazz-check(document-streams-written-as-block-scalars): found: stdout written as a quoted scalar · why: \`stdout\`, \`stderr\`, \`stdin\` and \`files.*.equals\` of a \`<case>.spec.yaml\` are written as block scalars (\`|\` keeps the trailing newline, \`|-\` drops it), never as a quoted string carrying \`\\n\`. · fix: write stdout as a block scalar (\`|\` keeps the final newline, \`|-\` drops it) — \`make fix\` re-styles it · read: docs/19-linting.md#document-streams-written-as-block-scalars

            conventions checker: 1 error(s) found under {{workdir}}
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
