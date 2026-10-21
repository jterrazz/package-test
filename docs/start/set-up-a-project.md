# Set up a project

What a project installs, how its `vitest.config.ts` is written, how it turns the conventions on, and where a run writes. [Getting started](getting-started.md) walks through the minimum; this page is the reference behind it.

## What to install

```bash
npm install -D @jterrazz/test @jterrazz/typescript vitest
```

**`vitest ^5` and `@jterrazz/typescript ^11` are the only required peers.** The framework registers its matchers into vitest and has no runner of its own. The toolchain, [`@jterrazz/typescript`](https://github.com/jterrazz/package-typescript), is required because the framework prints its refusals through the toolchain's rules kit and its published types extend the toolchain's `JterrazzConfig` (`@jterrazz/typescript/config`). Its lint conventions are a separate, opt-in step ([below](#turning-the-conventions-on)).

### Project requirements

- **ESM.** The package ships ES modules only, and every specification file awaits its constructor at the top level (`export const { api, cleanup } = await specification.api(...)`). Set `"type": "module"` in `package.json`, or name the config files `.mts` (`vitest.config.mts`).
- **Node 24 or newer**, as `engines` states.
- **A tsconfig that knows `using` and top-level await.** Tests pin time with `using _ = clock.at(...)` and dispose with `await using` ([Time and doubles](../reference/time-and-doubles.md)), which need `target` and `lib` at `ES2022` or later for top-level await and `ESNext` for `using`, with `module` at `ESNext` or `NodeNext`. The toolchain's tsconfig presets set all of it: `"extends": "@jterrazz/typescript/tsconfig/node"`.

**Everything else is an optional peer**, loaded the first time a test needs it. A project that tests no page, no component and no database installs none of them.

| Needed by                   | Install                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A website visit             | `playwright`, then `npx playwright install chromium` once                                                                                       |
| A component                 | `@vitest/browser-playwright` (the exact version of `vitest`), `vitest-browser-react`, `vite`, `react`, `react-dom`, `playwright` and a chromium |
| A mobile screen             | `appium`, `webdriverio`, then `npx appium driver install xcuitest`                                                                              |
| `postgres()`, `redis()`     | `testcontainers`, plus `pg` or `redis` for the driver a table read uses, and a running Docker                                                   |
| `sqlite()`                  | `better-sqlite3` (no Docker)                                                                                                                    |
| A lint spec, `ruleTester()` | `oxlint`                                                                                                                                        |
| Coverage                    | `@vitest/coverage-v8`                                                                                                                           |

`msw`, which delivers stubbed network replies, is a direct dependency: nothing to install. An API spec hands your app to `server`, which must answer `request(path, init)` with a Fetch `Response` and, for route coverage, expose Hono's route table. A Hono app does both. Any other framework needs a wrapper of your own for the first, and an OpenAPI document named in `test: { routes }` for the second ([API specs § An app that is not Hono](../guides/api-specs.md#an-app-that-is-not-hono)).

**A missing peer is named when it is needed.** A specification's refusal names the packages it lacks and the `npm install -D` that brings them. A service's refusal names the service that asked, the peer, and the install command of the package manager your lockfile names; under pnpm a native binding must also be listed to be built, and the message adds that line:

```text
found: sqlite() requires `better-sqlite3`, and it is not installed
why: Every seam is an optional peer of @jterrazz/test, installed by the project that specifies through it.
fix: pnpm add -D better-sqlite3; under pnpm the binding is not built unless the package is listed: add "better-sqlite3" to `onlyBuiltDependencies` in package.json (or `only-built-dependencies` in .npmrc) and reinstall
read: docs/reference/linting.md#seam-is-an-optional-peer
```

**A native peer can be installed and still not built.** npm since 11, pnpm since 10 and bun since 1.2 withhold a dependency's install script by default, so a native package arrives without its compiled `.node`. `better-sqlite3` 13 ships its binding prebuilt and loads anyway; with 12, `sqlite()` notices on first load and says how to build it:

```text
found: sqlite() found `better-sqlite3`, and its native binding is not built
why: A native peer is built by its install script, and npm runs a dependency's install script only once it is told to.
fix: npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3
read: docs/start/set-up-a-project.md#what-to-install
```

Three more constraints come from the peers themselves:

- **One Playwright for the whole family.** This package's `playwright` peer is the exact version it is gated on, and a project declares that version: two revisions on one machine each need their own Chromium build, and `typescript doctor` names the build a project's Playwright wants and the machine lacks. `npx playwright install chromium`, run in the project, provisions it.
- **The browser provider moves with vitest.** `@vitest/browser-playwright@X` requires `vitest` at exactly `X`, so the two are upgraded together: `npm install -D vitest@5.0.1 @vitest/browser-playwright@5.0.1`. `component()` checks the two versions match and names both when they do not.
- **Vite `^6.4 || ^7 || ^8`** for a component. `component()` reads the installed major and states the JSX transform on the key that version reads.
- **The ARIA dialect of a `.aria.yaml` golden is Playwright's.** A Playwright major can reword a role line, and every committed tree golden then moves with it in one `TEST_UPDATE=1` run.

Why vitest 5 alone, and why the native seams became optional peers: [ADR-008](https://github.com/jterrazz/package-test/blob/main/docs/decisions/008-vitest-5-node-24-and-the-native-seams-as-optional-peers.md).

To try an unreleased build of the framework, install the tarball `npm pack` writes, never a `file:` link: a link makes the project resolve vitest's types twice, and the matchers then type on one copy and not the other. The recipe (the tarball packed into `.artifacts/packages/`, the lockfile entries to drop, bun's cache, the order a wave of projects takes the two packages in) is the toolchain's [Install an unreleased build](https://github.com/jterrazz/package-typescript/blob/main/docs/guides/install-an-unreleased-build.md), since this package is installed with it.

## The vitest config

The projects a repository runs are read off its tree: one per folder `specs/<specification>/` it keeps (`specs/api/`, `specs/cli/`, `specs/website/` and the rest), `unit` over each root holding a module test (`src/`, `lint/`, a folder of `specs/` no specification names, a `unit` one included), and `component` over the component specs and each root holding a rendered test (`*.test.tsx`). A ground, setup or dot folder is never read. `jterrazz.config.ts` states only how a project departs from the one its tree derives (a helper's options, its own global setups), keyed by its specification, with the reason. The package's standard, `src/standard/standard.ts`, states the one departure every repository shares: the `unit` project runs a worker's files in one module graph (`isolate: false`), since a module test leaves no state behind in a module; a repository whose module tests do states `isolate: true` with its reason. The standard only shapes a project the tree derives or the file declares; it makes none exist. `typescript doctor` prints the projects derived from the tree beside what each file states. The file also declares the project's `kind` and `platform`, which `@jterrazz/typescript` reads to derive the rest of the toolchain ([its Configuration § Kind and platform](https://github.com/jterrazz/package-typescript/blob/main/docs/reference/configuration.md#kind-and-platform)):

```typescript
// jterrazz.config.ts
import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'website',
    platform: 'react',
    presets: [test()],
    test: {
        projects: {
            component: {
                reason: 'the app renders through its own Vite pipeline, inside its providers',
                vite: './vite.config.ts',
                wrap: './src/providers.tsx',
            },
        },
    },
});
```

A project keyed by a specification the package does not ship, a declared one with no `reason`, and `projects` written as a list are refused in four parts, reading this section.

`vitest.config.ts` is the file those projects derive, which `typescript fix` writes and `typescript check` holds ([`@jterrazz/typescript`'s Config pass](https://github.com/jterrazz/package-typescript/blob/main/docs/reference/quality-checks.md#the-config-one-file-pass)):

```typescript
import { vitestConfig } from '@jterrazz/test/vitest';

export default await vitestConfig(import.meta.url);
```

It reads the `jterrazz.config.ts` beside the module whose `import.meta.url` it is handed (the config file's own folder, wherever vitest, the Vitest extension or knip loads it) and builds each project the tree names, or the file declares, with its helper over the preset below. A project states no `name`, `environment` or `browser`: its helper names it for its specification and sets what the specification needs. A relative `setup` (global setups the project runs, read from the project root), `root` and `vite.resolve.alias` target are read from the project root; `wrap` stays the component's root's. A tree with no test and a file declaring no project leave the config the preset alone. It is the one-liner `@jterrazz/typescript` derives for every editor file (the entry handed the module's own `import.meta.url`, awaited at the top), which vitest and knip's loader both read whole.

### The project helpers

There is one helper per kind (`unit`, `integration`, `component`, `website`, `mobile`, `api`, `job`, `cli` and `lint`), named by the key of a project, and exported from `@jterrazz/test/vitest` beside `vitestConfig`, for a config written by a tool of your own; called directly, `component()` takes its `root` as an absolute path, since only `vitestConfig` knows where the project sits. Each collects its folder (`specs/<kind>/**/*.spec.ts`, plus the `<case>.spec.yaml` documents for `cli()`) and carries what its kind needs: a browser for `component()`, a simulator session for `mobile()`, and for `api()`, `job()` and `integration()` a global setup that starts each service container once and shares it across every file and project of the run ([Services § One container per run](../reference/services.md#one-container-per-run)). Docker is needed only by a spec that declares `postgres()` or `redis()`: with no Docker running, each such file fails with one sentence naming Docker, and every other file runs. Every helper accepts:

| Option                | Does                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `include` / `exclude` | Replace the default globs. A default `exclude` guards the default `include`, so state both or neither                                                          |
| `timeout`             | Raise or lower the 30 s default for this project alone: each test's and each hook's, so the `afterAll` that stops what a slow test started has the same budget |
| `serial`              | Run the project's files one at a time (`fileParallelism: false`), when they share one server, one file, one app                                                |

`unit()` and `component()` are a pair: `unit()` collects `**/*.test.ts` outside `specs/` and leaves out `**/*.test.tsx`, which `component()` collects. So the suffix beside a file decides which project runs it. `unit()` also takes `roots` when the modules are not at the repository root, and `isolate: false` to run a worker's files in one module graph, only for a project whose tests leave no state behind in a module, and the default `vitestConfig` hands it. `component()` takes the options of the app it renders (`vite`, `wrap`, `viewport`, `clock`, `timezone`, `locale`, `root`), described in [Component specs](../guides/component-specs.md#the-constructor-there-is-none); `mobile()` takes the simulator the run shares ([Mobile specs](../guides/mobile-specs.md#one-session-per-run)).

Every project runs in one group, on the workers the preset sizes ([below](#what-the-preset-sets)): a `website` file takes a worker as a node file does, and the `component` pages run beside them in their one Chromium, as many at once as the run has workers. A project whose files run one at a time (`serial`, and `mobile()` unless it states `serial: false`) runs after that group, in a group of its own, so a simulator never shares its machine.

`api()`, `job()`, `integration()`, `cli()` and `website()` also take `runner`, the module (or the list of modules) their spec files import their runner from, such as `'./specs/api/api.specification.ts'`. The tree derives it from the folder: every specification module directly in it (`specs/website/*.specification.ts`), each after the sibling modules it imports, so a module reading another's address reads this file's. With it, the files of a worker share one module graph (`isolate: false`) and every one of those modules runs again before each file (`setupFiles`), booting its subject whichever module the file imports: the worker, the framework and the modules the specs import load once per worker instead of once per file, and every file still boots its own subject (an app on its own services, a binary, a served site) and cleans it up. A spec file imports its runner from the specification itself, since a module of the shared graph that imports it keeps the first file's runner. A `cli()` project shares its worker only when its documents bind one of its runners: a document imports the module its `literate` door names, which the shared graph would not run again.

An env-gated sub-suite is an `exclude`, not a second project:

```typescript
const integration = {
    exclude: process.env.E2E_NETWORK ? [] : ['specs/integration/network/**'],
    reason: 'the network specs reach the internet, which a run turns on with E2E_NETWORK',
};
```

### What the preset sets

| Setting                                                                                | Value                                                                                            | Why                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test.testTimeout`, `hookTimeout`                                                      | `30_000`                                                                                         | vitest's 5 s never survived a container boot or a build                                                                                                                                                                                                                                                              |
| `test.retry`                                                                           | `0`                                                                                              | A flaky test is fixed or deleted; a retry hides it                                                                                                                                                                                                                                                                   |
| `test.restoreMocks`, `unstubGlobals`, `unstubEnvs`                                     | `true`                                                                                           | A spy, a stubbed global or a stubbed env a test forgets to restore would fail a later file that did nothing wrong                                                                                                                                                                                                    |
| `test.exclude`                                                                         | vitest's defaults + `.artifacts/**` + `**/{__expected__,__fixtures__,__requests__,__seeds__}/**` | What a test stands on is input, never a suite to run; `.artifacts/` holds copies of the project, a mutation sandbox among them                                                                                                                                                                                       |
| `cacheDir`, `test.coverage.reportsDirectory`, `test.attachmentsDir`, `test.outputFile` | under `.artifacts/vitest/`                                                                       | Everything a tool writes lives at `.artifacts/<tool>/` ([below](#where-a-run-writes))                                                                                                                                                                                                                                |
| `test.globalSetup`                                                                     | update mode, the run's temp root                                                                 | Update mode writes after the run is reported; the temp root is [below](#where-a-run-writes)                                                                                                                                                                                                                          |
| `test.maxWorkers`                                                                      | the Vitest workers of the toolchain's capacity model                                             | A run takes its share of the machine beside the gates running on it, and a run inside a gate's slice (`TYPESCRIPT_CAPACITY`) stays in it ([the toolchain's Quality checks § How many test runners](https://github.com/jterrazz/package-typescript/blob/main/docs/reference/quality-checks.md#how-many-test-runners)) |
| `test.env.NODE_COMPILE_CACHE`                                                          | `.artifacts/node-compile-cache/`, as an absolute path                                            | Every Node process a run starts reuses the code an earlier one compiled ([below](#where-a-run-writes))                                                                                                                                                                                                               |

Coverage attaches to every process a run spawns (`autoAttachSubprocess`), and reads `dist/` only to map each bundle back to the source it was built from (`excludeAfterRemap`): a spec that runs the built command counts toward the sources it exercised. A coverage run compiles without the cache: vitest turns it off, since V8 stores a cached script without the source positions precise coverage reads.

It sets nothing else on purpose. `fileParallelism`, `reporters`, `environment`, every other `env` variable and every `include` are true of one project and not of another, so a project states them; a helper does it for you. The coverage provider is yours to install.

The defaults reach every inline project too, since vitest resolves each project as its own config. A project given as a glob string, a promise or a function is handed back untouched.

The `<case>.spec.yaml` documents are collected by the `cli` project, which takes `literate` beside its own options:

```typescript
const cli = {
    literate: { runner: './specs/cli/run.specification.ts' },
    reason: 'the documents run against the runner the run/ specs share',
};
```

To adopt the preset from a config written by hand, file each kind of test under its folder, move what a project passed its helper beyond that into `test.projects`, keyed by its specification and with its reason, delete what the table above already says (the 30 s timeouts, `...configDefaults.exclude`, the ground exclusions), and run `typescript fix`, which writes the derived `vitest.config.ts`. A timeout lower or higher than 30 s stays stated, as the project's `timeout`: the preset is a starting point, not a ceiling. Then add `.artifacts/` to `.gitignore`.

## Turning the conventions on

The conventions travel in the same `test()` preset that sets the vitest defaults, so the `jterrazz.config.ts` [above](#the-vitest-config) already turns them on. The base preset needs no line of its own: the declared `platform` picks the lint profile it runs ([the toolchain's Lint presets § The profiles](https://github.com/jterrazz/package-typescript/blob/main/docs/reference/lint-presets.md#the-profiles)), and `test()` adds this package's rules on top.

The linter reads them through the `oxlint.config.ts` that `npx typescript fix` derives, one line like the vitest config:

```typescript
// oxlint.config.ts
import { oxlintConfig } from '@jterrazz/typescript/oxlint';

export default await oxlintConfig(import.meta.url);
```

`npx typescript check` then runs all of it: the oxlint plugin, the import and naming rules, and the conventions checker over `specs/`. Nothing is detected from your dependencies: a project that does not list `test()` runs none of these rules, and writes its tests all the same. A rule you set apart is written in `jterrazz.config.ts` with its reason, never in the derived file; how, how to suppress one finding, and the full catalogue are [Linting](../reference/linting.md).

## Where a run writes

**In the project, only under `.artifacts/`**, one folder per tool, one line in `.gitignore`, one `rm -rf .artifacts` for a clean slate:

| Path                                             | Written by                                                 | Lifetime                        |
| ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------- |
| `.artifacts/vitest/`                             | vite's transform cache, vitest's reports                   | Reused across runs              |
| `.artifacts/vitest/coverage/`                    | the coverage provider                                      | Rewritten per coverage run      |
| `.artifacts/vitest/sqlite/template-<key>.sqlite` | `sqlite()`'s schema template                               | Reused until the schema changes |
| `.artifacts/vitest/evidence/<pid>-.../`          | the screenshot of a website or mobile scenario that failed | Kept until the next run starts  |
| `.artifacts/node-compile-cache/`                 | Node, for the workers and every process they spawn         | Reused across runs              |

**Everything else is scratch, in one temp folder per run.** Before the first worker starts, the preset creates `jterrazz-test-runs-<uid>/<pid>-...` in the OS temp directory and points `TMPDIR`, `TMP` and `TEMP` at it, so every temp folder a worker, a spawned child or a tool it runs makes lands inside. That holds each CLI spec's working directory, the per-worker database copies and a browser's profile. The run removes the folder when it ends, and the next run removes the folder of any run that died first. A CLI spec's working directory goes sooner, once its test has finished, except under `test.concurrent`, where it waits for the run.

**Three environment variables are yours to set**: `TEST_UPDATE=1`, which turns on update mode ([Tokens § Update mode](../reference/tokens.md#update-mode-tokens-are-preserved)), `TESTCONTAINERS_REUSE_ENABLE=true`, which keeps the service containers alive from one local run to the next ([Services § Reused across runs, locally](../reference/services.md#reused-across-runs-locally)), and `TEST_MOBILE_HEADED=1`, which shows a mobile run's simulator in a window instead of running it headless ([Mobile specs](../guides/mobile-specs.md#the-simulator-and-what-the-run-leaves-on-it)). The framework also reads `VITEST_POOL_ID`, which vitest sets, to isolate each worker's databases.

## Two rough edges of the toolchain's flow

- **An `include` that names `.test.ts`** stops collecting the moment `typescript fix` renames a spec. The fix lists every glob or literal it broke, so update them in the same commit; `include-points-at-a-folder` holds the class afterwards.
- **`typescript baseline` in an npm-hoisted workspace member** cannot resolve oxlint today; run it from a directory where `node_modules/.bin/oxlint` resolves.

## Pitfalls

- **Forgetting `afterAll(cleanup)` in a specification file.** The services leak into the next suite (rule `cleanup-passed-to-after-all`).
- **Importing from a subpath the package does not publish** (`@jterrazz/test/matchers`). A test imports from `@jterrazz/test`, `@jterrazz/test/services` and `@jterrazz/test/stubs`; the tool entries are `/vitest`, `/config`, `/oxlint` and `/schema` (rule `no-unpublished-subpath`).
- **Importing a service or a stub from the root.** `postgres()` comes from `@jterrazz/test/services` and `http` from `@jterrazz/test/stubs`, so a spec that starts no container and serves no stub loads neither; `npx typescript fix` moves such an import to its subpath (rule `service-or-stub-from-its-subpath`).
- **Writing `browser:` in a config by hand.** `component()` pins the provider to the runner's version, serves the service worker and pre-bundles cold dependencies; a derived config has no place for a hand-written one: a project's `specification` is its helper.

## Upgrading

Each release's notes are its [GitHub release](https://github.com/jterrazz/package-test/releases); the package keeps no changelog. A major carries no bridge from the one before (no codemod, no rename map, no rule that recognises the old spellings; see [ADR-014](https://github.com/jterrazz/package-test/blob/main/docs/decisions/014-a-major-carries-no-bridge-from-the-one-before.md)), so a project moves by hand, and the rules of the new major name each leftover in their own terms.

### From 17 to 18

| What a 17 project wrote                                                  | What 18 asks for                                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `defineSpecConfig()` and its `SpecConfig` type, in a hand-written config | the derived one-liner, `await vitestConfig(import.meta.url)`, over `test.projects` ([§ The vitest config](#the-vitest-config)) |
| the `SpecificationConfig` type                                           | nothing in its place: it was the intersection of five chain configurations, and no constructor takes it                        |
| `component()` called directly, reading its root off the caller's file    | `component({ root })`, an absolute path; a project `vitestConfig` builds is handed its root as before                          |
| a strict-stub test matching `declared backend: no stub matches`          | `strict stubs: unmatched request`, the one wording every delivery answers an unmatched request with                            |

### From 16 to 17

| What a 16 project wrote                                                                                                  | What 17 asks for                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@jterrazz/typescript` ^10                                                                                               | ^11, released first; its own migration is [its Release § Which number moves](https://github.com/jterrazz/package-typescript/blob/main/docs/guides/release.md#which-number-moves)                                                                         |
| a hand-written `vitest.config.ts`                                                                                        | `test.projects` in `jterrazz.config.ts`, and the derived one-liner `typescript fix` writes ([§ The vitest config](#the-vitest-config))                                                                                                                   |
| the `jterrazz-test-check` bin, chained after `typescript check`                                                          | `presets: [test()]`; `typescript check`, `fix` and `baseline` run the checker                                                                                                                                                                            |
| a bare name: `.seed('two-users.sql')`, `.request('create-user.http')`, the `$`-prefixed alias of the shared fixture pool | a path from the spec file, `file('./__seeds__/two-users.sql')` or `directory(...)`; the shared ground is the special folder of its role at the specs root, `specs/__seeds__/`, `specs/__fixtures__/` and the rest, reached by the path that climbs to it |
| `defineContract()`, `defineContracts()` and the `Contract*` types                                                        | `defineStub()`, `defineStubs()` and the `Stub*` types ([Stubs](../reference/stubs.md))                                                                                                                                                                   |
| `specification.jobs()`, its `jobs` runner and the `jobs` folder under `specs/`                                           | `specification.job()`, the `job` runner and `specs/job/` ([Job specs](../guides/job-specs.md))                                                                                                                                                           |
| field probes with no whole comparison, the matcher of a table's rows, an api or job `<case>.spec.yaml`                   | one `toMatch` of the whole result, written in the test or in a `file()` ([Assertions](../reference/assertions.md)); documents stay for cli and lint specs                                                                                                |
| a rule id, in a config, a suppression or a ratchet key                                                                   | its new name, stated as its requirement ([Linting § The rule catalogue](../reference/linting.md#the-rule-catalogue)); a directive naming an old id is reported as dead                                                                                   |

## Related

[Getting started](getting-started.md) · [Component specs](../guides/component-specs.md) · [Linting](../reference/linting.md) · [Release](https://github.com/jterrazz/package-test/blob/main/docs/guides/release.md)
