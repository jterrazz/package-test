---
name: jterrazz-test
description: Testing conventions for @jterrazz projects — the eight kinds (module, integration, component, website, mobile, api, jobs, cli), vitest, real services, golden files, doubles. Use when writing, organizing, or debugging ANY test in a jterrazz repo, a plain module test included.
metadata:
    version: '16'
---

# `@jterrazz/test`

The ecosystem's declarative testing framework. A spec reads as a sentence — `await api.seed('users.sql').request('create-user.http')` — and the vitest test name is its only description. Infrastructure (Postgres/Redis/SQLite/Docker, a real Chromium, an iOS simulator) is started, isolated per worker, and cleaned up for you.

## The fork — answer it first

Nine questions, asked in order; the first yes is the kind, and the kind fixes the folder, the constructor and the project. The generated table is [references/fork.md](references/fork.md).

1. Does it render in a browser as a whole served page? → **website**, `specs/website/<domain>/<aspect>.spec.ts`
2. Does it render as a component (React, a DOM function, a hook)? → **component**, `<file>.test.tsx` beside `<file>.tsx`
3. Does it render on a simulator? → **mobile**, `specs/mobile/<domain>/<aspect>.spec.ts`
4. Does it answer HTTP? → **api**, `specs/api/<domain>/<aspect>.spec.ts`
5. Is it triggered by name, in-process? → **jobs**, `specs/jobs/<domain>/<aspect>.spec.ts`
6. Is it a binary? → **cli**, `specs/cli/<domain>/<case>.spec.yaml` (or `<aspect>.spec.ts`)
7. Is it a module that needs a real service, or whose oracle is a golden? → **integration**, `specs/integration/<domain>/<aspect>.spec.ts`
8. Is it a module alone? → **module**, `<file>.test.ts` beside `<file>.ts`
9. Is it the repository itself, a suite over several apps? → **repository suite**, `specs/<family>/<aspect>.test.ts`

The SUFFIX is the kind, and the checker holds it: `.test.ts(x)` beside the code, `.spec.ts` under `specs/<facet>/`, `<case>.spec.yaml` for a literate document, `<facet>.specification.ts` for the file that builds a runner.

## Mental model (read once)

- **One import point** — everything a spec needs comes from `@jterrazz/test` (rule F1). The tool entries beside it are listed once, in [docs/01 § What the tree publishes](../../docs/01-architecture.md#what-the-tree-publishes).
- **Six constructors, and two kinds with none** — `specification.{api,jobs,cli,integration,website,mobile}()` live in a `*.specification.ts` at the facet root, destructured with the canonical name and always `afterAll(cleanup)`. A rendered component starts nothing, so it has no constructor and no facet folder: import `component` and write `<file>.test.tsx` beside the thing it renders. A module test starts nothing either and needs neither.
- **One chain, one action** — setups (`.seed()`, `.fixture()`, `.env()`, `.headers()`, `.intercept()`, `.clock()`, `.wrap()`, `.viewport()`) chain before exactly one terminal action, which resolves to a typed result. Databases reset per chain; there is no `.spawn()` and no label.
- **One vocabulary for anything that draws** — the same descriptors, modifiers and verbs on website, component and mobile, with `see()` as the synchronization primitive, W3 refusing an ambiguous descriptor, `within()` narrowing it, and names matching the accessible name WHOLE since 16.0. [docs/13](../../docs/13-elements.md).
- **The doubles ladder, in order** — the real thing → a declared service (`postgres()`, `redis()`, `sqlite()`, `process()`) → a contract (`.intercept()` on a chain, `await using _ = await intercept(…)` in module scope) → a typed port double (`mockOf<T>()`, `vi.fn<Fn>()`). Take the FIRST rung that fits; `vi.stubGlobal`, raw `msw`, `nock` and `sinon` are off it.
- **One time primitive** — `clock`. `using _ = clock.at('<iso>')` pins the calendar for the scope; `clock.run()` takes the scheduler too and `await clock.advance(ms)` makes queued work due. On a chain it is `.clock('<iso>')`. Never `vi.useFakeTimers`, never `vi.setSystemTime`.
- **Goldens first** — snapshot the whole surface per scoped use case (`expect(x).toMatch('case.http')`), token the volatile parts, and write the file with `TEST_UPDATE=1`. `toContain` is the scalpel, not the default; vitest's own snapshot matchers are refused.
- **Given/Then, on every test** — a `// Given -` line then a `// Then -` line, both, in that order, as sentences about the subject. A `test.each` table is narrated once, on the table.
- **The project helpers name the kind** — `unit()`, `integration()`, `component()`, `website()`, `mobile()`, `api()`, `jobs()`, `cli()` from `@jterrazz/test/vitest`, under `defineSpecConfig()`. What each one takes is [docs/02 § vitest.config](../../docs/02-developing.md#vitest-config-the-preset)'s. `--project api` means the same tree in every repository. A member without `"type": "module"` names the file `vitest.config.mts`.
- **`TEST_UPDATE=1` writes, it does not judge** — run it, READ the diff, then run again without it. A fixture that must stay wrong on purpose is `{ frozen: true }`.
- **Artefacts live under `.artifacts/<tool>/`** — the vite cache, coverage, the sqlite template, browser attachments and screenshots. One `.gitignore` line: `.artifacts/`.
- **The rules reach every test file**, with or without a framework import, and every diagnostic ends in an id and an anchor — `(I2 — docs/19-linting.md#i2-…)`. Suppress with a directive that carries a reason; the ids are [references/rules.md](references/rules.md).

## When to use this skill

**Trigger on:** writing or editing any `*.test.ts(x)`, `*.spec.ts`, `*.spec.yaml` or `*.specification.ts` in a jterrazz repository, a plain unit test included; any import of `@jterrazz/test`; prompts about specification runners, seeds, fixtures, contracts, tokens, directory snapshots, visit or open scenarios, rendered components, or the Given/Then convention.

The framework specifies what the SUBJECT is, not which runner it needs. The CONVENTIONS bind every test file of the repository — a plain unit test with no framework import included.

**Do NOT use for:**

- tests on another runner (jest, mocha, ava, `node:test`, `@playwright/test`) or in another language — this is a vitest-and-TypeScript dialect and does not transfer;
- **React Native render tests** — a native view never reaches a Chromium, so jest stays the runner for `*.render.tsx` until the `react-native-web` spike says otherwise; the conventions still bind those files;
- browser or native testing as an excuse to reach for raw Playwright, appium or `@testing-library/*` — both are covered, through `specification.website()` and `specification.mobile()`.

There is no scaffold command: the card IS the example, and the checker's `--fix` movers do the mechanical part.

## Routing table

Load the one card that matches the task. Each card is generated from the facet declaration — the runner line, every option with its default, every setup, every terminal action, every result accessor — and names the chapter carrying the prose.

| Task                                                              | Card                                                           | Chapter                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| Which kind is this test?                                          | [references/fork.md](references/fork.md)                       | [docs/18-conventions.md](../../docs/18-conventions.md)   |
| Writing a **module** test (the majority kind)                     | [references/module.md](references/module.md)                   | [docs/05-module-tests.md](../../docs/05-module-tests.md) |
| Writing an **integration** spec (real services, or a golden)      | [references/integration.md](references/integration.md)         | [docs/06-integration.md](../../docs/06-integration.md)   |
| Writing a **component** spec (render, hooks, DOM functions)       | [references/component.md](references/component.md)             | [docs/07-component.md](../../docs/07-component.md)       |
| Writing a **website** spec (fetch, visit, scenarios)              | [references/website.md](references/website.md)                 | [docs/08-website.md](../../docs/08-website.md)           |
| Writing a **mobile** spec (open, simulator, screens)              | [references/mobile.md](references/mobile.md)                   | [docs/09-mobile.md](../../docs/09-mobile.md)             |
| Writing an **api** spec (HTTP, in-process)                        | [references/api.md](references/api.md)                         | [docs/10-api.md](../../docs/10-api.md)                   |
| Writing a **jobs** spec (background pipelines)                    | [references/jobs.md](references/jobs.md)                       | [docs/11-jobs.md](../../docs/11-jobs.md)                 |
| Writing a **cli** spec or a `<case>.spec.yaml` document           | [references/cli.md](references/cli.md)                         | [docs/12-cli.md](../../docs/12-cli.md)                   |
| Naming an **element** — descriptors, verbs, `within`, exact names | [references/component.md](references/component.md)             | [docs/13-elements.md](../../docs/13-elements.md)         |
| Choosing a **matcher**, sync or awaited                           | [references/matrix.md](references/matrix.md)                   | [docs/14-assertions.md](../../docs/14-assertions.md)     |
| **Dynamic values**, the `{{token}}` grammar, **update mode**      | [references/matrix.md](references/matrix.md)                   | [docs/15-tokens.md](../../docs/15-tokens.md)             |
| **Declaring** what an HTTP or LLM call replies, streams, origins  | [references/module.md](references/module.md)                   | [docs/16-contracts.md](../../docs/16-contracts.md)       |
| **Services**, `process()`, the optional peer each one names       | [references/integration.md](references/integration.md)         | [docs/17-services.md](../../docs/17-services.md)         |
| **Rule ids** (lint plugin + checker), and what each one reaches   | [references/rules.md](references/rules.md)                     | [docs/19-linting.md](../../docs/19-linting.md)           |
| What this package proves about each capability                    | [references/matrix.md](references/matrix.md)                   | [docs/03-testing.md](../../docs/03-testing.md)           |
| Weird failures                                                    | [references/troubleshooting.md](references/troubleshooting.md) | the Pitfalls section of the chapter                      |

## Docs (canonical, in-repo)

- The corpus map is [docs/README.md](../../docs/README.md); the generated API reference is `docs/reference/`.
- Releases: <https://github.com/jterrazz/package-test/releases>
