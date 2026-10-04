import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint as checker } from '../checker-lint.specification.js';

describe('document-follows-its-grammar', () => {
    test('a document key naming a file outside the folder it reads is refused on that key', async () => {
        // Given - the crossed-ground tree
        const result = await checker.fixture(directory('./_fixtures/crossed-ground/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/case.spec.yaml:2:1  jterrazz-check(document-follows-its-grammar)
                found: fixture: reads _fixtures/, and "./_expected/shop/" names _expected/ — put the file in ./_fixtures/ beside the document, or in the _fixtures/ of the lowest folder the leaves share (specs/_shared/_fixtures/ across facets) (verb-reads-its-ground-folder)
                why: A \`<case>.spec.yaml\` document follows its grammar: closed keys — \`description\`, \`fixture\`, \`env\`, \`serve\`, \`runs\` — and closed keys inside a run; \`description:\` and \`runs:\` required; \`command:\` and \`exit:\` required in every run, \`exit:\` an integer literal, \`waitFor:\` only on the last run and never with \`stdin:\`, a \`files:\` path relative and under the workdir; every \`fixture:\` path relative, reaching \`_fixtures/\`.
                fix: rewrite the document to its grammar — the Spec documents page lists the keys, their order and what each run requires
                read: docs/reference/linting.md#document-follows-its-grammar
        `);
    });

    test('a key no document reads is refused on its line', async () => {
        // Given - the unknown-key tree
        const result = await checker.fixture(directory('./_fixtures/unknown-key/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            specs/widget/case.spec.yaml:5:1  jterrazz-check(document-follows-its-grammar)
                found: unknown key "cases:" in a spec document — known keys: description, fixture, env, serve, runs
                why: A \`<case>.spec.yaml\` document follows its grammar: closed keys — \`description\`, \`fixture\`, \`env\`, \`serve\`, \`runs\` — and closed keys inside a run; \`description:\` and \`runs:\` required; \`command:\` and \`exit:\` required in every run, \`exit:\` an integer literal, \`waitFor:\` only on the last run and never with \`stdin:\`, a \`files:\` path relative and under the workdir; every \`fixture:\` path relative, reaching \`_fixtures/\`.
                fix: rewrite the document to its grammar — the Spec documents page lists the keys, their order and what each run requires
                read: docs/reference/linting.md#document-follows-its-grammar
        `);
    });

    test('rejects a key outside the closed set', async () => {
        // Given - a document carrying a `when:` line
        const result = await checker
            .fixture(directory('./_fixtures/document-follows-its-grammar/'))
            .run();

        // Then - the grammar the runner parses is the grammar the lint enforces
        expect(result.report).toMatch(`
            specs/widget/builds.spec.yaml:2:1  jterrazz-check(document-follows-its-grammar)
                found: unknown key "when:" in a spec document — known keys: description, fixture, env, serve, runs
                why: A \`<case>.spec.yaml\` document follows its grammar: closed keys — \`description\`, \`fixture\`, \`env\`, \`serve\`, \`runs\` — and closed keys inside a run; \`description:\` and \`runs:\` required; \`command:\` and \`exit:\` required in every run, \`exit:\` an integer literal, \`waitFor:\` only on the last run and never with \`stdin:\`, a \`files:\` path relative and under the workdir; every \`fixture:\` path relative, reaching \`_fixtures/\`.
                fix: rewrite the document to its grammar — the Spec documents page lists the keys, their order and what each run requires
                read: docs/reference/linting.md#document-follows-its-grammar
        `);
    });

    test('the same grammar is what the compliant twin satisfies', async () => {
        // Given - a well-formed document
        const result = await checker
            .fixture(directory('../../_shared/_fixtures/spec-document-ok/'))
            .run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });
});
