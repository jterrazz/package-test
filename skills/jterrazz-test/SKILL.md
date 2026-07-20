---
name: jterrazz-test
description: Testing conventions for @jterrazz projects — unit/integration/e2e structure, vitest, testcontainers, golden files, mocks. Use when writing, organizing, or debugging tests in a jterrazz repo.
metadata:
    version: '9.0'
---

# `@jterrazz/test`

The ecosystem's declarative testing framework for HTTP APIs, background jobs, CLIs, and rendered websites. A spec reads as a sentence — `await api.seed('users.sql').request('create-user.http')` — and the vitest test name is its only description. Infrastructure (Postgres/Redis/SQLite/Docker, or a real chromium) is started, isolated per worker, and cleaned up for you.

## Mental model (read once)

- **Four constructors, only four** — `specification.api()`, `specification.jobs()`, `specification.cli()`, `specification.website()`. Created in a `*.specification.ts` file at the facet root, destructured with the canonical name (`{ api, cleanup }` / `{ jobs, cleanup }` / `{ cli, cleanup }` / `{ website, cleanup }`, no aliasing), always `afterAll(cleanup)`.
- **Terminal actions** — `.request()` / `.get()` (api), `.trigger()` (jobs), `.exec()` (cli), `.fetch()` / `.visit()` (website) execute the chain and resolve to a typed result. Setups (`.seed()`, `.fixture()`, `.env()`, `.headers()`, `.intercept()`) chain before them. No `.run()`, no label, no `.spawn()`. One chain = one action; databases reset each chain.
- **Every assertion goes through `expect()`** — accessors (`result.stdout`, `result.response`, `result.table(...)`, `result.file(...)`) are read-only; the matchers are registered on vitest's `expect`. `await` exactly the IO matchers (`toMatchRows`, `toBeEmpty`, `toBeRunning`, `toMatch` on tree subjects); everything else is sync.
- **Goldens first (D11)** — snapshot the whole surface per scoped use case (`expect(x).toMatch('case.http'|'case.txt')`, tokens for volatile parts, `TEST_UPDATE=1` to generate). `.grep()` / `toContain` are the scalpel for targeted probes, not the default.
- **One verb per state** — `.seed()` is SQL-only (database state); `.fixture(path)` is the one file-state verb (copies into the cwd). No `.project()`, no seed handlers.
- **Layout in one breath** — `specs/<facet>/<name>.specification.ts` (runner at the facet root) + `specs/<facet>/<domain>/<aspect>.test.ts` (tests one level down). The folder follows the assets. Module unit tests are SIBLINGS under `src/` (`<file>.test.ts`), never under `specs/`.
- **Dynamic values** — the `{{token}}` grammar in fixtures, `match.*` in code (same vocabulary). Every test carries both `// Given -` and `// Then -`.

## When to use this skill

**Trigger on:** imports of `@jterrazz/test`; edits to `*.test.ts` / `*.specification.ts` in a repo using it; prompts about specification runners, seeds, fixtures, contracts, intercepts, tokens, directory snapshots, rendered-page visit scenarios, or the Given/Then convention.

**Do NOT use for:** plain `vitest` unit tests of a pure function; frontend component tests (Vitest + Testing Library). Rendered-page/browser testing IS covered — through `specification.website()`, not raw Playwright.

## Routing table

Load the one reference that matches the task; each also names the docs chapter carrying the prose.

| Task                                                | Reference                                                      | Prose chapter                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Writing **API** specs (HTTP, node vs compose)       | [references/api.md](references/api.md)                         | [docs/02-api.md](../../docs/02-api.md)                                        |
| Writing **jobs** specs (background pipelines)       | [references/jobs.md](references/jobs.md)                       | [docs/03-jobs.md](../../docs/03-jobs.md)                                      |
| Writing **CLI** specs (exec, env, fixtures, docker) | [references/cli.md](references/cli.md)                         | [docs/04-cli.md](../../docs/04-cli.md)                                        |
| Writing **website** specs (fetch, visit, scenarios) | [references/website.md](references/website.md)                 | [docs/11-website.md](../../docs/11-website.md)                                |
| **Dynamic values** / the `{{token}}` grammar        | [references/tokens.md](references/tokens.md)                   | [docs/06-tokens.md](../../docs/06-tokens.md)                                  |
| **Mocking** an LLM / HTTP call (contracts)          | [references/contracts.md](references/contracts.md)             | [docs/07-contracts.md](../../docs/07-contracts.md)                            |
| Weird failures / **pitfalls**                       | [references/troubleshooting.md](references/troubleshooting.md) | Pitfalls sections of each chapter                                             |
| **Rule ids** (lint plugin + checker)                | [references/rules.md](references/rules.md) (generated)         | [docs/09](../../docs/09-conventions.md) · [docs/10](../../docs/10-linting.md) |

Assertions in depth: [docs/05-assertions.md](../../docs/05-assertions.md). Services & infra: [docs/08-services.md](../../docs/08-services.md).

## Docs (canonical, in-repo)

- Guide chapters under `docs/` and the committed API reference `docs/reference/`.
- Changelog: <https://github.com/jterrazz/package-test/blob/main/CHANGELOG.md>
