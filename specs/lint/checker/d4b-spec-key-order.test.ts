import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('d4b-spec-key-order', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects a document whose runs sit above its env', async () => {
        // Given - a document declaring runs: before env:
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d4b-spec-key-order/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:7:1: error jterrazz-check(d4b): found: "env:" after "runs:" in a spec document · why: The keys of a \`<case>.spec.yaml\` follow the canonical order — \`description, fixture, env, serve, runs\` at document level, \`command, stdin, timeout, waitFor, exit, stdout, stderr, files\` inside a run. · fix: order the keys description, fixture, env, serve, runs — \`make fix\` reorders them · read: docs/19-linting.md#d4b-spec-key-order

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
