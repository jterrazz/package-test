# 02 — Developing

How a change is made. The first half is this repository's own loop — the toolchain, the order its gates demand, which file a change opens and what it owes when it lands. The second half is the walkthrough a consuming project follows, from `npm install` to two passing specs.

## Changing this package

### The loop

| Task                             | Command                           |
| -------------------------------- | --------------------------------- |
| Install dependencies             | `npm install` (or `make install`) |
| Build the bundle                 | `npm run build`                   |
| Lint + format + typecheck + knip | `npm run lint`                    |
| Auto-fix what a fixer can        | `npm run lint:fix`                |
| Run every suite                  | `npm test`                        |
| Run the fast suite only          | `npx vitest --run --project unit` |
| Regenerate the projections       | `npm run docs` (or `make docs`)   |

Each has a `make` alias that installs first, which is what CI calls — [03 — Testing](03-testing.md) § What CI runs.

`better-sqlite3` is a native dependency, and an npm that does not run install scripts by default leaves it unbuilt: the `sqlite()` specs of the `unit` project then fail on a missing binding. `npm rebuild better-sqlite3` after the install fixes it, once per checkout.

### The build comes first

`oxlint.config.ts` loads this package's OWN plugin from `./dist/oxlint.js`, and the end-to-end lint specs load it too. Node's type-stripping does not resolve a `.js` specifier back to its `.ts` source, so **`npm run build` must precede `npm run lint`** and must precede the `unit` project. A lint run on a stale bundle judges the previous build's rules.

That config is also where this repository DECLARES its own architecture: `i1-layer-boundaries` ships inert, and `FRAMEWORK_LAYERS` in `oxlint.config.ts` is the enforced statement of the five trees [01 — Architecture](01-architecture.md) describes.

### Which file a change opens

| Changing…                                         | Opens                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A facet's chain, setups or terminal actions       | `src/facets/<facet>/`, over `model/chain/builder.ts`                                       |
| What a result exposes                             | `src/model/result/` — accessors stay READ-ONLY                                             |
| A matcher, or update-mode behaviour               | `src/model/goldens/` and `src/runner/` — the two sides of the runner coupling              |
| An external dependency's adapter                  | `src/seams/<dep>/`, which imports that dep and `model/` and no more                        |
| A `{{token}}` or the structural comparison        | `src/model/matching/`                                                                      |
| The `<case>.spec.yaml` grammar                    | `src/model/literate/` — read by BOTH the runner and the checker                            |
| A mechanized rule                                 | `src/lint/manifest.ts` **and** its implementation under `src/lint/rules/<facet-or-model>/` |
| A principle, or a criterion no machine can settle | [18 — Conventions](18-conventions.md), the constitution                                    |

### What a change owes

Four things land in the SAME commit as the change that makes them true.

- **The guard.** Every defect class discovered — in review, from a bug, during a migration — grows the thing that stops it recurring: a static rule, a meta-test, or a runtime refusal. That is rule K1, and it is what keeps the other channels growing instead of decaying. When no channel is possible, the change says so explicitly.
- **The regenerated projections.** `npm run docs` rewrites them all at once — the API reference under `docs/reference/`, the rule catalogue spliced into [19 — Linting](19-linting.md) and `skills/jterrazz-test/references/rules.md`, the capability matrix, the domain vocabulary and the siblingless table in [03 — Testing](03-testing.md), the fork in [18 — Conventions](18-conventions.md), the signature cards, and `schema/spec.schema.json`. Never edit one by hand: `npm run lint` runs the sync check and the freshness meta-tests, and both fail on a hand edit.

    **`docs/reference/` is regenerated from a plain CLONE, never from a worktree.** typedoc writes a `Defined in:` link per symbol from whatever the git origin resolves to, and a worktree under `home/<brand>/work/worktrees/` resolves it to a local path — which turns every `https://github.com/jterrazz/package-test/blob/main/…` into a bare path, a whole-file diff that looks like content and is only an address. So `Docs (sync)` is red on `docs/reference/` in a worktree BY CONSTRUCTION, and the projection is refreshed by regenerating it in a clone and committing what that writes.

- **The chapter the behaviour falsified.** A page that still describes the old behaviour is a defect that ships. The corpus is mapped by [`docs/README.md`](README.md).
- **The skill, when the public surface moved.** `skills/jterrazz-test/` routes agents into these chapters; `README.md` is the vitrine and moves with a public API change too.

## Using the framework

The rest of this chapter takes a consuming project from `npm install` to two passing specs: one HTTP API spec backed by a real Postgres container, and one CLI spec running a binary in a fresh temp directory. It also explains the one framework environment variable (`TEST_UPDATE`).

### Install

```bash
npm install -D @jterrazz/test vitest
```

Peer dependencies:

| Package  | Required | Needed for                                                    |
| -------- | -------- | ------------------------------------------------------------- |
| `vitest` | yes      | Everything — the framework registers its matchers into vitest |

`msw` (outgoing HTTP interception for `.intercept()`) ships as a direct dependency — no separate install. API specs pass your web app to `server`; the adapter only needs an object with a `request()` method, so bring your own web framework (e.g. `hono`) in your project.

**Docker** must be running for container-backed services (`postgres()`, `redis()`). `sqlite()` and plain CLI specs need no Docker.

Trying an unreleased branch of the framework: install a `npm pack` tarball, never a `file:` link — a link makes the consumer resolve `vitest`'s types twice, and the matcher augmentation then lands on one copy and not the other, so `toMatch` types while `toBeEmpty` does not.

Everything a spec needs imports from the single package root; the tool subpaths beside it are the ones the `exports` map publishes, and they are listed once — [01 § What the tree publishes](01-architecture.md#what-the-tree-publishes). F1 and F3 read that map, so a specifier it does not publish is refused:

```typescript
// the runners, the services, and what a chain stands on
import { postgres, process, redis, specification, sqlite } from '@jterrazz/test';
```

```typescript
// what a test says: contracts, dynamic values, doubles, time, assertions
import { anthropic, clock, defineContract, http, intercept } from '@jterrazz/test';
import { match, mockOf, openai, required, waitUntil } from '@jterrazz/test';
```

### The shape of every test

A **specification file** (`*.specification.ts`, under `specs/`) creates a runner once per suite. A **test file** imports the runner and writes specs. Every spec is one chain: zero or more setups, then exactly one terminal action, resolving to a typed result you assert on with `expect()`.

```
specification.api(…)         → { api, cleanup, docker }
specification.jobs(…)        → { jobs, cleanup }                       // no docker — jobs never spawn containers
specification.cli(…)         → { cli, cleanup, docker }
specification.integration(…) → { integration, cleanup }                // a module, against real services or a golden
specification.website(…)     → { website, cleanup, url }               // no docker — a browser, not a container
specification.mobile(…)      → { mobile, cleanup, udid }               // no docker — a simulator, not a container
```

The destructured names are canonical — no aliasing (`{ api: myApi }` is an error, rule A3) — and every specification file registers `afterAll(cleanup)` (rule A4).

### First API spec

```typescript
// specs/api/api.specification.ts
import { afterAll } from 'vitest';
import { specification, postgres } from '@jterrazz/test';
import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({
    services: {
        db: postgres(), // reported as "db"; its init reads docker/db/ (chapter 17)
    },
    server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
    // root: absent — auto-discovered by walking up to the nearest package.json
});

afterAll(cleanup);
```

```http
### specs/api/users/_requests/create-user.http — the COMPLETE request
POST /users
Content-Type: application/json

{ "name": "Alice" }
```

```http
### specs/api/users/_expected/user-created.http — status + header subset + body
HTTP/1.1 201 Created
Content-Type: application/json

{ "id": "{{uuid}}", "name": "Alice" }
```

```typescript
// specs/api/users/users.spec.ts
import { expect, test } from 'vitest';
import { api } from '../api.specification.js';

test('creates a user', async () => {
    // Given - empty database
    const result = await api.request('create-user.http');

    // Then - response matches the fixture; row landed in the database
    expect(result.response).toMatch('user-created.http');
    await expect(result.table('users')).toMatchRows({
        columns: ['name'],
        rows: [['Alice']],
    });
});
```

`{{uuid}}` is a placeholder from the unified [token grammar](15-tokens.md) — the response body must contain _a_ UUID there, whatever its value.

### First CLI spec

```typescript
// specs/cli/cli.specification.ts
import { resolve } from 'node:path';
import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

export const { cli, cleanup } = await specification.cli(
    resolve(import.meta.dirname, '../../bin/my-cli.sh'),
);

afterAll(cleanup);
```

```typescript
// specs/cli/help/help.spec.ts
import { expect, test } from 'vitest';
import { cli } from '../cli.specification.js';

test('shows help', async () => {
    // Given
    const result = await cli.exec('--help');

    // Then - full snapshot of stdout against _expected/help.txt
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('help.txt');
});
```

```
### specs/cli/help/_expected/help.txt — tokens work in text snapshots too
my-cli v{{semver}}
Started at {{iso8601}} in {{workdir}}
Done in {{duration}}
```

Each CLI spec runs in a fresh, empty temp directory. ANSI escape sequences are stripped before comparison by default (rule D6) — you never snapshot color codes.

### vitest config: the preset

`vitest.config.ts` starts from `defineSpecConfig()` — the shared preset, imported from the tool subpath beside `literate()`. What you pass is a plain vite/vitest config merged **over** the defaults, so one call gives you the ecosystem's common ground and you still state whatever you want:

```typescript
// vitest.config.ts
import { api, component, defineSpecConfig, unit, website } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            unit(), // `**/*.test.ts` outside specs/ — no browser, no pipeline
            component({ vite: './vite.config.ts', wrap: './src/providers.tsx' }),
            website(), // `specs/website/**` — the served product, in its own group
            api(), // `specs/api/**/*.spec.ts` — the app through HTTP, in-process
        ],
    },
});
```

What every helper accepts, on top of the project it already is:

| Option                | Does                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `include` / `exclude` | Replace the canonical globs. A default `exclude` guards the default `include`, so state both or neither                                |
| `timeout`             | Raise (or lower) the preset's 30 s for this project alone                                                                              |
| `serial`              | `fileParallelism: false` — the project's files run one at a time, for a facet whose files share one server, one database file, one app |

`component()` takes four more that are the APP's — `vite`, `wrap`, `viewport`, `timezone`/`locale`, and the `root` its relative paths are read against — and [07 — Component specs](07-component.md) owns them; `unit()` takes `roots`.

`unit()` and `component()` are a pair by construction: `unit()` collects `**/*.test.ts` outside `specs/` and excludes `**/*.test.tsx`, `component()` collects exactly those, so the suffix beside a file decides which project runs it and which rules judge it. `unit()` takes `roots?` where the modules are not at the repository root, or `include?` for the globs outright; the facet helpers collect `specs/<facet>/**/*.spec.ts` — the word for the assembled product (C12). All three carry `sequence.groupOrder` — node 0, `website` 1, `component` 2 — so the two browser projects never open two Chromiums at once on a 2-vCPU runner. What `component()` sets — the provider pinned to the runner's exact version, the msw worker served from this package's own install, the JSX transform the current Vite uses, the dependencies a cold cache must pre-bundle, the artefact directories, the group order that keeps two Chromiums apart — is [07 — Component specs](07-component.md)'s. `component()` is async, and a project may be a promise: `projects: [component({ … })]` needs no `await`.

#### What the preset sets

| Setting                          | Value                                                | Why                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cacheDir`                       | `.artifacts/vitest`                                  | The artefact convention below — vite's transform cache leaves `node_modules/`                                                                                                                                                                                                                          |
| `test.coverage.reportsDirectory` | [the artefact path](#artefacts-live-under-artifacts) | Where a tool writes what it generates is the toolchain's convention ([`@jterrazz/typescript` — Developing](https://github.com/jterrazz/package-typescript/blob/main/docs/02-developing.md)); the preset sets it so no consumer writes it. The **provider is yours to install** (`@vitest/coverage-v8`) |
| `test.testTimeout`               | `30_000`                                             | Vitest's 5s never survived a container boot, a `prisma db push` or a `next build`                                                                                                                                                                                                                      |
| `test.hookTimeout`               | `30_000`                                             | Same reason, for the `beforeAll` that starts the infrastructure                                                                                                                                                                                                                                        |
| `test.exclude`                   | vitest's defaults + `**/_fixtures/**`                | What a spec stands on is an input, never a suite — a repository must not run its own counter-examples                                                                                                                                                                                                  |
| `test.attachmentsDir`            | `.artifacts/vitest/attachments`                      | Vitest 5 writes `context.annotate()` attachments to `.vitest/` at the repository root                                                                                                                                                                                                                  |
| `test.outputFile`                | `.artifacts/vitest/{json,junit,html,blob}`           | Vitest 5 turned the json and junit reporters into FILE writers; all four are artefacts                                                                                                                                                                                                                 |
| `test.retry`                     | `0`                                                  | A flaky test is fixed or deleted — a retry turns a real defect into a slow one and hides it                                                                                                                                                                                                            |
| `test.restoreMocks`              | `true`                                               | A `vi.spyOn` a test forgets to restore fails a LATER file, one that did nothing wrong                                                                                                                                                                                                                  |
| `test.unstubGlobals`             | `true`                                               | Same for `vi.stubGlobal` — and it is what lets a test be written without an `afterEach` (rule J6w)                                                                                                                                                                                                     |
| `test.unstubEnvs`                | `true`                                               | Same for `vi.stubEnv`, which is the sanctioned way to state a module's env contract (rule E9w)                                                                                                                                                                                                         |
| `plugins`                        | `literate()`, when `literate:` is given              | Turns every matching `<case>.spec.yaml` into a test file (see [12 — CLI specs](12-cli.md))                                                                                                                                                                                                             |

It deliberately sets **nothing else**. `fileParallelism` is a per-project truth (a container-lifecycle suite is serial, an isolated one is not), stated by the project rather than by the preset — a helper states it for you when you pass `serial`, and a hand-written project states it itself; so do `reporters`, `environment`, `env`, `globalSetup` and every `include` — a preset that guessed those would be wrong more often than right.

**Why the artefact paths are the preset's.** Every one of them is a path the TOOL pins and a consumer never writes: a repository does not choose where `context.annotate()` lands, it discovers it one CI run later, as an untracked `.vitest/` beside `.artifacts/`. Moving them here is the same rule the estate applies to every tool — what a tool generates lives at `.artifacts/<tool>/` — applied once instead of in fourteen configs.

Two behaviours worth knowing:

- **Projects inherit the defaults too.** Vitest resolves each project as its own config and it inherits nothing from the root, so the preset merges the budgets, the exclusions and the cache dir into every inline project. A project declared as a glob string, a promise or a function is handed back untouched.
- **Arrays are ADDITIVE.** Vite's merge concatenates them, so your `exclude` adds to the preset's — you never spread `configDefaults.exclude` again — and your `plugins` join `literate()` rather than replacing it. Scalars (`testTimeout`, `name`, …) are plain overrides: what you state wins.

With `projects`, put `literate()` in the ONE project that collects those documents — its glob has to join that project's include — rather than in the top-level `literate:` key:

```typescript
import { defineSpecConfig, literate } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            {
                plugins: [literate({ specification: './specs/cli/cli.specification.ts' })],
                test: { name: 'cli', include: ['specs/cli/**/*.spec.ts'] },
            },
        ],
    },
});
```

#### Migrating a hand-rolled config

Swap the import, drop what the preset already says, keep what is yours:

```diff
-import { configDefaults, defineConfig } from 'vitest/config';
-import { literate } from '@jterrazz/test/vitest';
+import { defineSpecConfig, literate } from '@jterrazz/test/vitest';

-export default defineConfig({
+export default defineSpecConfig({
     test: {
-        testTimeout: 30_000,
-        hookTimeout: 30_000,

         projects: [
             {
                 test: {
                     name: 'api',
                     include: ['specs/api/**/*.spec.ts'],
-                    exclude: [...configDefaults.exclude, '**/_fixtures/**', 'specs/api/heavy/**'],
+                    exclude: ['specs/api/heavy/**'],
-                    testTimeout: 30_000,
                 },
             },
         ],
     },
 });
```

Then add `.artifacts/` to `.gitignore` and drop `node_modules/.vite` from it if it was listed. A project whose timeouts were LOWER than 30s, or higher, keeps stating them — the preset is a floor to start from, not a ceiling.

### Artefacts live under `.artifacts/`

The `.artifacts/<tool>/` convention is [`@jterrazz/typescript`](https://github.com/jterrazz/package-typescript/blob/main/docs/02-developing.md)'s, and its `check` enforces it: one folder per tool at the project root, one line in `.gitignore`, one `rm -rf .artifacts` for a clean slate. What this framework writes there is the only part this chapter answers for.

What this framework writes there:

| Path                                             | Written by                   | Lifetime                        |
| ------------------------------------------------ | ---------------------------- | ------------------------------- |
| `.artifacts/vitest/`                             | vite's transform cache       | Reused across runs              |
| `.artifacts/vitest/coverage/`                    | v8, which the preset selects | Rewritten per coverage run      |
| `.artifacts/vitest/sqlite/template-<key>.sqlite` | `sqlite()`'s schema template | Reused until the schema changes |

What it does **not** write there: the fresh temp directory each CLI spec runs in, the per-worker SQLite copies, the profile dirs a browser or a simulator needs. Those are per-RUN scratch, they stay in the OS temp dir, and moving them into the project would only put a `package.json` above a spec that must not see one.

### Framework environment variables

You set exactly one variable, prefixed `TEST_` (rule E1): `TEST_UPDATE=1` turns on update mode, which [15 — Tokens § Update mode](15-tokens.md#update-mode-tokens-are-preserved) owns whole — what it writes, what it preserves, and the discipline it asks of a reviewer. The framework also reads vitest's own `VITEST_POOL_ID` (set by vitest, not you) to isolate each parallel worker's database schema and index.

### Directory layout at a glance

```
specs/
├── api/
│   ├── api.specification.ts
│   └── users/
│       ├── users.spec.ts          # <aspect>.spec.ts inside its domain (rule C1)
│       ├── _seeds/                 # *.sql
│       ├── _requests/              # *.http — complete requests (inputs)
│       ├── contracts/             # <name>.contracts.ts facade + <provider>/<name>.ts units + their data
│       └── _expected/              # all expected fixtures, flat — incl. response *.http (a slash in the name creates a subfolder)
└── cli/
    ├── cli.specification.ts       # runner at the facet root (rule C1)
    └── help/
        └── help.spec.ts           # under specs/, the suffix is .spec.ts (rule C12)
```

## Pitfalls

- **Renaming the destructured runner** (`const { api: usersApi } = …`). The canonical names `api`, `jobs`, `cli`, `website`, `mobile` are enforced (rule A3).
- **Forgetting `afterAll(cleanup)`.** Infrastructure leaks across suites; rule A4 requires it in every specification file.
- **Importing from a subpath the `exports` map does not publish** (`@jterrazz/test/services`). Everything a spec needs comes from `@jterrazz/test` (rule F1).
- **Writing `// Given` without `// Then`** (or vice versa). Every test carries both comments (rule B4); `// When` only when the action is not obvious — the chain _is_ the when.

## Related

[10 — API specs](10-api.md) · [12 — CLI specs](12-cli.md) · [14 — Assertions](14-assertions.md) · [18 — Conventions](18-conventions.md) · [08 — Website specs](08-website.md) · [09 — Mobile specs](09-mobile.md)
