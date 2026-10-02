import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { localLinters } from './local-linters.adapter.js';
import type { Linters } from './local-linters.adapter.js';

const RUN = { args: '', fix: false, rules: {} };

function lintersWith(overrides: Partial<Linters>): Linters {
    return {
        checkers: [],
        config: {},
        oxlint: null,
        plugins: [],
        presets: undefined,
        root: scratchDirectory('local-linters-root-'),
        settings: {},
        ...overrides,
    };
}

describe('localLinters', () => {
    test('localLinters — a checker that fails and prints no diagnostic — is refused, never read as a clean tree', async () => {
        // Given - a checker exiting 1 that prints only noise
        const tree = scratchDirectory('local-linters-tree-');
        const checker = join(tree, 'noisy.mjs');
        writeFileSync(checker, "console.log('something went wrong');\nprocess.exit(1);\n");

        // When - the tree is linted
        const linted = localLinters(lintersWith({ checkers: [`node ${checker}`] })).lint(tree, RUN);

        // Then - the four-part refusal names the checker and what it printed
        await expect(linted).rejects.toThrow(
            `found: node ${checker} failed and reported no diagnostic: something went wrong\nwhy: A linter that fails without a diagnostic judged nothing, and an empty report would read as a clean tree.\nfix: run node ${checker} on the fixture by hand and correct what stops it — a plugin that does not load, a config it refuses\nread: docs/16-lint.md#what-run-runs`,
        );
    });

    test('localLinters — settings the presets cannot resolve — are refused with the problem the kit named', async () => {
        // Given - the base preset alone, beside settings that write the spine away
        const tree = scratchDirectory('local-linters-tree-');

        // When - the tree is linted
        const linted = localLinters(
            lintersWith({ presets: [], settings: { typescript: { spine: null } } }),
        ).lint(tree, RUN);

        // Then - the problem is the refusal's finding, never an empty report
        await expect(linted).rejects.toThrow(
            'found: the presets’ checks failed and reported no diagnostic: writes a single value at `typescript.spine`, where its presets set a list — a setting adds to a default, never replaces its shape',
        );
    });

    test('localLinters — rules stated for a run with no oxlint — are refused, never dropped', async () => {
        // Given - the base preset alone, and a rule stated through `.rules()`
        const tree = scratchDirectory('local-linters-tree-');

        // When - the tree is linted
        const linted = localLinters(lintersWith({ presets: [] })).lint(tree, {
            ...RUN,
            rules: { 'acme/no-sleep': 'error' },
        });

        // Then - the refusal names the rules no linter would read
        await expect(linted).rejects.toThrow(
            'found: .rules() states acme/no-sleep, and the specification runs no oxlint',
        );
    });
});
