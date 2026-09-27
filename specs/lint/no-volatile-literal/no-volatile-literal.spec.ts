import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { lint as checker } from '../checker-lint.specification.js';

describe('no-volatile-literal', () => {
    test('rejects a loopback origin pinned in a stream', async () => {
        // Given - a golden carrying the port one run happened to get
        const result = await checker.fixture(directory('./_fixtures/no-volatile-literal/')).run();

        // Then - the pass names the document, the line and what to write instead
        expect(result.report).toMatch(`
            specs/widget/serves.spec.yaml:6:1  jterrazz-check(no-volatile-literal)
                found: "127.0.0.1:52341", a value the next run will not reproduce
                why: No expected output carries a literal volatile value: a loopback origin with a port (\`127.0.0.1:8080\`, \`localhost:3000\`), an absolute temporary path (\`/tmp/\`, \`/private/tmp/\`, \`/var/folders/\`) or a home path (\`/Users/…\`, \`/home/…\`).
                fix: write {{string}} (or {{string}}) where "127.0.0.1:52341" stands
                read: docs/19-linting.md#no-volatile-literal
        `);
    });

    test('rejects the same literal under `_expected/`, which is the other half of the reach', async () => {
        // Given - a golden file pinning a temp directory and a loopback port
        const result = await checker
            .fixture(directory('./_fixtures/no-volatile-literal-in-ground/'))
            .run();

        // Then - ground is judged by the list documents are judged by: one rule, one reach
        expect(result.report).toMatch(`
            specs/cli/report/_expected/summary.txt:1:1  jterrazz-check(no-volatile-literal)
                found: "/tmp/", a value the next run will not reproduce
                why: No expected output carries a literal volatile value: a loopback origin with a port (\`127.0.0.1:8080\`, \`localhost:3000\`), an absolute temporary path (\`/tmp/\`, \`/private/tmp/\`, \`/var/folders/\`) or a home path (\`/Users/…\`, \`/home/…\`).
                fix: write {{string}} where "/tmp/" stands
                read: docs/19-linting.md#no-volatile-literal
            specs/cli/report/_expected/summary.txt:2:1  jterrazz-check(no-volatile-literal)
                found: "127.0.0.1:52341", a value the next run will not reproduce
                why: No expected output carries a literal volatile value: a loopback origin with a port (\`127.0.0.1:8080\`, \`localhost:3000\`), an absolute temporary path (\`/tmp/\`, \`/private/tmp/\`, \`/var/folders/\`) or a home path (\`/Users/…\`, \`/home/…\`).
                fix: write {{string}} (or {{string}}) where "127.0.0.1:52341" stands
                read: docs/19-linting.md#no-volatile-literal
        `);
    });

    test('accepts every literal the document itself pinned', async () => {
        // Given - the estate's own shape: a document whose command carries the instant and the work directory it then asserts, a pool `fixture:` holding the stamp, and a sibling `_fixtures/` holding the origin
        const result = await checker
            .fixture(directory('./_fixtures/no-volatile-literal-pinned-by-the-document/'))
            .run();

        // Then - nothing is reported by either half: the defect is not the literal, it is the literal nobody pinned
        expect(result.report).toMatch('');
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
