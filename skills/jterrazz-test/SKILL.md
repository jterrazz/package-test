---
name: jterrazz-test
description: Testing conventions for @jterrazz projects — unit/integration/e2e structure, vitest, testcontainers, golden files, mocks. Use when writing, organizing, or debugging ANY test in a jterrazz repo, a plain unit test included.
metadata:
    version: '15.3'
---

# `@jterrazz/test`

The ecosystem's declarative testing framework for HTTP APIs, background jobs, CLIs, in-process modules, rendered websites, rendered components and native mobile apps. A spec reads as a sentence — `await api.seed('users.sql').request('create-user.http')` — and the vitest test name is its only description. Infrastructure (Postgres/Redis/SQLite/Docker, a real chromium, or an iOS simulator) is started, isolated per worker, and cleaned up for you.

## Mental model (read once)

- **One import point** — everything a spec needs comes from `@jterrazz/test` (F1). The only other importable specifiers are the TOOL subpaths the package's `exports` map publishes — `@jterrazz/test/oxlint` (lint plugin), `@jterrazz/test/vitest` (what `vitest.config.ts` imports) and `@jterrazz/test/schema` (the spec-document JSON schema) — exempt from F1 and F3 wherever they appear. Piloting an unreleased branch: install a `npm pack` tarball, never a `file:` link.
- **`oxlint.config.ts` composes the fragment onto a PROFILE** — `compose(<profile>, testing)`, the profile being the one `@jterrazz/typescript` v10 names for what the project is: `node`, `library`, `next`, `astro`, `expo` or `bun`. `testing` is declared as oxlint's own `OxlintConfig`, so the call type-checks with no assertion; a published package on `library` states the config's type once, because `isolatedDeclarations` refuses an inferred default export. The gesture is [docs/13](../../docs/13-linting.md).
- **`vitest.config.ts` starts from the preset** — `defineSpecConfig()` from `@jterrazz/test/vitest`, beside `literate()`. It sets `cacheDir: '.artifacts/vitest'`, the coverage directory under it, 30s test/hook budgets and a `**/_fixtures/**` exclusion, then merges YOUR config over them; inline `projects` inherit the same defaults, arrays concatenate, scalars override. It sets nothing else — `fileParallelism`, `reporters`, `environment` and every `include` stay the consumer's. Never hand-roll those four again.
- **Artefacts live under `.artifacts/<tool>/`** — the vite cache, coverage, and `sqlite()`'s schema template (`.artifacts/vitest/sqlite/template-<key>.sqlite`, inside the PROJECT, so two checkouts never share one). Per-run scratch — a CLI spec's temp cwd, a browser profile — stays in the OS temp dir on purpose. One `.gitignore` line: `.artifacts/`.
- **Six constructors, only six** — `specification.api()`, `specification.jobs()`, `specification.cli()`, `specification.integration()`, `specification.website()`, `specification.mobile()`. Created in a `*.specification.ts` file at the facet root, destructured with the canonical name (`{ api, cleanup }` / `{ jobs, cleanup }` / `{ cli, cleanup }` / `{ integration, cleanup }` / `{ website, cleanup }` / `{ mobile, cleanup }`, no aliasing), always `afterAll(cleanup)`.
- **A module against the real thing is a spec too** — a module that needs a real database, or whose oracle is a GOLDEN file, is `specification.integration()`: `.call((services) => …)`, and what it produced is `result.value` or, when it refused, `result.error`. A module alone, with no service and no golden, stays a `<file>.test.ts` beside its code with no runner. [docs/17](../../docs/17-integration.md).
- **One facet with NO constructor: `component`** — a rendered unit starts nothing, so there is no handle and no `*.specification.ts`. Import the chain (`import { component, button } from '@jterrazz/test'`) and write the test BESIDE the thing it renders, as `<file>.test.tsx`. What every render of a project shares — the providers, the Vite pipeline, the viewport — is `component({ wrap, vite, … })` in `vitest.config.ts`, beside `unit()`. [docs/16](../../docs/16-component.md).
- **Terminal actions** — `.request()` / `.get()` (api), `.trigger()` (jobs), `.exec()` and `.run()` (cli), `.call()` (integration), `.fetch()` / `.visit()` (website), `.open()` (mobile) execute the chain and resolve to a typed result. Setups (`.seed()`, `.fixture()`, `.env()`, `.headers()`, `.intercept()`, `.clock()`) chain before them. No label, no `.spawn()`. One chain = one action; databases reset each chain.
- **One time primitive** — `clock`. `using _ = clock.at('<iso>')` pins the calendar for the scope and releases itself; `clock.run()` takes the scheduler too and `clock.advance(ms)` makes queued work due. On a chain it is `.clock('<iso>')` (api, jobs, integration, component, and a website visit — the PAGE's calendar). Never `vi.useFakeTimers`, never `vi.setSystemTime`. [docs/12](../../docs/12-conventions.md#time--one-primitive-two-depths).
- **The doubles ladder, in order** — the real thing → a declared service (`postgres()`, `redis()`, `sqlite()`, `process()`) → a contract (`.intercept()` on a chain, `await using _ = await intercept(…)` in module scope) → a typed port double (`mockOf<T>()`, `mockOf<T>({ deep: false })`, `vi.fn<Fn>()`). Take the FIRST rung that fits. `vi.stubGlobal`, a raw `msw` import, `nock`, `sinon` and `mockdate` are off the ladder. [docs/12](../../docs/12-conventions.md).
- **An external process is `process()`** — a dev server, an API the site calls, a bundler: `process({ command, ready, port?, cwd?, env?, before?, timeout? })` in a `services` record, started after the databases and stopped with the specification. Every process of one run carries the facet's `TEST_RUN_ID`; a spec never builds a label from `Date.now()`. [docs/11](../../docs/11-services.md).
- **The project helpers name the kind** — `unit()`, `api()`, `jobs()`, `cli()`, `integration()`, `website()`, `component()`, `mobile()` from `@jterrazz/test/vitest`, each with `{ include, exclude, timeout }`. `--project api` means the same tree in every repository, and the group order keeps two Chromiums off one slot. `cli()` wires `literate()` by default.
- **A CLI session can BE the file** — a `<case>.spec.yaml` document states one scenario (`description:`, the ground, then `runs:` with their commands, exit codes, streams and `files:`) and executes either as a test file of its own (the `literate()` vite plugin) or through `cli.run('case.spec.yaml')`. Same engine as the chain, same tokens, same `TEST_UPDATE=1`; a JSON Schema ships at `@jterrazz/test/schema`.
- **Every assertion goes through `expect()`** — accessors (`result.stdout`, `result.response`, `result.table(...)`, `result.file(...)`) are read-only; the matchers are registered on vitest's `expect`. `await` exactly the IO matchers (`toMatchRows`, `toBeEmpty`, `toBeRunning`, `toMatch` on tree subjects); everything else is sync.
- **Goldens first (D11)** — snapshot the whole surface per scoped use case (`expect(x).toMatch('case.http'|'case.txt')`, tokens for volatile parts, `TEST_UPDATE=1` to generate). `.grep()` / `toContain` are the scalpel for targeted probes, not the default.
- **One verb per state** — `.seed()` is SQL-only (database state); `.fixture(path)` is the one file-state verb (copies into the cwd). No `.project()`, no seed handlers.
- **Layout in one breath** — `specs/<facet>/<name>.specification.ts` (runner at the facet root) + `specs/<facet>/<domain>/<aspect>.spec.ts` (specs one level down). The folder follows the assets. A UNIT's test is a SIBLING of its code, never under `specs/`: `<file>.test.ts` for a module, `<file>.test.tsx` for a component — the suffix is the kind, and it decides which project collects the file.
- **Dynamic values** — the `{{token}}` grammar in fixtures, `match.*` in code (same vocabulary). Every test carries both `// Given -` and `// Then -`.

## When to use this skill

Two things travel under one name, and their scopes are not the same: the framework is for a surface, the conventions are for every test file.

**The FRAMEWORK specifies what the SUBJECT is, not which runner it needs.** `specification.*` and everything hanging off it — runners, seeds, fixtures, contracts, goldens, the sandbox a spec runs in — exist to specify something a caller reaches through an entry: an HTTP API, a background job, a CLI, a rendered page, a native screen. A plain unit test of a pure function needs none of it and no runner at all.

A **rendered component** needs no runner (nothing is started) and does need a real browser, a Vite pipeline, a network double and a golden engine — all of which the framework owns, so the fork is the SUBJECT, never the amount of machinery. It is a facet with no constructor: `component.render(<X />, scenario)` from `@jterrazz/test`, in a `<file>.test.tsx` beside the component. Never `@testing-library/*`, never `happy-dom` (rules F6, E5, E5b, G4 refuse them and name the move).

**The CONVENTIONS bind EVERY test file of a jterrazz repository** — that plain unit test and that component test included. They are the repository's rules, not the framework's, and they hold with no `@jterrazz/test` import in the file:

- **Sibling naming (I2)** — the test of `<file>.ts` is `<file>.test.ts` next to it; a misnamed `.test.ts`, a `__tests__/` folder or a package's `tests/`/`test/` root is an error.
- **Given/Then (B4)** — every test carries a `// Given -` line then a `// Then -` line, both, in that order. Two `--fix` hazards can mangle a marker while the lint stays green, each armed only when the base preset turns its rule on: a marker is EXACTLY one line (`capitalized-comments` capitalises a wrapped continuation mid-sentence — off under `@jterrazz/typescript` v10), and it goes between STATEMENTS, never between two `const` declarations `one-var` in its `always` mode fuses into one chain. Both are worked in [docs/13](../../docs/13-linting.md).
- **No test doubles under `src/` (I4)** — `vi.mock`, `__mocks__/`, `__fixtures__/` and data-asset imports from a `.test.ts` are forbidden there; a module's typed fixtures are a sibling `<file>.fixtures.ts`.
- **Hygiene** — no committed `.only` / `.skip`, at least one `expect()` per `test()`, no two literal test names alike in a file, a lowercase title. This floor is oxlint's own `vitest` plugin, wired by `@jterrazz/typescript` over the test globs; cite its ids (`vitest/no-focused-tests`, `vitest/expect-expect`, `vitest/no-identical-title`, `vitest/prefer-lowercase-title`), not a `jterrazz/j*` id.
- **No arbitrary sleep (J2)** — under `specs/**`, `setTimeout` / `setInterval` / `Atomics.wait` are forbidden; synchronise with `waitFor`.

The full list, with ids to cite, is [references/rules.md](references/rules.md); the reasoning is the constitution, [docs/12](../../docs/12-conventions.md).

**Trigger on:** writing or editing any `*.test.ts` / `*.specification.ts` in a jterrazz repository, a plain unit test included; imports of `@jterrazz/test`; prompts about specification runners, seeds, fixtures, contracts, tokens, directory snapshots, rendered-page visit scenarios, simulator screen scenarios, or the Given/Then convention.

**Do NOT use for:** tests written on another runner (jest, mocha, ava, node:test, playwright's own runner) or in another language — the conventions above are a vitest-and-TypeScript dialect and do not transfer. Rendered-page/browser testing IS covered — through `specification.website()`, not raw Playwright. Native-app testing IS covered — through `specification.mobile()`, not raw appium/webdriverio.

## Routing table

Load the one reference that matches the task; each also names the docs chapter carrying the prose.

| Task                                                                 | Reference                                                      | Prose chapter                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Writing **API** specs (HTTP, in-process)                             | [references/api.md](references/api.md)                         | [docs/05-api.md](../../docs/05-api.md)                                        |
| Writing **jobs** specs (background pipelines)                        | [references/jobs.md](references/jobs.md)                       | [docs/06-jobs.md](../../docs/06-jobs.md)                                      |
| Writing **CLI** specs (exec, env, fixtures, docker)                  | [references/cli.md](references/cli.md)                         | [docs/07-cli.md](../../docs/07-cli.md)                                        |
| Writing **spec documents** (`<case>.spec.yaml`)                      | [references/cli.md](references/cli.md)                         | [docs/07-cli.md](../../docs/07-cli.md)                                        |
| Writing **integration** specs (a module on real services / a golden) | [docs/17-integration.md](../../docs/17-integration.md)         | [docs/17-integration.md](../../docs/17-integration.md)                        |
| Writing **website** specs (fetch, visit, scenarios)                  | [references/website.md](references/website.md)                 | [docs/14-website.md](../../docs/14-website.md)                                |
| Writing **component** specs (render, hooks, DOM)                     | [references/component.md](references/component.md)             | [docs/16-component.md](../../docs/16-component.md)                            |
| Writing **mobile** specs (open, simulator, screens)                  | [references/mobile.md](references/mobile.md)                   | [docs/15-mobile.md](../../docs/15-mobile.md)                                  |
| **Dynamic values** / the `{{token}}` grammar                         | [references/tokens.md](references/tokens.md)                   | [docs/09-tokens.md](../../docs/09-tokens.md)                                  |
| **Declaring** what an LLM / HTTP call replies                        | [references/contracts.md](references/contracts.md)             | [docs/10-contracts.md](../../docs/10-contracts.md)                            |
| **Streamed** replies (`http.stream`, `http.sse`) and `intercept()`   | [references/contracts.md](references/contracts.md)             | [docs/10-contracts.md](../../docs/10-contracts.md)                            |
| **Time** (`clock`) and the **doubles ladder**                        | [docs/12-conventions.md](../../docs/12-conventions.md)         | [docs/12-conventions.md](../../docs/12-conventions.md)                        |
| **Services** and `process()`                                         | [docs/11-services.md](../../docs/11-services.md)               | [docs/11-services.md](../../docs/11-services.md)                              |
| Weird failures / **pitfalls**                                        | [references/troubleshooting.md](references/troubleshooting.md) | Pitfalls sections of each chapter                                             |
| **Rule ids** (lint plugin + checker)                                 | [references/rules.md](references/rules.md) (generated)         | [docs/12](../../docs/12-conventions.md) · [docs/13](../../docs/13-linting.md) |

Assertions in depth: [docs/08-assertions.md](../../docs/08-assertions.md). Services & infra: [docs/11-services.md](../../docs/11-services.md).

## Docs (canonical, in-repo)

- Guide chapters under `docs/` and the committed API reference `docs/reference/`.
- Releases: <https://github.com/jterrazz/package-test/releases>
