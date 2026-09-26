# 02 — Developing

How a change is made. The first half is this repository's own loop — the toolchain, the order its gates demand, which file a change opens and what it owes when it lands. The second half is the walkthrough a consuming project follows, from `npm install` to two passing specs.

## Changing this package

### The loop

The repository answers six `make` targets, the same six every repository of the estate answers:

| Target         | Does                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make install` | Install the dependencies (`npm ci`, again only when the lockfile moves)                                                                                                                   |
| `make build`   | Build the bundle — before `lint` and before the `unit` project; an unchanged tree restores it from the build cache instead                                                                |
| `make lint`    | Typecheck, lint, format check, knip, then the conventions checker and the self checker (the source tree's structure locks)                                                                |
| `make fix`     | Build, then the two fixers — the checker's `--fix`, then `npx typescript fix`, whose formatter formats what the checker wrote — each run whatever the other said, and fails if either did |
| `make test`    | Every suite, with coverage, then the coverage floor                                                                                                                                       |
| `make check`   | The whole verdict: build, lint, test                                                                                                                                                      |

Three targets stand beside them, and no flow speaks them. `make test-mobile` runs the mobile specs on a real iOS simulator, which no CI job provisions — [03 — Testing](03-testing.md) says when it is owed. `make test-changed` runs only the tests the uncommitted changes reach (`vitest --changed`): the local loop, never a verdict — like any partial run, it judges no route ratchet ([10 — API](10-api.md)). `make test-merge` reads back the blob reports of a sharded run as one, then judges the coverage floor and the route ratchet on it — [03 — Testing](03-testing.md#what-ci-runs) says how a run is split. Every target installs first. CI calls `build`, `lint` and `test` — [03 — Testing](03-testing.md) § What CI runs. Two gestures sit below the six, for the loop: `npx vitest --run --project unit` runs the fast suite with no infrastructure, and `npm run docs` regenerates the generated tables.

The `sqlite()` specs of the `unit` project need no rebuild after `npm ci`: this repository runs the `better-sqlite3` line whose native binding ships prebuilt — [04 § What a consumer must bring](04-operating.md#what-a-consumer-must-bring) says which line that is, and what an older one costs.

### The build comes first

`oxlint.config.ts` loads this package's OWN plugin from `./dist/oxlint.js`, and the end-to-end lint specs load it too. Node's type-stripping does not resolve a `.js` specifier back to its `.ts` source, so **`npm run build` must precede `npm run lint`** and must precede the `unit` project. A lint run on a stale bundle judges the previous build's rules.

`make build` runs that build through Turborepo, whose cache is keyed by the content of what the bundle is made of: every file git tracks or would track, less `docs/`, `specs/`, `skills/`, the Markdown and the test files. An unchanged tree restores `dist/` from `.artifacts/turbo/` rather than bundling again, so `make fix`, `make check`, `npm run docs` and `npm run coverage` pay the build once per change. All four take one path, `npm run build:cached`, which also turns Turborepo's telemetry off. `turbo.json` states those inputs; Turborepo's per-task log lands in `.turbo/`, which it offers no key to move, and `.gitignore` holds it.

The key reads the lockfile, not the installed toolchain. `@jterrazz/typescript` installed from a sibling checkout (`file:../package-typescript`) is locked by version alone, so a preset change reinstalled at the same version leaves the key unchanged, and `make build` restores a bundle built under the old `compilerOptions`. After such a reinstall, run `npx turbo run build --force` or `rm -rf .artifacts/turbo`. A restore only adds files, so `npm run build:cached` removes `dist/` first: nothing left there by another branch survives into the bundle or a local `npm pack`.

That config is also where this repository DECLARES its own architecture: `i1-layer-boundaries` ships inert, and `FRAMEWORK_LAYERS` in `lint/self/checks/layers.ts`, which that config wires, is the enforced statement of the trees [01 — Architecture](01-architecture.md) describes.

### Which file a change opens

| Changing…                                         | Opens                                                                                                                                                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A facet's chain, setups or terminal actions       | `src/facets/<facet>/<facet>.facet.ts` and the `*.capability.ts` or `*.action.ts` it composes — in the facet's concept folders, or in `src/world/` and `src/kernel/context/` for a setup every facet shares                                          |
| What a result exposes                             | `src/expectations/` for an accessor, or the `*.result.ts` in the facet's concept folder — accessors stay READ-ONLY                                                                                                                                  |
| A matcher, or update-mode behaviour               | `src/expectations/goldens/` and `src/expectations/in-place/` — `src/vitest/` only for the hook that wires them                                                                                                                                      |
| An external dependency's adapter                  | the ONE slice that owns the engine — a world area (`src/world/services/<db>/`, `src/world/stubs/network/` …) or a facet's concept folder (`src/facets/website/browser/` …), and no other                                                            |
| A `{{token}}` or the structural comparison        | `src/expectations/tokens/`                                                                                                                                                                                                                          |
| A descriptor, a landmark, or how one is spelled   | `src/elements/` — `elements.ts` (the constructors), `descriptor.ts` (the types), `vocabulary-rows.ts` (a visitor verb's rows), `spelling.ts`, `landmarks.ts`, `ambiguity.ts` (the W3 refusal)                                                       |
| A runner-config default, or a project helper      | `src/vitest/preset.ts` and `src/vitest/project-kit.ts` — or the facet's own `<facet>.project.ts` for its project                                                                                                                                    |
| The `<case>.spec.yaml` grammar                    | `src/facets/cli/documents/spec-document.ts` — read by BOTH the runner and the checker                                                                                                                                                               |
| How a cli document runs                           | `src/facets/cli/documents/literate.ts`                                                                                                                                                                                                              |
| A mechanized rule                                 | `lint/catalogue/manifest.ts` (`lint/self/catalogue/manifest.ts` for a self rule), its audience stated, **and** its implementation under `lint/rules/<family>/` — wired in `lint/rules/plugin.ts`, or in `lint/self/rules/plugin.ts` for a self rule |
| A principle, or a criterion no machine can settle | [18 — Conventions](18-conventions.md), the constitution                                                                                                                                                                                             |

### What a change owes

Four things land in the SAME commit as the change that makes them true.

- **The guard.** Every defect class discovered — in review, from a bug, during a migration — grows the thing that stops it recurring: a static rule, a meta-test, or a runtime refusal. It is what keeps the other channels growing instead of decaying. When no channel is possible, the change says so explicitly.
- **The regenerated tables.** `npm run docs` rewrites every `GENERATED` block at once — in [03 — Testing](03-testing.md) the layered reading (`layers`), the siblingless table (`siblings`), the capability matrix (`matrix`), the meta-test channel (`meta-tests`) and the package's own rules (`self-rules`); the rule catalogue in [19 — Linting](19-linting.md) (`catalog`); the fork in [18 — Conventions](18-conventions.md) (`fork`) — and `schema/spec.schema.json`. Never edit one by hand: the freshness meta-tests fail on a hand edit.
- **The chapter the behaviour falsified.** A page that still describes the old behaviour is a defect that ships. The corpus is mapped by [`docs/README.md`](README.md).
- **The skill, when the public surface moved.** `skills/jterrazz-test/SKILL.md` is hand-written and short — which kind, the pitfalls, the chapter to read next — and a meta-test fails when it names a symbol the entries do not export or a chapter that is not on disk; `README.md` is the vitrine and moves with a public API change too.

## Using the framework

The rest of this chapter takes a consuming project from `npm install` to two passing specs: one HTTP API spec backed by a real Postgres container, and one CLI spec running a binary in a fresh temp directory. It also explains the one framework environment variable (`TEST_UPDATE`).

### Install

```bash
npm install -D @jterrazz/test @jterrazz/typescript vitest
```

Those two are the required peers; every other peer is optional, loaded the first time a spec needs it. Which one each facet and service needs, and when Docker must be running, is [04 — Operating § What a consumer must bring](04-operating.md#what-a-consumer-must-bring).

`msw` (outgoing HTTP interception for `.intercept()`) ships as a direct dependency — no separate install. API specs pass your web app to `server`; the adapter only needs an object with a `request()` method, so bring your own web framework (e.g. `hono`) in your project.

Trying an unreleased branch of the framework: install a `npm pack` tarball, never a `file:` link — a link makes the consumer resolve `vitest`'s types twice, and the matcher augmentation then lands on one copy and not the other, so `toMatch(file(…))` types on one subject and not on another.

Everything a spec needs imports from the single package root; the tool subpaths beside it are the ones the `exports` map publishes, and they are listed once — [01 § What the tree publishes](01-architecture.md#what-the-tree-publishes). F1 reads that map, so a specifier it does not publish is refused:

```typescript
// the runners, the services, and what a chain stands on
import { postgres, process, redis, specification, sqlite } from '@jterrazz/test';
```

```typescript
// what a test says: stubs, dynamic values, doubles, time, assertions
import { anthropic, clock, defineStub, http, intercept } from '@jterrazz/test';
import { match, mockOf, openai, required, waitUntil } from '@jterrazz/test';
```

### The shape of every test

A **specification file** (`*.specification.ts`, under `specs/`) creates a runner once per suite. A **test file** imports the runner and writes specs. Every spec is one chain: zero or more setups, then exactly one terminal action, resolving to a typed result you assert on with `expect()`.

```
specification.api(…)         → { api, cleanup, docker }
specification.job(…)         → { job, cleanup }            // no docker — jobs never spawn containers
specification.cli(…)         → { cli, cleanup, docker }
specification.integration(…) → { integration, cleanup }    // a module, against real services or a golden
specification.website(…)     → { website, cleanup, url }   // no docker — a browser, not a container
specification.mobile(…)      → { mobile, cleanup, udid }   // no docker — a simulator, not a container
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
### specs/api/users/create/requests/create-user.http — the COMPLETE request
POST /users
Content-Type: application/json

{ "name": "Alice" }
```

```http
### specs/api/users/create/expected/user-created.http — status + header subset + body
HTTP/1.1 201 Created
Content-Type: application/json

{ "id": "{{uuid}}", "name": "Alice" }
```

```typescript
// specs/api/users/create/shape.spec.ts — POST /users, the whole response of the ordinary case
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';
import { api } from '../../api.specification.js';

describe('shape', () => {
    test('creates a user', async () => {
        // Given - empty database
        const result = await api.request(file('./requests/create-user.http'));

        // Then - response matches the fixture; row landed in the database
        expect(result.response).toMatch(file('./expected/user-created.http'));
        await expect(result.table('users')).toMatch([[1, 'Alice']]);
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
// specs/cli/help/usage.spec.ts — the `help` command, its usage banner
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';
import { cli } from '../cli.specification.js';

describe('usage', () => {
    test('shows help', async () => {
        // Given
        const result = await cli.exec('help');

        // Then - full snapshot of stdout against expected/help.txt
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/help.txt'));
    });
});
```

```
### specs/cli/help/expected/help.txt — tokens work in text snapshots too
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

`component()` takes more that are the APP's — `vite`, `wrap`, `viewport`, `clock`, `timezone`/`locale`, and the `root` its relative paths are read against — and [07 — Component specs](07-component.md) owns them; `unit()` takes `roots`, and `isolate`.

`unit({ isolate: false })` runs every file of a worker in one module graph instead of a fresh one per file, so a worker imports each module once. It is for a PURE project: a test that leaves state in a module — a registry, a globally registered matcher, a cache — reaches the next file of its worker, and fails there. Absent, vitest isolates each file. This package's own `unit` project is not pure — its matcher and update-mode modules keep state across a file — so it stays isolated.

`unit()` and `component()` are a pair by construction: `unit()` collects `**/*.test.ts` outside `specs/` and excludes `**/*.test.tsx`, `component()` collects exactly those, so the suffix beside a file decides which project runs it and which rules judge it. `unit()` takes `roots?` where the modules are not at the repository root, or `include?` for the globs outright; the facet helpers collect `specs/<facet>/**/*.spec.ts` — the word for the assembled product (C12) — and `cli()` its documents too, `specs/cli/**/*.spec.yaml` ([20](20-documents.md#the-three-doors-one-engine)). All three carry `sequence.groupOrder` — node 0, `website` 1, `component` 2 — so the two browser projects never open two Chromiums at once on a 2-vCPU runner. What `component()` sets — the provider pinned to the runner's exact version, the msw worker served from this package's own install, the JSX transform the current Vite uses, the dependencies a cold cache must pre-bundle, the artefact directories, the group order that keeps two Chromiums apart — is [07 — Component specs](07-component.md)'s. `component()` is async, and a project may be a promise: `projects: [component({ … })]` needs no `await`.

#### What the preset sets

| Setting                          | Value                                                          | Why                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cacheDir`                       | `.artifacts/vitest`                                            | The artefact convention below — vite's transform cache leaves `node_modules/`                                                                                                                                                                                                                          |
| `test.coverage.reportsDirectory` | [the artefact path](#artefacts-live-under-artifacts)           | Where a tool writes what it generates is the toolchain's convention ([`@jterrazz/typescript` — Developing](https://github.com/jterrazz/package-typescript/blob/main/docs/02-developing.md)); the preset sets it so no consumer writes it. The **provider is yours to install** (`@vitest/coverage-v8`) |
| `test.testTimeout`               | `30_000`                                                       | Vitest's 5s never survived a container boot, a `prisma db push` or a `next build`                                                                                                                                                                                                                      |
| `test.hookTimeout`               | `30_000`                                                       | Same reason, for the `beforeAll` that starts the infrastructure                                                                                                                                                                                                                                        |
| `test.exclude`                   | vitest's defaults + `**/{expected,fixtures,requests,seeds}/**` | What a spec stands on is an input, never a suite — a repository must not run its own counter-examples                                                                                                                                                                                                  |
| `test.attachmentsDir`            | `.artifacts/vitest/attachments`                                | Vitest 5 writes `context.annotate()` attachments to `.vitest/` at the repository root                                                                                                                                                                                                                  |
| `test.outputFile`                | `.artifacts/vitest/{json,junit,html,blob}`                     | Vitest 5 turned the json and junit reporters into FILE writers; all four are artefacts. The blob is one file per run under `blob/`, named for its shard when the run is one, so `--merge-reports .artifacts/vitest/blob` reads a split run back whole                                                  |
| `test.retry`                     | `0`                                                            | A flaky test is fixed or deleted — a retry turns a real defect into a slow one and hides it                                                                                                                                                                                                            |
| `test.restoreMocks`              | `true`                                                         | A `vi.spyOn` a test forgets to restore fails a LATER file, one that did nothing wrong                                                                                                                                                                                                                  |
| `test.unstubGlobals`             | `true`                                                         | Same for `vi.stubGlobal` — and it is what lets a test be written without an `afterEach` (rule J6w)                                                                                                                                                                                                     |
| `test.unstubEnvs`                | `true`                                                         | Same for `vi.stubEnv`, which is the sanctioned way to state a module's env contract (rule E9w)                                                                                                                                                                                                         |
| `test.globalSetup`               | the update-mode setup, the temp-root setup                     | Update mode writes a value in place after the run is reported, so a failure's code frame reads the lines the run loaded ([15](15-tokens.md#a-value-written-in-place-is-rewritten-in-the-test)); the temp root is [below](#scratch-lives-in-the-runs-temp-root)                                         |
| `plugins`                        | `literate()`, when `literate:` is given                        | Turns every matching `<case>.spec.yaml` into a test file (see [20 — Spec documents](20-documents.md))                                                                                                                                                                                                  |

It deliberately sets **nothing else**. `fileParallelism` is a per-project truth (a container-lifecycle suite is serial, an isolated one is not), stated by the project rather than by the preset — a helper states it for you when you pass `serial`, and a hand-written project states it itself; so do `reporters`, `environment`, `env`, every other `globalSetup` — the preset's own is ADDED to a project's, vite concatenating the lists — and every `include`: a preset that guessed those would be wrong more often than right.

**Why the artefact paths are the preset's.** Every one of them is a path the TOOL pins and a consumer never writes: a repository does not choose where `context.annotate()` lands, it discovers it one CI run later, as an untracked `.vitest/` beside `.artifacts/`. Moving them here is the same rule the estate applies to every tool — what a tool generates lives at `.artifacts/<tool>/` — applied once instead of in fourteen configs.

Three behaviours worth knowing:

- **Projects inherit the defaults too.** Vitest resolves each project as its own config and it inherits nothing from the root, so the preset merges the budgets, the exclusions and the cache dir into every inline project. A project declared as a glob string, a promise or a function is handed back untouched.
- **Each glob is stated once.** A project's `exclude` REPLACES vitest's own defaults, so every project carries the preset's list in full; the root's list, which vitest concatenates into each project on top of that, then holds only what YOU stated there. The no-tests banner is the one place a consumer ever reads that list, and it read as three merges of the same three globs.
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
-                    exclude: [...configDefaults.exclude, '**/fixtures/**', 'specs/api/heavy/**'],
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

| Path                                             | Written by                                               | Lifetime                        |
| ------------------------------------------------ | -------------------------------------------------------- | ------------------------------- |
| `.artifacts/vitest/`                             | vite's transform cache                                   | Reused across runs              |
| `.artifacts/vitest/coverage/`                    | v8, which the preset selects                             | Rewritten per coverage run      |
| `.artifacts/vitest/sqlite/template-<key>.sqlite` | `sqlite()`'s schema template                             | Reused until the schema changes |
| `.artifacts/vitest/evidence/`                    | a website or mobile scenario that failed, its screenshot | Kept until you remove it        |

What it does **not** write there: the fresh temp directory each CLI spec runs in, the per-worker SQLite copies, the profile dirs a browser or a simulator needs. Those are per-RUN scratch, in the run's temp root, and moving them into the project would only put a `package.json` above a spec that must not see one.

### Scratch lives in the run's temp root

A run keeps every scratch folder it makes in ONE folder of its own, and removes that folder when it ends. The preset's temp-root setup creates `jterrazz-test-runs-<uid>/<pid>-…` in the OS temp directory before the first worker starts, and points `TMPDIR` (with `TMP` and `TEMP`) at it. So every `mkdtemp` under `os.tmpdir()` lands inside it: in a worker, in a child a spec spawns, in a tool that child runs. The teardown of the project whose setup made it (the first project, which vitest tears down last) removes it and restores the variables.

A run that dies before its teardown leaves its root behind, named by its pid. The next run removes every root in `jterrazz-test-runs-<uid>/` whose pid no longer runs. It reads that folder alone, never the OS temp directory itself, which can hold hundreds of thousands of entries. The folder is named for the user, so on a temp directory several users share, such as Linux's `/tmp` with `TMPDIR` unset, a user never meets a folder another user made and cannot write or sweep.

A CLI spec's working directory does not wait for the run to end: it is removed once its test has finished, after the test's `afterEach` hooks. Under `test.concurrent` it does wait. Vitest attaches a test hook to whichever test is current, and among concurrent tests that may be a sibling that ends first, so a concurrent test's scratch is left to the run's root.

### Framework environment variables

You set exactly one variable, prefixed `TEST_`: `TEST_UPDATE=1` turns on update mode, which [15 — Tokens § Update mode](15-tokens.md#update-mode-tokens-are-preserved) owns whole — what it writes, what it preserves, and the discipline it asks of a reviewer. The framework also reads vitest's own `VITEST_POOL_ID` (set by vitest, not you) to isolate each parallel worker's database schema and index.

### Directory layout at a glance

```
specs/
├── api/
│   ├── api.specification.ts
│   └── users/create/              # POST /users — the subject's standard folder (rules C29, C30)
│       ├── shape.spec.ts          # <aspect>.spec.ts, one describe('shape') (rules C31, C32)
│       ├── seeds/                 # *.sql
│       ├── requests/              # what it sends: *.http complete requests, and body files (*.json, …)
│       ├── stubs/             # <name>.stubs.ts facade + <kind>/<name>.ts units + their data
│       └── expected/              # every golden it reads — incl. response *.http, each named by file(…)
└── cli/
    ├── cli.specification.ts       # runner at the facet root (rule C1)
    └── help/                      # the `help` command
        └── usage.spec.ts          # under specs/, the suffix is .spec.ts (rule C12)
```

## Pitfalls

- **Renaming the destructured runner** (`const { api: usersApi } = …`). The canonical names `api`, `job`, `cli`, `integration`, `website`, `mobile` are enforced (rule A3).
- **Forgetting `afterAll(cleanup)`.** Infrastructure leaks across suites; rule A4 requires it in every specification file.
- **Importing from a subpath the `exports` map does not publish** (`@jterrazz/test/services`). Everything a spec needs comes from `@jterrazz/test` (rule F1).
- **Writing `// Given` without `// Then`** (or vice versa). Every test carries both comments (rule B4); `// When` only when the action is not obvious — the chain _is_ the when.

## Related

[10 — API specs](10-api.md) · [12 — CLI specs](12-cli.md) · [14 — Assertions](14-assertions.md) · [18 — Conventions](18-conventions.md) · [08 — Website specs](08-website.md) · [09 — Mobile specs](09-mobile.md)
