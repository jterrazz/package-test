# Spec-driven development

> Conventions for using `@jterrazz/test` to drive feature development. The framework's normative rules live in the repo's `CONVENTIONS.md`; this file is about workflow.

## Core principle

Every public behavior is defined by a specification test. **The spec IS the source of truth** - write the spec first, then the code.

## Coverage rules

- Every command, endpoint, job, feature gets a spec.
- Every spec covers: **success case**, **edge cases**, **error cases with error messages**.
- Error cases are as important as happy paths - test that failures produce useful output.
- Error tests live in their domain folder (seeding errors in `seeding/`, NOT a separate `errors/`).

## Retro-propagation (rule K)

Every defect class you hit — a bug, a review finding, a migration surprise — must grow its own guard **in the same change**, so it cannot come back silently:

- **static** — an oxlint / `typescript check` rule (naming, import graph, missing Given/Then), or a **checker** pass for data fixtures / cross-file analysis (C9, B5-by-inference, A7).
- **meta-test** — a truth verified by running the framework on itself (e.g. a new token gets a positive AND negative test in `src/core/matching/`).
- **runtime** — the framework throws on the misuse (A6, A7, B2, B6, D7, I3).
- **process** — review judgement no channel can settle (C1, D11, K1).

A mechanized guard is authored in the code — `src/lint/manifest.ts` (the rule's normative text) + its implementation — and the catalogue regenerates (`CONVENTIONS-CATALOG.md` + `docs/10-linting.md`). A new principle or non-mechanizable criterion goes into the `CONVENTIONS.md` constitution. If no channel fits, say so explicitly (e.g. "redundant test — human judgement"). A fix without a guard is half a fix — update `docs/` alongside it.

## When to use which constructor

### API projects (HTTP services with infrastructure)

| Mode                    | Purpose                                                        | Scope                                                                    |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `node` (default)        | Development workhorse - fast, real containers, in-process Hono | All specs - every endpoint, DB state, error                              |
| `compose` (`TEST_MODE`) | CI validation - full docker compose, real HTTP                 | Critical paths only - core flows, cross-container networking, deployment |

**One definition, zero switches in test code**: the specification file calls `specification.api()` once; the mode switch lives in `vitest.config.ts` via `env: { TEST_MODE: 'compose' }` (rule A5). Compose is compute-heavy — focus its project on what ONLY it can catch: real HTTP, cross-container networking, compose orchestration.

### Jobs (background pipelines, no HTTP surface)

`specification.jobs({ services, jobs })` — in-process by definition, no mode. Cover every registered job: happy path, provider failures via intercepts (`openai.error(429)`, `anthropic.timeout()`), and the resulting database state.

### CLI projects (build tools, linters, formatters, scaffolding)

`specification.cli(bin, options)` runs the real binary - inherently e2e. No split needed. Test every command with every meaningful variation:

```
Feature: build command
├── builds successfully (exit 0, output files)
├── generates ESM output with correct content
├── generates type declarations
├── does NOT generate CJS output (app mode)
├── fails on missing entry point (meaningful error)
└── fails on invalid TypeScript (meaningful error)
```

## The dual-project pattern with `TEST_MODE`

```typescript
// specs/api/api.specification.ts — ONE definition, no switch
import { afterAll } from 'vitest';
import { postgres, specification } from '@jterrazz/test';
import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({
    services: { db: postgres() },
    server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
    // mode: absent → TEST_MODE env → 'node'. Root auto-discovered (rule A9).
});

afterAll(cleanup);
```

```typescript
// vitest.config.ts - same files, two projects (vitest 4: test.projects)
export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'api',
                    include: ['specs/api/**/*.test.ts', 'specs/jobs/**/*.test.ts'],
                },
            },
            {
                test: {
                    name: 'api-stack',
                    include: ['specs/api/**/*.test.ts', 'specs/jobs/**/*.test.ts'],
                    // Intercepts are in-process MSW — node-only (I3/D7)
                    exclude: ['specs/api/intercepts/**'],
                    env: { TEST_MODE: 'compose' },
                },
            },
        ],
    },
});
```

```typescript
// specs/api/users/users.test.ts - runs in BOTH projects unchanged
import { api } from '../api.specification.js';

test('creates a user', async () => { ... });
```

In compose mode `server` is ignored (the app runs in the stack) and the services-record keys remain the `database:` vocabulary — the same seeds and table assertions work in both modes.

## Test structure (per feature folder — rule C)

`specs/` holds ONLY product specifications (rule I2) — module unit tests are SIBLINGS of their source (`src/<file>.test.ts` next to `src/<file>.ts`), never under `specs/`.

```
specs/
├── api/
│   ├── api.specification.ts    # exports { api, cleanup, docker, orchestrator }
│   ├── intercepts/             # strict-intercept specs (D7) — node-only; api-stack EXCLUDES this
│   └── {feature}/
│       ├── {feature}.test.ts   # file named after its folder (rule C1)
│       ├── seeds/              # *.sql ONLY — database state
│       ├── requests/           # *.http — COMPLETE request (method, path, headers, body) — inputs
│       ├── contracts/          # {name}.{provider}.ts via defineContract (flat)
│       ├── intercepts/         # {provider}/{name}.json inline fixtures (escape hatch)
│       └── expected/           # all expected fixtures, flat — incl. response *.http (status + header subset + body)
├── jobs/
│   └── {feature}.test.ts       # .trigger(name), provider failures via intercepts
├── cli/
│   ├── cli.specification.ts    # runner(s) at the facet ROOT ({ cli } + afterAll(cleanup)) — rule C1
│   └── {domain}/               # a product command/area — the folder follows the assets
│       ├── {aspect}.test.ts    # 1..n test files per domain
│       ├── fixtures/           # domain-local files/dirs copied into the working dir via .fixture('name')
│       ├── seeds/              # *.sql ONLY — database state
│       └── expected/           # snapshots, FLAT — 'help.txt', 'config.json', 'tree-name/'
├── integrations/               # per-dependency container-lifecycle tests (Docker, sequential)
└── fixtures/                   # SHARED fixture pool — projects/apps reached via .fixture('$FIXTURES/…') + broken-* infra fixtures
```

**Placement (rule C1'):** a `*.specification.ts` runner sits at the **facet root** (`specs/<facet>/<name>.specification.ts`); a `*.test.ts` sits at **facet/domain** depth. **The folder follows the assets:** a test with its OWN asset dirs gets its own domain folder; asset-less tests (or tests sharing the `$FIXTURES/` pool) group as sibling `<aspect>.test.ts` files inside a named group folder.

## Tool-output testing (golden-file, rule D11)

When the subject is a tool's output (a linter, compiler, or the product CLI), test the **product command** — never a third-party binary directly (rule B9: `specification.cli()` on a `node_modules/.bin` binary is a warning). Drive `cli.exec('check')`, `cli.exec('build')`, … and assert the output.

Prefer a **full snapshot per scoped use case** over a cluster of greps:

- One small **fixture project per use case** (`check/fixtures/{type-imports,unused-code,architecture-boundaries,…}/`, each with its own valid+invalid files). The fixture IS the Given — no shared `beforeAll` run.
- Assert the whole surface: `expect(result.stdout).toMatch('<use-case>.txt')` + `exitCode`. Cover volatile parts with tokens (`{{duration}}`, `{{workdir}}`, `{{path}}`); generate with `TEST_UPDATE=1`.
- Add ONE kitchen-sink project + full snapshot as the whole-surface regression net (it churns — that's its role).
- Keep `.grep()` as the **scalpel**: targeted presence/absence probes in large outputs, not the default. `result.stdout.grep(pattern)` returns a `TextAccessor` (chainable, snapshot-able) — there is no `result.grep()`.

`expected/` is flat: `toMatch('help.txt')` → `expected/help.txt`; a slash creates a subfolder (`toMatch('build/verbose.txt')`); tree snapshots are directories (`expected/shop-scaffold/`).

## File naming

| Type            | Suffix               | Location                                       |
| --------------- | -------------------- | ---------------------------------------------- |
| Module unit     | `<file>.test.ts`     | SIBLING of `<file>.ts` under `src/` (rule I2)  |
| Module fixtures | `<file>.fixtures.ts` | sibling of the `.test.ts` — typed exports (I4) |
| API specs       | `.test.ts`           | `specs/api/`                                   |
| Jobs specs      | `.test.ts`           | `specs/jobs/`                                  |
| CLI specs       | `.test.ts`           | `specs/cli/`                                   |
| Runner setup    | `.specification.ts`  | `specs/` (rule A1)                             |

## Test writing convention - Given / Then

Every test uses `// Given -` and `// Then -` comments. **Always both, never one without the other.**

```typescript
test('creates a user and returns 201', async () => {
    // Given - two existing users
    const result = await api
        .seed('initial-users.sql', { database: 'db' })
        .request('create-user.http');

    // Then - user created with all three in table
    expect(result.response).toMatch('user-created.http');
    await expect(result.table('users', { database: 'db' })).toMatchRows({
        columns: ['name'],
        rows: [['Alice'], ['Bob'], ['Charlie']],
    });
});
```

```typescript
test('builds the project', async () => {
    // Given - sample app project spread into the cwd
    const result = await cli.fixture('$FIXTURES/sample-app/').exec('build');

    // Then - ESM output with source maps
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Build completed');
    expect(result.file('dist/index.js').exists).toBe(true);
    expect(result.file('dist/index.js.map').exists).toBe(true);
});
```

### Rules

- Every test gets `// Given -` and `// Then -` comments. Always both, never one without the other.
- `// Given -` setup context, one short phrase.
- `// When -` only if the action isn't obvious — the spec chain IS the when.
- `// Then -` what we verify, one short phrase.
- Test names describe behavior (`test('creates a user')`), not mechanics — the test name is the spec's only description (rule B3).
- One chain = one terminal action; databases reset per chain — sequential scenarios are expressed through seeds, never by chaining specs (rules B1/B7).
- Prefer file fixtures (`.http`, `expected/`) with `{{token}}` placeholders for multi-line or dynamic output; update with `TEST_UPDATE=1` or vitest `-u` (tokens are preserved).
- Error tests belong in their domain folder (seeding errors in `seeding/`, not a separate `errors/`).
