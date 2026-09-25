import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('d5-spec-volatile-literal', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a loopback origin pinned in a stream', async () => {
        // Given - a golden carrying the port one run happened to get
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d5-spec-volatile-literal/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/serves.spec.yaml:6:1: error jterrazz-check(d5): found: "127.0.0.1:52341", a value the next run will not reproduce · why: No expected output carries a literal volatile value: a loopback origin with a port (\`127.0.0.1:8080\`, \`localhost:3000\`), an absolute temporary path (\`/tmp/\`, \`/private/tmp/\`, \`/var/folders/\`) or a home path (\`/Users/…\`, \`/home/…\`). · fix: write {{string}} (or {{string}}) where "127.0.0.1:52341" stands · read: docs/19-linting.md#d5-spec-volatile-literal

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('rejects the same literal under `expected/`, which is the other half of the reach', async () => {
        // Given - a golden file pinning a temp directory and a loopback port
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d5-ground-volatile-literal/'))
            .exec('.');

        // Then - ground is judged by the list documents are judged by: one rule, one reach
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/cli/report/expected/summary.txt:1:1: error jterrazz-check(d5): found: "/tmp/", a value the next run will not reproduce · why: No expected output carries a literal volatile value: a loopback origin with a port (\`127.0.0.1:8080\`, \`localhost:3000\`), an absolute temporary path (\`/tmp/\`, \`/private/tmp/\`, \`/var/folders/\`) or a home path (\`/Users/…\`, \`/home/…\`). · fix: write {{string}} where "/tmp/" stands · read: docs/19-linting.md#d5-spec-volatile-literal
            specs/cli/report/expected/summary.txt:2:1: error jterrazz-check(d5): found: "127.0.0.1:52341", a value the next run will not reproduce · why: No expected output carries a literal volatile value: a loopback origin with a port (\`127.0.0.1:8080\`, \`localhost:3000\`), an absolute temporary path (\`/tmp/\`, \`/private/tmp/\`, \`/var/folders/\`) or a home path (\`/Users/…\`, \`/home/…\`). · fix: write {{string}} (or {{string}}) where "127.0.0.1:52341" stands · read: docs/19-linting.md#d5-spec-volatile-literal

            conventions checker: 2 error(s) found under {{workdir}}
        `);
    });

    test('accepts every literal the document itself pinned', async () => {
        // Given - the estate's own shape: a document whose command carries the instant and the work directory it then asserts, a pool `fixture:` holding the stamp, and a sibling `fixtures/` holding the origin
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/d5-pinned-by-the-document/'))
            .exec('.');

        // Then - nothing is reported by either half: the defect is not the literal, it is the literal nobody pinned
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/clean.txt'));
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
