# Agent brief - `@jterrazz/test`

Declarative testing framework for APIs, jobs, and CLIs. Three constructors — `specification.api()`, `specification.jobs()`, `specification.cli()` — with terminal actions (`.get()`/`.request()`/`.trigger()`/`.exec()` execute and resolve to typed results) and all assertions via vitest `expect()` custom matchers. Normative rules: the constitution is `docs/09-conventions.md`, the generated per-rule catalogue is `docs/10-linting.md` (mirrored for agents in `skills/jterrazz-test/references/rules.md`); narrative docs in `docs/`.

## Setup

```bash
npm install
```

Requires Docker running for HTTP and adapter tests.

## Commands

| Task                             | Command                           |
| -------------------------------- | --------------------------------- |
| Run all tests                    | `npm test`                        |
| Run fast tests only (no infra)   | `npx vitest --run --project fast` |
| Build the bundle                 | `npm run build`                   |
| Lint + format + typecheck + knip | `npm run lint`                    |
| Auto-fix lint issues             | `npm run lint:fix`                |
| Generate API docs + catalogue    | `npm run docs` (or `make docs`)   |

## Repo layout

```
src/
├── index.ts                       # public entry — the ONLY import point (F1) + composition root wiring the integration registry (I1)
├── core/                          # zero external imports (node builtins allowed) — CONVENTIONS I1; module unit tests are SIBLINGS: `<file>.test.ts` next to `<file>.ts` (I2)
│   ├── specification/
│   │   ├── shared/                # specification.{api,jobs,cli} object, SpecificationBuilder + facets (builder.ts),
│   │   │   │                      #   caller.ts (test-file detection), resolve.ts (root discovery A9), reporter.ts,
│   │   │   │                      #   orchestrator.ts (container lifecycle), registry.ts (integration seam),
│   │   │   │                      #   compose-file.ts (compose types + detection), services.ts (isolation/startup helpers)
│   │   │   └── result/            # BaseResult + read-only accessors (stream, json, filesystem, directory, response, table, grep)
│   │   ├── api/                   # startApi constructor + HttpResult + fetch adapter
│   │   ├── jobs/                  # startJobs constructor
│   │   └── cli/                   # startCli constructor + CliResult + exec adapter
│   ├── matching/                  # match.* vocabulary + {{token}} structural comparison engine
│   ├── http-files/                # requests/*.http + expected/*.http (responses) parser/serializer
│   ├── contracts/                 # defineContract + intercept types + generic http provider (no external dep)
│   └── ports/                     # ALL interfaces: database, service, isolation, container, server, command
├── integrations/                  # one folder = one external dependency (I1), each imports only its own dep + core
│   ├── postgres/  ├── redis/  ├── sqlite/        # service handles
│   ├── testcontainers/  ├── compose/             # container runtimes (compose owns the yaml parser)
│   ├── docker/                    # docker CLI shell-outs: ContainerAccessor, docker-lookup
│   ├── hono/                      # in-process server adapter
│   ├── msw/                       # intercept registration engine
│   └── openai/  └── anthropic/    # intercept providers
├── vitest/                        # ALL runner coupling: expect() matchers, TEST_UPDATE / -u detection, mockOf, mockOfDate
└── lint/                          # tool-facing static channel (I1: zero runtime imports): oxlint plugin (dist/oxlint.js) — one file per jterrazz/<rule> under rules/ (each carries its normative text as meta.docs from manifest.ts) + ast/fs-cache helpers, D4 conventions checker (checker.ts + dist/checker.js CLI), catalogue manifest + generator (manifest.ts is the SOURCE OF TRUTH for the mechanized catalogue; catalog.ts → dist/catalog.js regenerates the docs/10-linting.md catalogue + skills/jterrazz-test/references/rules.md), catalogue freshness+completeness meta-test (plugin.test.ts)
specs/                             # ONLY product specifications (I2), written with @jterrazz/test
# LAYOUT (rule C1'): specs/<facet>/ carries its runner(s) at the ROOT (specs/<facet>/<name>.specification.ts);
# tests live one level down in DOMAIN folders (specs/<facet>/<domain>/<aspect>.test.ts). Tests at the facet
# root are forbidden; specs inside a domain are forbidden. "The folder follows the assets": a test with its
# OWN asset dirs (seeds/expected/…) gets its own domain; asset-less tests group as sibling <id>.test.ts in a
# named GROUP folder (e.g. specs/lint/hygiene/j5-lowercase-title.test.ts).
├── api/                           # api facet: api.specification.ts + intercepts.specification.ts at root; domains: assertions, intercepts (D7, node-only), lifecycle, requests, responses, seeding
├── jobs/                          # jobs facet: jobs.specification.ts (factory) + static-jobs.specification.ts (array) at root; domain: triggering
├── cli/                           # cli facet: cli.specification.ts + db/docker/transform/asymmetric-transform runners at root; domains: assertions, directory, docker, env, exec, seeding, tokens
├── integrations/                  # per-dependency tests: container-logs, initiation-errors, orchestrator, postgres, redis — Docker required, sequential
├── lint/                          # E2E lint facet: lint.specification.ts + checker.specification.ts at root; tests grouped by CONVENTIONS family: runners/ chains/ files/ assertions/ imports/ architecture/ hygiene/ checker/ (needs npm run build first)
└── fixtures/                      # SHARED fixture pool (reached via .fixture('$FIXTURES/…')): app, cli-app, docker-cli, broken-* infra fixtures, and lint-violations/ (per-rule violation+ok twins for the E2E lint specs)
```

## Test runner modes

`test.projects` in `vitest.config.ts` defines four projects (vitest 4 removed workspace files):

| Project        | Includes                                                                             | Infra                                                                | Tests           |
| -------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------- |
| `fast`         | `src/**/*.test.ts` (sibling module tests) + `specs/cli/**` + `specs/lint/**`         | none (docker specs self-skip; lint specs need `npm run build` first) | 722             |
| `api`          | `specs/api/**` + `specs/jobs/**` — node mode, in-process Hono + testcontainers       | Docker                                                               | 52              |
| `api-stack`    | same files, `env: { TEST_MODE: 'compose' }`, **excludes** `specs/api/intercepts/**`  | Docker compose                                                       | 38 (+1 skipped) |
| `integrations` | `specs/integrations/**` — container lifecycle, sequential (`fileParallelism: false`) | Docker                                                               | 54              |

`api` and `api-stack` run the **same test files**; the mode switch lives ONLY in `vitest.config.ts` (CONVENTIONS A5). `api-stack` excludes `specs/api/intercepts/**` because `.intercept()` is in-process MSW and unavailable in compose mode (I3/D7) — the one skipped stack test reflects that boundary. The framework reads exactly two env vars: `TEST_MODE` and `TEST_UPDATE` (E1). Counts are indicative — run `npx vitest --run --project <name>` to confirm.

## Conventions

- **Docs-as-code split.** `docs/09-conventions.md` is the hand-maintained **constitution** — principles, the enforcement channels, non-mechanizable criteria, process rules (C1 grouping, D11 golden-file, K1 retro-propagation), design rationales — organized by family (A runners, B chains + `job` vocab, C files/folders, D assertions/tokens, E env, F imports, G infra, H naming, I architecture, J hygiene, K retro-propagation). The **mechanized per-rule catalogue is GENERATED from the code** (`src/lint/manifest.ts`) into the `docs/10-linting.md` catalogue + `skills/jterrazz-test/references/rules.md` — never edit those by hand; add a mechanized rule to the manifest + its implementation, then `npm run docs`. No duplication: a machine-checkable rule is written once, in the code. The broader corpus/projections doctrine lives in `@jterrazz/typescript`'s `docs/06-repo-structure.md`.
- Each mechanized rule names one of **four enforcement channels** — **static** (`jterrazz/*` oxlint plugin + the D4 conventions checker `dist/checker.js`), **checker** (bundled cross-file/token passes: C9, B5-by-inference, A7, D4/D4b/D10), **runtime** (framework refuses misuse: A6, A7, B2, B6, D7, I3), **process** (review-borne: C1, D11, K1) — plus the **meta-test** channel (framework run on itself: every token has a +/- test in `src/core/matching/`; the catalogue stays fresh via `src/lint/plugin.test.ts`). Most enforcement is programmatic, not manual review.
- Lint config (`@jterrazz/typescript` - oxlint + oxfmt + knip + tsgo); the tsconfig typechecks `src/` AND `specs/` (fixtures excluded) — keep it that way, it's what catches result-typing regressions
- **Self-lint**: `oxlint.config.ts` loads `./dist/oxlint.js` via `jsPlugins` and spreads `recommendedRules` — so `npm run build` MUST precede `npm run lint`. E2E lint specs live in `specs/lint/**` (one violation/compliant fixture pair per rule under `specs/fixtures/lint-violations/`), the checker step is chained in `npm run lint`. Docs: `docs/10-linting.md`
- Test writing convention (`// Given -` / `// Then -` comments, always both)
- Directory layout per feature (`seeds/` SQL-only, `fixtures/` feature-local, `requests/` inputs, `contracts/`, `intercepts/`, `expected/` — all expected fixtures incl. response `.http`, flat, extension in the name); shared fixtures live in `specs/fixtures/`, reached via `.fixture('$FIXTURES/…')`. One file-state verb `.fixture(path)` (no `.project()`, no `seedHandlers`); `.seed()` is SQL-only (C7)
- Runners are created in `*.specification.ts` files and destructured with canonical names: `{ api, cleanup }`, `{ jobs, cleanup }`, `{ cli, cleanup }` — always `afterAll(cleanup)`
- Accessors are read-only; ALL assertions go through `expect()` — `expect(result.stdout).toContain(...)`, `expect(result.response).toMatch('created.http')`, `await expect(result.table('users', { database: 'db' })).toMatchRows(...)`
- Dynamic values: the `{{token}}` grammar in fixtures, `match.*` in code (same vocabulary; see `docs/06-tokens.md`)
- Snapshot fixtures update with `TEST_UPDATE=1` (or vitest `-u`) — tokens are preserved, `{{workdir}}` is substituted

## Self-test on changes

This package self-tests via its own framework. Tests under `specs/cli/` use `specification.cli()` against a fixture CLI app; `specs/api/` + `specs/jobs/` + the sibling `src/**/<file>.test.ts` module tests cover the api/jobs facets and the token grammar. When you change `SpecificationBuilder`, the matchers, or the structural engine, these are the canonical regression coverage.

## Docs

- `docs/` — narrative chapters, numbered: `01` getting-started, `02` api, `03` jobs, `04` cli, `05` assertions, `06` tokens, `07` contracts, `08` services, `09` conventions, `10` linting (each ends with Pitfalls + Related)
- `npm run docs` regenerates the two committed projections: the API reference (`docs/reference/`, typedoc via `typescript docs` — a code → docs cross-layer projection) and the rule catalogue (`docs/10-linting.md` + `skills/jterrazz-test/references/rules.md`, spliced from `src/lint/manifest.ts`). Both are sync-checked: `npm run lint` runs `docs --check` (the Docs sync pass) + the catalogue freshness meta-test — both must hold after one `npm run docs`
- Docs are committed and consumed in-repo (chapters under `docs/`, the API reference under `docs/reference/`, agent routing via `skills/jterrazz-test/`); there is no rendered site and nothing is published from `docs/`
- **Standing instruction (rule K1): a discovery — new edge case, defect, behavior change — grows a guard (static rule / meta-test / runtime error) that stops it recurring, in the same change.** A mechanized rule goes into `src/lint/manifest.ts` (+ its implementation), then `npm run docs` regenerates the `docs/10-linting.md` catalogue + `skills/jterrazz-test/references/rules.md`; a new principle or non-mechanizable criterion goes into the `docs/09-conventions.md` constitution. Update `docs/` alongside. When the public API changes, also update `README.md`, `skills/jterrazz-test/SKILL.md` + its `references/`.
