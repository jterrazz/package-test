import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('lint — c8 spec registered name (CONVENTIONS C8)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects env and serve names no runner registers', async () => {
        // Given - a typo in both registries, beside a specification file that has neither
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c8-spec-registered-name/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:3:1: error jterrazz-check(c8): found: env: "frozn", which no specification registers · why: A document's bare \`env:\` words and \`serve:\` names are keys of the \`env\`/\`serve\` objects of a \`specification.cli(…)\` in the nearest directory carrying \`*.specification.ts\` files (literals read statically; ignored otherwise). · fix: name one of frozen, or register "frozn" in \`specification.cli({ env })\` · read: docs/19-linting.md#c8-spec-registered-name
            specs/widget/builds.spec.yaml:5:1: error jterrazz-check(c8): found: serve: "dashbord", which no specification registers · why: A document's bare \`env:\` words and \`serve:\` names are keys of the \`env\`/\`serve\` objects of a \`specification.cli(…)\` in the nearest directory carrying \`*.specification.ts\` files (literals read statically; ignored otherwise). · fix: name one of api, or register "dashbord" in \`specification.cli({ serve })\` · read: docs/19-linting.md#c8-spec-registered-name

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
