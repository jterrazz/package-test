---
name: jterrazz-test
description: Use when writing integration, e2e, or command/CLI tests with @jterrazz/test. Covers the specification.api/.jobs/.cli constructors, terminal actions, expect()-based matchers, the {{token}} grammar, database seeding, intercept contracts, Docker-aware CLIs, and the Given/Then convention.
metadata:
    version: '9.0'
---

# `@jterrazz/test`

The ecosystem's testing framework. Three constructors — `specification.api()`, `specification.jobs()`, `specification.cli()` — with terminal actions and all assertions via vitest `expect()` (auto-registered, subject-typed matchers). Specs read as sentences: `await api.seed('users.sql', { database: 'db' }).request('create-user.http')` — the vitest test name is the spec's description. Handles containers, working directories, and cleanup automatically. Normative rules: `CONVENTIONS.md` in the repo.

## When to use this skill

**Trigger on:**

- Imports of `@jterrazz/test` in source.
- Edits to `*.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts` in repos using this framework.
- Edits to `*.specification.ts` runner files (at a facet root, e.g. `specs/cli/cli.specification.ts`, `specs/api/api.specification.ts`).
- User prompts mentioning specification runners, directory snapshots, test fixtures, seeds, contracts, intercepts, tokens, or "given/then" convention.

**Do NOT use this skill for:**

- Plain unit tests that use `vitest` directly without `@jterrazz/test` (e.g. testing a pure function).
- Frontend component tests (use Vitest + Testing Library).
- Browser e2e tests (use Playwright).

## Decision matrix - which constructor

| Question                                                                    | Use this pattern                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Testing an HTTP app (Hono) with real databases?                             | **`specification.api({ services, server })`** — node mode (default): testcontainers + in-process |
| Need the full deployed stack with real HTTP (or a non-Node app)?            | Same `.api()` definition, **compose mode** — `env: { TEST_MODE: 'compose' }` in vitest.config    |
| Testing background jobs (no HTTP surface)?                                  | **`specification.jobs({ services, jobs })`** — in-process by definition, `.trigger(name)`        |
| Testing a CLI binary, scaffolding tool, code generator, or bundler?         | **`specification.cli(bin, { root })`** — child process in a fresh temp dir                       |
| Does the CLI talk to a real database/redis?                                 | `specification.cli(bin, { services })` — `<KEY>_URL` + `DATABASE_URL`/`REDIS_URL` auto-injected  |
| Does the CLI under test spawn Docker containers you need to assert on?      | `specification.cli(bin, { docker: {...} })` — lazy `result.container(name)` accessors            |
| Do you need to stub an outgoing HTTP/LLM call (OpenAI, Anthropic, any URL)? | `defineContract` in `contracts/<name>.<provider>.ts` + `.intercept(contract)`                    |

## Quick start

```typescript
// specs/api/api.specification.ts
import { afterAll } from 'vitest';
import { postgres, specification } from '@jterrazz/test';
import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({
    services: { db: postgres() }, // → compose service "db"
    server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
});

afterAll(cleanup);
```

```typescript
// specs/api/users/users.test.ts
import { expect, test } from 'vitest';
import { api } from '../api.specification.js';

test('creates a user', async () => {
    // Given - the complete request from requests/create-user.http
    const result = await api.request('create-user.http');

    // Then - fixture match + row in the database
    expect(result.response).toMatch('user-created.http');
    await expect(result.table('users')).toMatchRows({ columns: ['name'], rows: [['Alice']] });
});
```

Actions are **terminal**: `.request()/.get()/.trigger()/.exec()` execute the spec and resolve to a typed result. There is no `.run()`, no label, no `.spawn()`.

## MUST / MUST NOT

- **MUST** create runners in `*.specification.ts` files, destructure with the canonical names — `{ api, cleanup }`, `{ jobs, cleanup }`, `{ cli, cleanup }` (no aliasing) — and call `afterAll(cleanup)`.
- **MUST** include both `// Given -` and `// Then -` comments on every test. Always both. The spec chain IS the `// When` — only add `// When -` if the action is non-obvious.
- **MUST** route every assertion through `expect()`: `expect(result.stdout).toContain('x')`, `expect(result.response).toMatch('created.http')`, `await expect(result.table('users', { database: 'db' })).toMatchRows(...)`. Accessors are read-only — assertion methods on accessors do not exist.
- **MUST** `await` exactly the IO matchers — `toMatchRows`, `toBeEmpty`, `toBeRunning`, and `toMatch` on `directory`/`filesystem` subjects. Everything else is sync.
- **MUST** pass `{ database: '<record key>' }` on every `.seed()`/`.table()` when ≥ 2 databases are declared — and NEVER pass it with exactly one (both are errors, rule A7).
- **MUST** keep `mode` out of specification files when `server` is defined — the compose switch lives in `vitest.config.ts` via `env: { TEST_MODE: 'compose' }`.
- **MUST** put request bodies of any substance in `requests/*.http` (complete request: `METHOD /path`, headers, blank line, raw body) and expected responses in `expected/*.http` (`HTTP/1.1 <status>`, header subset, body) — they are expected fixtures like any other.
- **MUST** use `{{token}}` placeholders for dynamic values in fixtures (`{{uuid}}`, `{{iso8601}}`, `{{workdir}}`, `{{type#ref}}` for captures) and `match.*` in code — never hand-widen with regexes or transforms first.
- **MUST** include the file extension in `toMatch` names (`'help.txt'`, never `'help'`) — except tree snapshots, which are directories.
- **MUST** declare business-meaningful intercepts as contracts (`contracts/<name>.<provider>.ts`, `provider ∈ { openai, anthropic, http }`, default export `defineContract({...})`).
- **MUST** cover every outgoing call once a chain declares one intercept — intercepts are STRICT (rule D7): any unmatched or queue-exhausted request fails the spec with an explicit "Unmatched outgoing HTTP request" error. A chain with zero intercepts is NOT network-guarded.
- **MUST** keep `.intercept()` specs in a node-only vitest project — it is in-process MSW, so a compose-mode `specification.api()` runner throws immediately. (This repo's `api-stack` project excludes `specs/api/intercepts/**`; `specification.jobs()` is always node, so intercepts always work there.)
- **MUST** declare Docker-aware cli results with `await using result = ...` so spawned containers are force-removed at scope exit.
- **MUST NOT** import from subpaths — everything comes from `@jterrazz/test`.
- **MUST NOT** call `.spawn()` — long-running processes use `.exec(args, { waitFor, timeout? })` (timeout defaults to 10 s).
- **MUST NOT** re-declare injected URLs with `.env({ DATABASE_URL: ... })` when `services` are declared — override only to change, `null` to remove.
- **MUST NOT** rely on a cli spec running inside a fixtures root. Every `.exec()` runs in a fresh `mkdtemp` directory; use `.fixture("$FIXTURES/name/")` (shared pool) or `.fixture("file")` (feature-local) to populate it. There is no `.project()` and no `seedHandlers` — `.fixture()` is the one file-state verb, `.seed()` is SQL-only.
- **MUST NOT** put module unit tests under `specs/` — they are SIBLINGS of their source (`src/<file>.test.ts` next to `src/<file>.ts`, rule I2). `specs/` holds ONLY product specifications; a test needing a real file or real infra IS a specification.
- **MUST** place runners at the **facet root** (`specs/<facet>/<name>.specification.ts`) and tests at **facet/domain** depth (`specs/<facet>/<domain>/<aspect>.test.ts`) — rule C1'. A test at the facet root, or a spec inside a domain, is a lint error. "The folder follows the assets": a test with its OWN asset dirs gets its own domain; asset-less tests group as sibling `<id>.test.ts` in a named group folder.
- **MUST** exercise the **product command**, never a third-party binary — `specification.cli()` on a `node_modules/.bin` binary is a B9 warning. Drive `cli.exec('check')`, `cli.exec('build')`, … and assert per-tool via the real output. Suppress with a reason only when the product genuinely IS that binary.
- **MUST** snapshot tool output the whole surface **per scoped use case** (rule D11): one fixture project per case (the fixture is the Given, no shared `beforeAll`), `expect(result.stdout).toMatch('<use-case>.txt')` + `exitCode`, tokens for volatile parts, `TEST_UPDATE=1` to generate. Keep `.grep()` as the SCALPEL for targeted probes only.
- **MUST** reach text via a `TextAccessor` (the universal text handle): `result.stdout` / `result.stderr` / container logs / `file().grep()`. `.grep(pattern)` returns a `TextAccessor` (chainable, snapshot-able) — there is **no** `result.grep()`; write `result.stdout.grep(...)`.
- **MUST** start every `test('…')` / `describe('…')` title **lowercase** (rule J5) — the name is a prose fragment; a leading capital is a lint error (titles opening on a non-letter are exempt).
- **SHOULD** retro-propagate (rule K): when you hit a new defect class, add the guard that stops it in the same change — a static lint rule, a self-run meta-test, or a runtime error. A mechanized rule is authored in the code (`src/lint/manifest.ts` + its implementation) and the catalogue regenerates (`CONVENTIONS-CATALOG.md`); a new principle goes into the `CONVENTIONS.md` constitution. Update `docs/` alongside.
- **SHOULD** enable the shipped oxlint plugin in consumer repos: `jsPlugins: ['@jterrazz/test/oxlint']` + spread `recommendedRules` (see `references/api-cheatsheet.md` and `docs/10-linting.md`) — most of the MUSTs above are then machine-enforced as `jterrazz/<rule>` diagnostics, plus the D4 token checker (`dist/checker.js`) for data fixtures.

## Common pitfalls

- **`result.stdout.toContain is not a function`** -> v9 final: accessors are read-only. Write `expect(result.stdout).toContain(...)`.
- **`result.grep is not a function`** -> `grep` moved onto the text handle and now returns a `TextAccessor` — write `result.stdout.grep(pattern)` (chainable + snapshot-able), not `result.grep(...)`.
- **A wall of `.grep()` assertions on one shared run** -> anti-pattern. Split into one fixture project per use case and snapshot the whole output (rule D11); grep is only for targeted presence/absence probes.
- **`specification is not a function` / `specification.app does not exist`** -> the constructors are `specification.api()`, `specification.jobs()`, `specification.cli()`.
- **`seed() targets database "..." but it was not found`** -> the `database` option takes the services RECORD KEY (`{ analyticsDb: postgres() }` → `database: 'analyticsDb'`), not the compose service name.
- **`seed(): N databases are declared — pass { database: ... }` / `redundant database option`** -> rule A7 cuts both ways: mandatory with ≥ 2 databases, forbidden with 1.
- **Service doesn't pick up compose image/env** -> a handle binds to the compose service named exactly like its record key, else the kebab-case conversion (`analyticsDb` → `analytics-db`); use `composeService: 'other-name'` only for names the key can't derive.
- **`Ambiguous compose binding for service key "..."`** -> the compose file declares both the exact key and its kebab-case form; rename one service or set `composeService` explicitly (rule A6).
- **"fixture "..." does not exist"** -> all expected fixtures — including response `.http` — live FLAT under `{test-file-dir}/expected/` (a slash in the name creates a subfolder). Run with `TEST_UPDATE=1` (or vitest `-u`) to create the baseline — tokens in existing fixtures are preserved.
- **Test fails on a uuid/timestamp/path that changes every run** -> tokenize the fixture: `{{uuid}}`, `{{iso8601}}`, `{{workdir}}`; capture cross-references with `{{uuid#order}}`. In code, `match.uuid()`, `match.ref('order')`.
- **Noisy stdout comparisons** -> ANSI is already stripped by default (`.text` stays raw); prefer tokens; `transform` is a last-resort escape hatch.
- **`CliResult.container: runner was not configured`** -> `.container(name)` needs `docker: { envVar, nameLabel, testRunLabel }` in the cli options.
- **jobs.trigger fails in the compose project** -> it doesn't: `specification.jobs()` has no mode and always runs in-process, whatever `TEST_MODE` says.
- **`Unmatched outgoing HTTP request during spec: ...`** -> strict intercepts (D7): the chain declared an intercept, and a request matched none (or its FIFO queue is exhausted). Add one `.intercept()` per expected call. The error lists every registered trigger and its consumption state.
- **`.intercept(): intercepts are in-process (MSW) and not available in compose mode ...`** -> move the intercept spec into a node-only vitest project; `api-stack` (compose) must exclude it.
- **A `src/` module test needs a real file or real infra** -> it's a specification, not a unit test — move it to `specs/` (rule I2/I4). Under `src/`, mocks/data are CODE (`mockOf`, `.fixtures.ts`); no `vi.mock`, `__mocks__/`, `__fixtures__/`.

## Deep references (loaded only when needed)

- [api-cheatsheet.md](references/api-cheatsheet.md) - full builder + matcher tables (setup, actions, accessors, tokens, contracts, docker, multi-db, mocking).
- [spec-driven-development.md](references/spec-driven-development.md) - coverage rules, the TEST_MODE dual-project pattern, file naming, test structure.

## Live docs (canonical)

- LLM-friendly full reference: <https://jterrazz.github.io/package-test/llms-full.txt>
- API index: <https://jterrazz.github.io/package-test/llms.txt>
- Changelog: <https://github.com/jterrazz/package-test/blob/main/CHANGELOG.md>
