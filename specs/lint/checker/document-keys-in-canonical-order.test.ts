import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('document-keys-in-canonical-order', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a document whose runs sit above its env', async () => {
        // Given - a document declaring runs: before env:
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/document-keys-in-canonical-order/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:7:1: error jterrazz-check(document-keys-in-canonical-order): found: "env:" after "runs:" in a spec document · why: The keys of a \`<case>.spec.yaml\` follow the canonical order — \`description, fixture, env, serve, runs\` at document level, \`command, stdin, timeout, waitFor, exit, stdout, stderr, files\` inside a run. · fix: order the keys description, fixture, env, serve, runs — \`make fix\` reorders them · read: docs/19-linting.md#document-keys-in-canonical-order

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
