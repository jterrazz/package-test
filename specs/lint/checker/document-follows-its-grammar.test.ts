import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('document-follows-its-grammar', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a key outside the closed set', async () => {
        // Given - a document carrying a `when:` line
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/document-follows-its-grammar/'))
            .exec('.');

        // Then - the grammar the runner parses is the grammar the lint enforces
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/builds.spec.yaml:2:1: error jterrazz-check(document-follows-its-grammar): found: unknown key "when:" in a spec document — known keys: description, fixture, env, serve, runs · why: A \`<case>.spec.yaml\` document follows its grammar: closed keys — \`description\`, \`fixture\`, \`env\`, \`serve\`, \`runs\` — and closed keys inside a run; \`description:\` and \`runs:\` required; \`command:\` and \`exit:\` required in every run, \`exit:\` an integer literal, \`waitFor:\` only on the last run and never with \`stdin:\`, a \`files:\` path relative and under the workdir; every \`fixture:\` path relative, reaching \`_fixtures/\`. · fix: rewrite the document to its grammar — chapter 20 lists the keys, their order and what each run requires · read: docs/19-linting.md#document-follows-its-grammar

            conventions checker: 1 error(s) found under {{workdir}}
        `);
    });

    test('the same grammar is what the compliant twin satisfies', async () => {
        // Given - a well-formed document
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/spec-document-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./_expected/clean.txt'));
    });
});
