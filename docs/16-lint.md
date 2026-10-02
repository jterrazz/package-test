# 16 — Lint specs (`specification.lint`)

`specification.lint()` tests the rules a project ships — an oxlint plugin, a cross-file checker, the laws a `@jterrazz/typescript` preset holds a tree to — by running the real linters over fixture trees and comparing their whole report. The subject is a rule, met the way a consumer meets it: a tree in, the linter's verdict out.

Use it when the behaviour you care about starts with "when this tree is linted…". A rule's visitor alone, on one snippet, is a module test with [`ruleTester()`](#a-rule-alone-ruletester); the tree the rule is meant to judge, with its folders and its neighbours, is this chapter's.

## What it specifies

A lint spec answers one question: **when this tree is linted, where does which rule report, and what does it say?** A rule is a real subject a team tests, like a binary: it has inputs (a tree), a contract (a report), and consumers who read that report. A rule reading ONE file is proven by its report over a tree holding that file; a rule reading the whole tree — a folder's shape, a manifest, what imports what — can only be proven that way, so one facet serves both.

What it does not do: judge the tree it runs in. The facet lints a fixture laid in a fresh working directory, never the repository's own sources — those are `typescript check`'s.

## The constructor

The examples below are a package that ships an oxlint plugin and a preset, both built to its own `dist/`: `dist/oxlint.js` is that package's built plugin, and `dist/config.js` exports its preset, here called `acme()`. Use the paths your build writes, or the published specifier of your package (`'@acme/lint/oxlint'`). A plugin is loaded from what was built, so build before the lint project runs ([§ Pitfalls](#pitfalls)).

```typescript
// specs/lint/lint.specification.ts
import { afterAll } from 'vitest';

import { recommendedRules } from '../../dist/oxlint.js';
import { specification } from '@jterrazz/test';

export const { lint, cleanup } = await specification.lint({
    config: { categories: { correctness: 'off' }, rules: recommendedRules },
    plugins: ['../../dist/oxlint.js'],
});

afterAll(cleanup);
```

A preset's laws, or a checker of the project's own, are linters of the same facet:

```typescript
// specs/lint/preset-lint.specification.ts
import { afterAll } from 'vitest';

import { acme } from '../../dist/config.js';
import { specification } from '@jterrazz/test';

export const { lint, cleanup } = await specification.lint({ presets: [acme()] });

afterAll(cleanup);
```

### Options

At least one linter — a plugin, a config, a checker or presets, `presets: []` holding the tree to the base preset alone; a specification naming none is refused.

| Option     | Description                                                                                                                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins`  | oxlint JS plugins, each a path from the specification's folder or a package specifier. They run in the real oxlint, `oxlint` being an optional peer the project installs                                                                  |
| `config`   | The oxlint config oxlint runs under — `rules`, `settings`, `categories`, `overrides` — less `jsPlugins`, which `plugins` states; named alone, it runs oxlint's built-in rules                                                             |
| `presets`  | `@jterrazz/typescript` presets whose laws run on the tree — the Architecture pass over every `layers`, each declared `names` rule — resolved after the always-on base preset as `jterrazz.config.ts` would; `[]` is the base preset alone |
| `checkers` | Cross-file checkers, each a command printing one finding a line in the compiler's convention — `<file>:<line>:<column>: error <plugin>(<rule>): <message>`; `.run()` hands it the tree last                                               |
| `root`     | Root-resolution override (rule `no-redundant-root`); the plugins' specifiers and the checkers' commands resolve from its `node_modules`                                                                                                   |
| `settings` | What the project adds beside its presets, written as `jterrazz.config.ts` writes it — `typescript: { names, architecture: { layers } }`, `optOuts` — so a repository's own additions are its own, never a preset it makes up              |

There is nothing to start and nothing to stop: `cleanup` is handed to `afterAll` like every constructor's, and releases nothing.

## The chain

Setups: `.fixture(directory('./_fixtures/<tree>/'))` — or a `file()`, copied by name — lays the tree in a fresh working directory ([14 § Fixtures](14-cli.md#the-chain)); `.rules({ … })` states rules and their options for this chain, over the specification's `config`, a later call winning; on a specification that runs no oxlint — no plugin, no config — it is refused, since no linter would read it. Terminal action: `.run()` (rule `one-terminal-action-per-chain`).

```typescript
// specs/lint/no-module-mock/no-module-mock.spec.ts
import { describe, expect, test } from 'vitest';
import { directory } from '@jterrazz/test';

import { lint } from '../lint.specification.js';

describe('no-module-mock', () => {
    test('rejects an allow-list entry with no reason', async () => {
        // Given - a module on the allow-list, and no reason beside it
        const result = await lint
            .rules({ 'acme/no-module-mock': ['error', { modules: [{ module: 'x', reason: '' }] }] })
            .fixture(directory('./_fixtures/allow-listed/'))
            .run();

        // Then - the finding, where it fires, with its lesson
        expect(result.report).toMatch(`
            src/storage.test.ts:5:1  acme(no-module-mock)
                found: "x" is on the \`modules\` allow-list with no reason
                why: A test doubles a PORT, never a module.
                fix: state why no consumer can inject it
                read: docs/24-linting.md#no-module-mock
        `);
    });
});
```

`.run()` takes two options:

| Option | Description                                                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fix`  | Apply oxlint's and the checkers' fixes, then lint the fixed tree: the report is what a run after the fix says, and `result.file()` reads what it wrote; the presets' laws have no fix, and are judged on the fixed tree |
| `args` | Handed to every checker before the tree, as a checker takes a flag (`--member packages/web`)                                                                                                                            |

## The result

| Member                   | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| `result.report`          | Every linter's diagnostics, as a text subject — see below           |
| `result.file(path)`      | A file of the tree after the run, relative to the working directory |
| `result.directory(path)` | A folder of the tree, compared whole to a golden tree               |

### The report

One diagnostic is its head line, `<file>:<line>:<column>  <plugin>(<rule>)`, then its message — a lesson a part per line, `found:`, `why:`, `fix:`, `read:`, or the message as the linter wrote it:

```text
specs/app/widget/widget.test.ts:8:36  acme(no-sleep)
    found: an arbitrary sleep in a test
    why: No arbitrary sleep in any test file.
    fix: wait on what the sleep stands for
    read: docs/24-linting.md#no-sleep
```

The diagnostics come in the order a reader walks the tree — file, then line, then column — whichever linter printed them and whatever order its threads finished in; a tally, a summary or any other line is not one. A clean tree is the empty text: `expect(result.report).toMatch('')`. Written in place and rewritten by `TEST_UPDATE=1` ([22](22-tokens.md#update-mode-tokens-are-preserved)), the golden proves where each rule fired, which one, and what it teaches.

oxlint's graphical rendering is refused, never read as a clean run: the facet states `--format=unix` itself, and a report handed to it in frames names the format to state.

## Unique here

### What `.run()` runs

Each linter the specification names, over the working directory:

1. **oxlint**, when `plugins` or `config` is named: the real binary, with a config the facet writes outside the tree — `jsPlugins` the plugins, `rules` the specification's `config.rules` and the chain's `.rules()` over them — at `--format=unix`.
2. **each checker**, as `<command> <args> .`, from the tree, its first word resolved from the project's `node_modules/.bin` when it is installed there.
3. **the presets' laws**, in process, through `presetChecks` of `@jterrazz/typescript/rules`, handed the `presets` and the `settings` as one settings object: each finding at its position, one about a whole file or folder at `:1:1`. Settings the kit cannot resolve are refused like a linter that fails with no diagnostic.

A preset's own `oxlint` — its plugin, its rulebook — is not run by `presets`: the presets hand the facet their laws alone. A preset's rules are proven as any plugin's are, the plugin under `plugins` and its rules under `config`, so a report holds only the rules the specification names.

A linter that fails and reports no diagnostic is refused in four parts rather than read as a clean tree — a plugin that does not load, a config oxlint cannot build, a checker that cannot start.

### A rule alone: `ruleTester()`

A rule's visitor, on snippets, is a module test beside the rule. `ruleTester()` is oxlint's `RuleTester` (`oxlint/plugins-dev`) bound to vitest — its suites and cases are vitest's — and it requires a position on every invalid case: each expected error is an object stating its `line` and `column`. A count, an empty list, or an error with no position, is refused before the case runs, since it passes for a report on any node.

The two tools count columns differently, and each keeps its own convention: `ruleTester()` reads oxlint's RuleTester columns, **0-based** — `column: 25` below is the `setTimeout` at index 25 — while a lint spec's report prints the compiler's `file:line:column`, **1-based**, so the same finding reads `:1:26` there.

```typescript
// src/rules/no-sleep.test.ts
import { ruleTester } from '@jterrazz/test';

import { noSleep } from './no-sleep.js';

ruleTester().run('no-sleep', noSleep, {
    invalid: [
        {
            code: 'await new Promise((r) => setTimeout(r, 100));',
            errors: [{ column: 25, line: 1, messageId: 'slept' }],
            filename: '/project/specs/api/users/list.spec.ts',
        },
    ],
    valid: ['await waitUntil(() => ready);'],
});
```

## Pitfalls

- **Linting a stale build.** The plugins and checkers a project ships are usually loaded from its `dist/`: build before the lint project runs, or the specs judge the previous rules.
- **A golden cut to the rule ids.** The report carries each lesson whole, so a reworded message moves the golden — that is the contract a reader meets, and `TEST_UPDATE=1` rewrites it.
- **A literal token in a message.** A lesson that echoes `{{uuid}}` is read as the token in the golden; cover the echo with `{{string}}` ([22 § Known limitations](22-tokens.md#known-limitations)).
- **One specification for every linter.** A plugin's fixture judged by the checker too reports what it was never built to show: give each linter a specification of its own (`checker-lint.specification.ts`, `preset-lint.specification.ts`).

## Related

[14 — CLI specs](14-cli.md) · [21 — Assertions](21-assertions.md) · [22 — Tokens](22-tokens.md) · [24 — Linting](24-linting.md)
