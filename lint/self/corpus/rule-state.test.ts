import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import plugin from '../../consumer/rules/plugin.js';
import selfPlugin from '../rules/plugin.js';
import { corpusOf, e2eOptions, ROOT, ruleSources, session, unresetState } from './rule-state.js';

const LINT_SPECS = join(ROOT, 'specs/lint');

const OPTIONS = e2eOptions(join(ROOT, 'specs/_shared/_fixtures/lint-cli/oxlint.e2e.json'));

describe('rule-state', () => {
    test('a rule built once judges each file as if it were the only one — what a rule keeps for one file is reset when the next one opens', () => {
        // Given - every rule module, and the state its `createOnce` keeps between hooks
        const unreset = ruleSources().flatMap((source) => unresetState(source));

        // Then - `before` (or the `Program` handler, the first node of a file) writes each of them afresh
        expect(unreset).toStrictEqual([]);
    });

    test('a rule built once judges each file as if it were the only one — every rule draws the same verdicts from a file, alone or after its whole corpus', () => {
        // Given - each rule's E2E fixture corpus, linted file by file with a visitor of their own, then twice through ONE visitor
        const drifted: string[] = [];
        let verdicts = 0;
        for (const [id, rule] of Object.entries({ ...plugin.rules, ...selfPlugin.rules })) {
            const files = corpusOf(id, LINT_SPECS);
            const alone = files.map((file) => session(rule, id, OPTIONS)(file));
            const lint = session(rule, id, OPTIONS);
            for (const file of files) {
                lint(file);
            }
            const sequenced = files.map((file) => lint(file));
            verdicts += alone.flat().length;
            for (const [index, file] of files.entries()) {
                if (JSON.stringify(sequenced[index]) !== JSON.stringify(alone[index])) {
                    drifted.push(`${id}: ${file.slice(ROOT.length + 1)}`);
                }
            }
        }

        // Then - what one file left in the visitor never reaches the next one, and the corpus was judged at all
        expect(drifted).toStrictEqual([]);
        expect(verdicts).toBeGreaterThan(0);
    });
});
