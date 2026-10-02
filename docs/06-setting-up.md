# 06 — Setting up a project

What a project installs, how its `vitest.config.ts` is written, how it turns the conventions on, and where a run writes. [05 — Getting started](05-getting-started.md) walks through the minimum; this chapter is the reference behind it.

## What to install

```bash
npm install -D @jterrazz/test @jterrazz/typescript vitest
```

**`vitest ^5` and `@jterrazz/typescript ^11` are the only required peers.** The framework registers its matchers into vitest and has no runner of its own. Its published types extend the toolchain's `JterrazzConfig` (`@jterrazz/typescript/config`), so a project that typechecks them needs the toolchain beside it.

**Everything else is an optional peer**, loaded the first time a test needs it. A project that tests no page, no component and no database installs none of them.

| Needed by                   | Install                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A website visit             | `playwright`, then `npx playwright install chromium` once                                                                                       |
| A component                 | `@vitest/browser-playwright` (the exact version of `vitest`), `vitest-browser-react`, `vite`, `react`, `react-dom`, `playwright` and a chromium |
| A mobile screen             | `appium`, `webdriverio`, then `npx appium driver install xcuitest`                                                                              |
| `postgres()`, `redis()`     | `testcontainers`, plus `pg` or `redis` for the driver a table read uses — and a running Docker                                                  |
| `sqlite()`                  | `better-sqlite3` — no Docker                                                                                                                    |
| A lint spec, `ruleTester()` | `oxlint`                                                                                                                                        |
| Coverage                    | `@vitest/coverage-v8`                                                                                                                           |

`msw`, which delivers stubbed network replies, is a direct dependency: nothing to install. An API spec hands your app to `server`; the adapter needs only an object with a `request()` method, so bring whichever web framework you use. Node 24 or newer is required, as `engines` states.

**A missing peer is named when it is needed.** A facet's refusal names the packages it lacks and the `npm install -D` that brings them. A service's refusal names the service that asked, the peer, and the install command of the package manager your lockfile names; under pnpm a native binding must also be listed to be built, and the message adds that line:

```text
found: sqlite() requires `better-sqlite3`, and it is not installed
why: Every seam is an optional peer of @jterrazz/test, installed by the project that specifies through it.
fix: pnpm add -D better-sqlite3; under pnpm the binding is not built unless the package is listed: add "better-sqlite3" to `onlyBuiltDependencies` in package.json (or `only-built-dependencies` in .npmrc) and reinstall
read: docs/24-linting.md#seam-is-an-optional-peer
```

**A native peer can be installed and still not built.** npm since 11, pnpm since 10 and bun since 1.2 withhold a dependency's install script by default, so a native package arrives without its compiled `.node`. `better-sqlite3` 13 ships its binding prebuilt and loads anyway; with 12, `sqlite()` notices on first load and says how to build it:

```text
found: sqlite() found `better-sqlite3`, and its native binding is not built
why: A native peer is built by its install script, and npm runs a dependency's install script only once it is told to.
fix: npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3
read: docs/06-setting-up.md#what-to-install
```

Three more constraints come from the peers themselves:

- **The browser provider moves with vitest.** `@vitest/browser-playwright@X` requires `vitest` at exactly `X`, so the two are upgraded together: `npm install -D vitest@5.0.1 @vitest/browser-playwright@5.0.1`. `component()` checks the two versions match and names both when they do not.
- **Vite `^6.4 || ^7 || ^8`** for a component. `component()` reads the installed major and states the JSX transform on the key that version reads.
- **The ARIA dialect of a `.aria.yaml` golden is Playwright's.** A Playwright major can reword a role line, and every committed tree golden then moves with it in one `TEST_UPDATE=1` run.

Why vitest 5 alone, and why the native seams became optional peers: [ADR-008](decisions/008-vitest-5-node-24-and-the-native-seams-as-optional-peers.md).

To try an unreleased build of the framework, install the tarball `npm pack` writes, never a `file:` link: a link makes the project resolve vitest's types twice, and the matchers then type on one copy and not the other.

## The vitest config

`vitest.config.ts` starts from `defineSpecConfig()` and lists one project per kind of test the repository has:

```typescript
// vitest.config.ts
import { api, component, defineSpecConfig, unit, website } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            unit(), // `**/*.test.ts` outside specs/ — modules, no browser
            component({ vite: './vite.config.ts', wrap: './src/providers.tsx' }),
            website(), // `specs/website/**`
            api(), // `specs/api/**/*.spec.ts`
        ],
    },
});
```

What you pass is an ordinary vite/vitest config, merged over the defaults below: a scalar you state wins, an array you state is added to the default one.

### The project helpers

There is one helper per kind: `unit()`, `integration()`, `component()`, `website()`, `mobile()`, `api()`, `job()`, `cli()` and `lint()`, all from `@jterrazz/test/vitest`. Each collects its folder — `specs/<kind>/**/*.spec.ts`, plus the `<case>.spec.yaml` documents for `cli()` — and carries what its kind needs: a container server for `api()`, `job()` and `integration()`, a browser for `component()`, a simulator session for `mobile()`. Every helper accepts:

| Option                | Does                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `include` / `exclude` | Replace the default globs. A default `exclude` guards the default `include`, so state both or neither           |
| `timeout`             | Raise or lower the 30 s default for this project alone                                                          |
| `serial`              | Run the project's files one at a time (`fileParallelism: false`), when they share one server, one file, one app |

`unit()` and `component()` are a pair: `unit()` collects `**/*.test.ts` outside `specs/` and leaves out `**/*.test.tsx`, which `component()` collects. So the suffix beside a file decides which project runs it. `unit()` also takes `roots` when the modules are not at the repository root, and `isolate: false` to run a worker's files in one module graph — only for a project whose tests leave no state behind in a module. `component()` takes the options of the app it renders (`vite`, `wrap`, `viewport`, `clock`, `timezone`, `locale`, `root`), described in [09 — Component specs](09-component.md#the-constructor-there-is-none); `mobile()` takes the simulator the run shares ([11 — Mobile specs](11-mobile.md#one-session-per-run)).

Projects run in groups — the node kinds first, then `website`, then `component`, then `mobile` — so two browser projects never open two Chromiums at once and a simulator runs alone. `component()` returns a promise; vitest accepts it in `projects` as it is.

An env-gated sub-suite is an `exclude`, not a second project:

```typescript
integration({ exclude: process.env.E2E_NETWORK ? [] : ['specs/integration/network/**'] });
```

### What the preset sets

| Setting                                                                                | Value                                                              | Why                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `test.testTimeout`, `hookTimeout`                                                      | `30_000`                                                           | vitest's 5 s never survived a container boot or a build                                                           |
| `test.retry`                                                                           | `0`                                                                | A flaky test is fixed or deleted; a retry hides it                                                                |
| `test.restoreMocks`, `unstubGlobals`, `unstubEnvs`                                     | `true`                                                             | A spy, a stubbed global or a stubbed env a test forgets to restore would fail a later file that did nothing wrong |
| `test.exclude`                                                                         | vitest's defaults + `**/{_expected,_fixtures,_requests,_seeds}/**` | What a test stands on is input, never a suite to run                                                              |
| `cacheDir`, `test.coverage.reportsDirectory`, `test.attachmentsDir`, `test.outputFile` | under `.artifacts/vitest/`                                         | Everything a tool writes lives at `.artifacts/<tool>/` ([below](#where-a-run-writes))                             |
| `test.globalSetup`                                                                     | update mode, the run's temp root                                   | Update mode writes after the run is reported; the temp root is [below](#where-a-run-writes)                       |
| `plugins`                                                                              | `literate()`, when `literate:` is given                            | Turns each `<case>.spec.yaml` into a test file ([15 — Spec documents](15-documents.md))                           |

It sets nothing else on purpose. `fileParallelism`, `reporters`, `environment`, `env` and every `include` are true of one project and not of another, so a project states them — a helper does it for you. The coverage provider is yours to install.

The defaults reach every inline project too, since vitest resolves each project as its own config. A project given as a glob string, a promise or a function is handed back untouched.

With several projects, `literate()` goes in the one project that collects the documents, not in the top-level `literate:` key, because its glob must join that project's `include`:

```typescript
import { defineSpecConfig, literate } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            {
                plugins: [literate({ specification: './specs/cli/cli.specification.ts' })],
                test: { include: ['specs/cli/**/*.spec.ts'], name: 'cli' },
            },
        ],
    },
});
```

To adopt the preset in a config written by hand, swap `defineConfig` for `defineSpecConfig`, delete what the table above already says (the 30 s timeouts, `...configDefaults.exclude`, the ground exclusions), and keep what is yours. A timeout lower or higher than 30 s stays stated: the preset is a starting point, not a ceiling. Then add `.artifacts/` to `.gitignore`.

## Turning the conventions on

The conventions are a preset of the toolchain. A project lists `test()` in `jterrazz.config.ts`, after the base preset that names its profile, and its `oxlint.config.ts` composes what the presets carry:

```typescript
// jterrazz.config.ts
import { test } from '@jterrazz/test/config';
import { defineConfig, typescript } from '@jterrazz/typescript/config';

export default defineConfig({ presets: [typescript({ profile: 'node' }), test()] });
```

```typescript
// oxlint.config.ts
import { defineConfig, fromPresets } from '@jterrazz/typescript/oxlint';

import settings from './jterrazz.config.ts';

export default defineConfig(fromPresets(settings));
```

`npx typescript check` then runs all of it: the oxlint plugin, the import and naming rules, and the conventions checker over `specs/`. Nothing is detected from your dependencies — a project that does not list `test()` runs none of these rules. What the preset carries, how to deviate from a rule, and the full catalogue are [24 — Linting](24-linting.md).

## Where a run writes

**In the project, only under `.artifacts/`**, one folder per tool, one line in `.gitignore`, one `rm -rf .artifacts` for a clean slate:

| Path                                             | Written by                                                 | Lifetime                        |
| ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------- |
| `.artifacts/vitest/`                             | vite's transform cache, vitest's reports                   | Reused across runs              |
| `.artifacts/vitest/coverage/`                    | the coverage provider                                      | Rewritten per coverage run      |
| `.artifacts/vitest/sqlite/template-<key>.sqlite` | `sqlite()`'s schema template                               | Reused until the schema changes |
| `.artifacts/vitest/evidence/`                    | the screenshot of a website or mobile scenario that failed | Kept until you remove it        |

**Everything else is scratch, in one temp folder per run.** Before the first worker starts, the preset creates `jterrazz-test-runs-<uid>/<pid>-…` in the OS temp directory and points `TMPDIR`, `TMP` and `TEMP` at it, so every temp folder a worker, a spawned child or a tool it runs makes lands inside. That holds each CLI spec's working directory, the per-worker database copies and a browser's profile. The run removes the folder when it ends, and the next run removes the folder of any run that died first. A CLI spec's working directory goes sooner, once its test has finished — except under `test.concurrent`, where it waits for the run.

**One environment variable is yours to set**: `TEST_UPDATE=1`, which turns on update mode ([22 — Tokens § Update mode](22-tokens.md#update-mode-tokens-are-preserved)). The framework also reads `VITEST_POOL_ID`, which vitest sets, to isolate each worker's databases.

## Two rough edges of the toolchain's flow

- **An `include` that names `.test.ts`** stops collecting the moment `--fix` renames a spec. The fix lists every glob or literal it broke, so update them in the same commit; `include-points-at-a-folder` holds the class afterwards.
- **`typescript baseline` in an npm-hoisted workspace member** cannot resolve oxlint today; run it from a directory where `node_modules/.bin/oxlint` resolves. `@jterrazz/typescript`'s own `TODO.md` carries the ask.

## Pitfalls

- **Forgetting `afterAll(cleanup)` in a specification file.** The services leak into the next suite (rule `cleanup-passed-to-after-all`).
- **Importing from a subpath the package does not publish** (`@jterrazz/test/services`). Every name a test uses comes from `@jterrazz/test`; the tool entries are `/vitest`, `/config`, `/oxlint` and `/schema` (rule `no-unpublished-subpath`).
- **Writing `browser:` in a config by hand.** `component()` pins the provider to the runner's version, serves the service worker and pre-bundles cold dependencies; rule `browser-project-from-component` refuses the hand-written form.
- **A CommonJS `oxlint.config`.** oxlint loads the plugin as ESM only; from a CommonJS config it prints a warning, registers nothing and exits 0. Use `oxlint.config.ts` or `.mjs` — [24 — Linting § Pitfalls](24-linting.md#pitfalls).

## Related

[05 — Getting started](05-getting-started.md) · [09 — Component specs](09-component.md) · [24 — Linting](24-linting.md) · [04 — Operating](04-operating.md)
