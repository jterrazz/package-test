import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { oxlintBinary } from './lint.handle.js';
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

/** The message a lint run rejects with, or the empty text when it resolves. */
async function rejectionOf(linted: Promise<unknown>): Promise<string> {
    try {
        await linted;
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

const placed = (diagnostics: readonly { at: string; rule: string }[]): string[] =>
    diagnostics.map((diagnostic) => `${diagnostic.at} ${diagnostic.rule}`);

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
            rules: { 'acme/no-sleep': 'error', 'acme/no-wait': 'warn' },
        });

        // Then - the refusal names the rules no linter would read
        await expect(rejectionOf(linted)).resolves.toBe(
            [
                'found: .rules() states acme/no-sleep, acme/no-wait, and the specification runs no oxlint',
                'why: Rules are run by oxlint alone, and rules no linter reads would judge nothing and say nothing.',
                'fix: name the plugins, or the `config`, the rules run under — or drop the `.rules()` call',
                'read: docs/16-lint.md#the-chain',
            ].join('\n'),
        );
    });

    test('localLinters — a checker installed in the project — is run from node_modules/.bin with the run’s arguments, fixing first when asked, its diagnostics read from either stream', async () => {
        // Given - a checker installed in the project that logs each call and reports one finding on stdout and one on stderr
        const root = scratchDirectory('local-linters-root-');
        const tree = scratchDirectory('local-linters-tree-');
        const calls = join(root, 'calls.log');
        mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
        const bin = join(root, 'node_modules/.bin/acme-check');
        writeFileSync(
            bin,
            `#!/bin/sh\necho "$@" >> '${calls}'\necho 'a.ts:1:2: one [Error/acme(first)]'\necho 'b.ts:3:4: two [Warning/acme(second)]' >&2\n`,
            { mode: 0o755 },
        );

        // When - the tree is linted with a fix, then without
        const linters = localLinters(lintersWith({ checkers: ['acme-check --strict'], root }));
        const fixed = await linters.lint(tree, { args: '--quiet', fix: true, rules: {} });
        const plain = await linters.lint(tree, RUN);

        // Then - the diagnostics each time, and the calls in order
        const diagnostics = [
            { at: 'a.ts:1:2', message: 'one', rule: 'acme(first)' },
            { at: 'b.ts:3:4', message: 'two', rule: 'acme(second)' },
        ];
        expect([fixed, plain, readFileSync(calls, 'utf8')]).toStrictEqual([
            diagnostics,
            diagnostics,
            '--strict --quiet . --fix\n--strict --quiet .\n--strict .\n',
        ]);
    });

    test('localLinters — a checker that exits clean with nothing to say — reports nothing, and a run with no oxlint and no rules is no refusal', async () => {
        // Given - a checker on the PATH that prints nothing and exits 0
        const tree = scratchDirectory('local-linters-tree-');

        // Then - an empty report
        await expect(
            localLinters(lintersWith({ checkers: ['true'] })).lint(tree, RUN),
        ).resolves.toStrictEqual([]);
    });

    test('localLinters — a failure’s refusal shows the first five lines of what it printed', async () => {
        // Given - a checker exiting 1 that prints seven lines
        const tree = scratchDirectory('local-linters-tree-');
        const checker = join(tree, 'long.mjs');
        writeFileSync(
            checker,
            "for (let n = 1; n <= 7; n++) console.log('line ' + n);\nprocess.exit(1);\n",
        );

        // Then - the finding holds the first five, joined
        await expect(
            localLinters(lintersWith({ checkers: [`node ${checker}`] })).lint(tree, RUN),
        ).rejects.toThrow(
            `found: node ${checker} failed and reported no diagnostic: line 1 / line 2 / line 3 / line 4 / line 5\n`,
        );
    });

    test('localLinters — oxlint — runs the real oxlint under the config and the run’s rules, fixing first when asked; a clean tree reports nothing, a plugin that does not load is refused', async () => {
        // Given - a tree logging to the console, a clean tree, and oxlint under a config of its own
        const tree = scratchDirectory('local-linters-tree-');
        writeFileSync(join(tree, 'a.js'), 'let a = 1;\nconsole.log(a);\n');
        const kept = scratchDirectory('local-linters-kept-');
        writeFileSync(join(kept, 'c.js'), 'let c = 1;\nconsole.log(c);\n');
        const clean = scratchDirectory('local-linters-clean-');
        writeFileSync(join(clean, 'b.js'), 'export const b = 1;\n');
        const oxlint = oxlintBinary([import.meta.filename]);
        const linters = localLinters(
            lintersWith({ config: { categories: { correctness: 'off' } }, oxlint }),
        );
        const broken = localLinters(
            lintersWith({ oxlint, plugins: [join(clean, 'missing-plugin.js')] }),
        );

        // When - each is linted under no-console and prefer-const, the first with a fix
        const rules = { 'no-console': 'error', 'prefer-const': 'error' } as const;
        const found = await linters.lint(tree, { ...RUN, fix: true, rules });
        const unfixed = await linters.lint(kept, { ...RUN, rules });
        const refused = await rejectionOf(broken.lint(clean, RUN));

        // Then - the fixed tree rewritten and its last finding, the other kept as written with both, nothing on the clean tree, the plugin refused naming it
        expect([
            placed(found),
            readFileSync(join(tree, 'a.js'), 'utf8'),
            placed(unfixed),
            readFileSync(join(kept, 'c.js'), 'utf8'),
            await linters.lint(clean, { ...RUN, rules }),
            /^found: oxlint failed and reported no diagnostic: [^\s/].*missing-plugin\.js/u.test(
                refused,
            ),
        ]).toStrictEqual([
            ['a.js:2:1 eslint(no-console)'],
            'const a = 1;\nconsole.log(a);\n',
            ['c.js:1:5 eslint(prefer-const)', 'c.js:2:1 eslint(no-console)'],
            'let c = 1;\nconsole.log(c);\n',
            [],
            true,
        ]);
    });

    test('localLinters — a checker that fails with a finding — is read, not refused; a preset’s finding is read at its place', async () => {
        // Given - a checker reporting a finding and exiting 1, and a preset whose names rule a file breaks
        const tree = scratchDirectory('local-linters-tree-');
        mkdirSync(join(tree, 'src'));
        writeFileSync(join(tree, 'src/Bad_Name.ts'), 'export const a = 1;\n');
        const checker = join(tree, 'finding.mjs');
        writeFileSync(
            checker,
            "console.log('a.js:1:1: error acme(rule): found');\nprocess.exit(1);\n",
        );
        const names = {
            fix: 'name it in kebab-case',
            ls: { src: { '.ts': 'kebab-case' } },
            name: 'probe-names',
            read: 'docs/x.md#y',
            why: 'Names are kebab-case.',
        } as const;
        const presets = [{ name: 'probe', names: [names], package: 'probe' }];

        const linted = await localLinters(
            lintersWith({ checkers: [`node ${checker}`], presets }),
        ).lint(tree, RUN);

        // Then - both findings, each at its place
        expect(linted.map(({ at, rule }) => `${at} ${rule}`)).toStrictEqual([
            'a.js:1:1 acme(rule)',
            'src/Bad_Name.ts:1:1 names(probe-names)',
        ]);
    });

    test('localLinters — presets — none run when none are named, whatever the settings; named, a clean tree has nothing to say and every problem is named', async () => {
        // Given - settings the presets cannot resolve, twice over, and a clean tree
        const tree = scratchDirectory('local-linters-tree-');
        const broken = { typescript: { spine: null } };
        const refused = await rejectionOf(
            localLinters(lintersWith({ presets: [], settings: broken })).lint(tree, RUN),
        );

        // Then - no presets, no checks; the base preset on a clean tree, no finding; on the broken settings, both problems
        expect([
            await localLinters(lintersWith({ settings: broken })).lint(tree, RUN),
            await localLinters(lintersWith({ presets: [] })).lint(tree, RUN),
            refused.split('\n')[0],
        ]).toStrictEqual([
            [],
            [],
            'found: the presets’ checks failed and reported no diagnostic: writes a single value at `typescript.spine`, where its presets set a list — a setting adds to a default, never replaces its shape',
        ]);
    });
});
