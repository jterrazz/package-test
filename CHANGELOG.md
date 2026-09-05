# Changelog

All notable changes to `@jterrazz/test` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING — `i1-layer-boundaries` takes the layer map as an option, and ships INERT.** The
  rule carried the framework's own architecture — four layers named `core`, `integrations`,
  `lint`, `vitest`, and the framework's own dependency table — and applied it to every
  consumer that enabled the catalogue. A consumer whose directories happen to carry those
  names was judged against a map describing a different package; a consumer with any other
  architecture got a rule that could never say anything true. A project now declares its
  own layers:

    ```jsonc
    "jterrazz/i1-layer-boundaries": ["error", {
        "layers": {
            "domain": { "imports": ["domain/"] },
            "application": { "imports": ["application/", "domain/"] },
            "infrastructure": { "folders": { "postgres": ["pg"] }, "imports": ["domain/"] }
        }
    }]
    ```

    Per layer: `packages` (external dependencies it may import), `imports` (paths inside
    `src/` — a `foo/` prefix or an exact module path), `folders` (one folder = one external
    dependency), `seams` (a named module's extra edge — the lazy import a layer allows
    exactly once). With no map the rule reports nothing. The `coreExternal` and `lintRuntime`
    message ids are gone, folded into the general `foreignDependency` / `crossLayer` pair.

- **BREAKING — root discovery walks ONCE, probing both markers at each ancestor.** It ran
  two full walks, `docker/compose.test.yaml` first and `package.json` second, so the
  FURTHER marker decided: in a workspace, a compose file at the repository root outranked
  the `package.json` of the very package being tested, and every path the runner resolved
  was measured from the wrong unit. The root is now the NEAREST ancestor carrying either
  marker. A single-package repo is unaffected (both markers sit in the same directory);
  a workspace member now resolves to itself. `a9w-redundant-root` no longer keeps its own
  copy of the walk — the rule and the runner call one function, so they cannot drift.
- **BREAKING — `OrchestratorOptions.root` is required.** It fell back to `process.cwd()`
  while every constructor resolves the root by walking up from the calling specification
  file (A9) — one silent second opinion about what the project is, and in a workspace the
  cwd is rarely the same directory. Every call site inside the framework already passed a
  resolved root; the default only ever applied to a direct `new Orchestrator(…)` that
  omitted it, which now fails to compile.
- **One `specs/` anchor for every specs-aware lint rule.** C1, F2, F3, J2 and C8 each
  hand-rolled the search and disagreed: `lastIndexOf('specs')` (C1) took the innermost
  match, `indexOf('specs')` (F3) the outermost, and the bare "is `specs` a segment" test
  (F2, J2, C8) matched a directory anywhere above the project — a checkout under
  `~/specs/` read as one giant specs tree and silently switched F2's protection of
  production code off. They now share `specsAnchor(filename)`: the nearest ancestor named
  `specs`, searched no higher than the nearest `package.json`.

### Added

- **`c1-domain-structure` takes a `depth` option** — `['error', { depth: 'facet-domain' |
'mirror' | 'off' }]`, default `facet-domain` (today's behaviour, unchanged). `mirror` is
  for a tree that mirrors a structure outside itself — a command tree, a source tree: a
  `*.test.ts` at any depth of at least one directory under `specs/`, named after the
  directory holding it (`<dir>/<dir>.test.ts`), and specification files unconstrained. A
  project whose spec tree has a deliberate shape of its own can now DECLARE it and keep a
  checked tree, instead of switching the rule off and keeping none.

### Fixed

- **`sqlite({ prismaSchema })` reaches the Prisma CLI.** The option was stored and never
  passed: the template build ran a bare `npx prisma db push --force-reset` and relied on
  Prisma's own discovery from the cwd. A consumer whose `prisma.config.ts` does not sit at
  the cwd failed with "Could not find Prisma Schema that is required for this command" —
  and only on a machine without a cached template, so local runs stayed green while CI
  broke. The declared path is now resolved against `process.cwd()` and passed as
  `--schema <absolute path>`. No `prismaSchema`, no flag: discovery still applies.
- **The sqlite template file is keyed on the schema, not machine-global.** It resolved to a
  single `$TMPDIR/jterrazz-test-sqlite-template.sqlite` for every project on the machine,
  and any header-valid file found there was reused as-is — so the first project to run
  built the template and every other project silently inherited its tables. The name is
  now `jterrazz-test-sqlite-template-<sha8>.sqlite`, the digest taken over the kind of
  schema, its resolved path and its content; the build lock is per-key too. Editing a
  schema builds a new template instead of reusing the stale one.
- **I4 classifies data assets by a known extension list, not by "has a dot".** A
  `<subject>.<role>` module specifier — `../entities/dashboard.post`,
  `@scope/kernel/plugin.registry` — was read as a data asset and flagged in every
  `src/**/*.test.ts`. Only `.json`, `.sql`, `.yaml`, `.png`, … (and their `?raw`
  suffixed forms) are assets now; anything else is code, dotted or not.
- **Caller detection recognises framework frames by identity, not by path substring.** It
  skipped any stack frame whose path contained `/src/core/`, `/src/integrations/` or
  `/src/vitest/` — the framework's own layout, and a perfectly ordinary layout for a
  consumer too. A consumer's file under its own `src/core/` was read as framework-internal
  and skipped, so fixture resolution anchored on the next frame down (or fell through to
  the working directory) with nothing reported. A frame is now framework-internal when it
  is really inside the framework's own directory — real paths on both sides, so a `file:`
  link or a symlinked install still compares equal to itself. Sibling `*.test.ts` module
  tests stay callers (I2).

## [11.0.0] - 2026-08-01

### Changed

- **BREAKING — contracts everywhere.** `InterceptContract` is `Contract`, and its `trigger`
  field is `request`; `InterceptTrigger` / `InterceptResponse` / `InterceptResponder` are
  `ContractRequest` / `ContractResponse` / `ContractResponder`. No deprecated aliases.
- **BREAKING — ONE selection queue for every engine.** The MSW engine (api/jobs) and the
  declared stub backend (website/mobile) now share `ContractQueue`: the first contract in
  declaration order that matches and is not exhausted serves the request. No `times` means
  unlimited (the old website/mobile sticky tail, now explicit); the old api/jobs
  consume-once behaviour is written as `times: 1`.
- **BREAKING — provider string filters are EXACT.** `openai.chat({ user, system, model })`
  and `anthropic.messages({ ... })` compare strings whole. Loosen deliberately with a
  RegExp or the new `match.includes(substring)`.
- **BREAKING — `http.json(body, init?)`** takes `{ status?, headers?, delay? }` instead of a
  positional status; `http.error(status, body?)` takes a body, not a message.
- **BREAKING — `MatchableRequest` carries `method`.**

### Added

- **`times`** on a contract — serve exactly n times, then exhaust. Sequences are finite
  contracts before an unlimited tail (`[error500 ×3, ok]`).
- **`required`** on a contract — the chain fails when the call never happened (or did not
  happen exactly `times` times), on both engines.
- **`defineContracts(...)`** — a `Contracts` composite (recursive flattening, order
  preserved) with `.with(...)`: replacement-by-route plus prepend, immutable.
- **Path-form contract urls** — `http.get('/articles/{{uuid}}')` matches that path on any
  origin, `{{token}}` segments structural, declared query params a subset.
- **`http.patch`, `http.text`, `http.empty`**, and `match.includes(substring)` (code-only,
  the `{{token}}` vocabulary does not grow).
- The declared stub backend reads request bodies, so `match` predicates and body filters
  work on website/mobile chains too.

### Removed

- `.intercept('<name>.http')` intercept files and the whole `intercepts/*.http` format
  (`parseInterceptFile`, `exchangeMatches`, `interceptEntriesOf`). `.http` stays what it
  always was at the boundary of your own API: `requests/` and `expected/`.
- `.intercept(request, 'adapter/file.json')` string fixture paths and the adapter-prefix
  check — a contract imports its JSON payload itself.

### Conventions

- **BREAKING — the `contracts/` layout is a tree, not a flat folder (rule C4, reworked).**
  The root holds only `*.contracts.ts` facades (default export = a `defineContracts`
  composition, named exports = scenario factories) and the provider directories `http` /
  `openai` / `anthropic`. A unit contract is `contracts/<provider>/<kebab-name>.ts`, its
  `request` builder must name its own folder, and a provider folder is flat, holding only
  `*.ts` and `*.response.json`. The old `contracts/<name>.<provider>.ts` form, the
  "no named exports" restriction and the "imports only from `@jterrazz/test`" restriction
  are gone — a unit may import its neighbours and the app's own source (its real prompt
  builders).
- **NEW — C10 contracts boundary.** Outside `specs/**/contracts/`, importing a module from
  a provider folder is an error: a test imports only `*.contracts.ts` facades.
- **NEW — C11 contract data pairing.** Inside a provider folder every `*.response.json` and
  `*.request.ts` must have its sibling `<stem>.ts` owner, where the stem is the name up to
  the FIRST dot (`events.fr.response.json` → `events.ts`). Orphan data is an error.
- The C9 dead-fixture pass no longer walks `intercepts/` (the directory no longer exists).

## [10.0.0] - 2026-07-29

### Changed

- **BREAKING — a visit descriptor must designate exactly one element (CONVENTIONS W3).**
  Visitor actions no longer resolve an ambiguous descriptor to its first match: the
  framework refuses, with an error naming the descriptor in the caller's own
  vocabulary, enumerating every candidate with its landmark, and proposing the
  rewrites that would resolve it. Acting on "the first match" let a spec stay green
  while the visitor interacted with a different element, and nothing ever reported it.
  Specs relying on that behaviour must scope the descriptor with `within()` or pass
  `{ exact: true }`.

### Added

- **`within(scope, target)`** — restrict a descriptor to the inside of another. Scopes
  compose outside-in, and any descriptor works as one, including `testId()` for
  containers with no landmark role.
- **The ARIA landmark vocabulary** — `banner()`, `complementary()`, `contentinfo()`,
  `form()`, `main()`, `navigation()`, `region()`, `search()`. A closed, standard set,
  so `within()` never becomes a second selector language. Each takes an optional
  accessible name for pages carrying several of the same region.
- **`{ exact: true }`** on every named descriptor (`button`, `link`, `field`,
  `heading`, `content`, and the named landmarks) — match the accessible name whole
  rather than as a substring.

## [9.1.0] - 2026-07-18

### Added

- **`d15w-status-only-probe` lint rule** — a spec whose only assertions are HTTP-status
  probes should pin a full response golden (`expect(result.response).toMatch('...')`)
  instead of asserting the status alone.
- **Generated agent-facing rule catalogue** at `skills/jterrazz-test/references/rules.md`.

### Changed

- **Docs architecture** — `CONVENTIONS.md` / `CONVENTIONS-CATALOG.md` are removed. The
  hand-maintained constitution now lives in `docs/09-conventions.md`, and the full
  four-channel mechanized catalogue is generated into `docs/10-linting.md`.
- **Modular skill** — `skills/jterrazz-test/SKILL.md` is a one-screen core with
  per-situation references (`api`, `cli`, `jobs`, `tokens`, `contracts`, `rules`,
  `troubleshooting`).
- **Committed `docs/reference/` API projection** via `@jterrazz/typescript` 7, with a
  Docs sync pass in `npm run lint`.
- Rule messages now cite `(X — see docs/10-linting.md)` instead of the removed
  catalogue files.

### Removed

- `llms.txt` / `llms-full.txt` artifacts and the GitHub Pages docs deploy — the docs
  are in-repo.

## [9.0.0] - 2026-07-18

A ground-up redesign of the whole surface. The single `spec()` entry point and its
`app()` / `stack()` / `command()` targets are replaced by three focused constructors
(`specification.api()`, `.jobs()`, `.cli()`); every assertion moves to native vitest
`expect()` matchers; fixtures gain a unified `{{token}}` grammar and a single `.http`
format; and the statically-checkable conventions now ship as an oxlint plugin. This is
a breaking release with no compatibility shims — the migration guide below walks a v8
consumer through it in dependency order.

### ⚠ BREAKING CHANGES

#### Entry point — three constructors replace `spec()`

One constructor per tested interface (CONVENTIONS A2). Each returns a record
destructured with the constructor's canonical name (A3), created in a
`*.specification.ts` file (A1), and cleaned up via `afterAll(cleanup)` (A4):

```typescript
const { api, cleanup, docker, orchestrator } = await specification.api({ services, server });
const { jobs, cleanup, orchestrator } = await specification.jobs({ services, jobs });
const { cli, cleanup, docker, orchestrator } = await specification.cli(bin, options);
```

- `mode` (`'node' | 'compose'`, resolved `options.mode` > `TEST_MODE` > `'node'`) exists
  ONLY on `.api()`. `.jobs()` ignores `TEST_MODE` entirely — jobs always run in-process
  with their own testcontainers; the CLI is a local binary. The compose switch lives in
  `vitest.config.ts` (`env: { TEST_MODE: 'compose' }`), never in a specification file (A5).
- `.jobs({ jobs })` takes `(services) => JobHandle[]` or a static array; `.trigger(name)`
  is its terminal action.
- The project root is auto-discovered by walking up from the specification file to the
  first `docker/compose.test.yaml`, else `package.json` (A9); `root` remains an override.
- `docker(id)` on `.api()` / `.cli()` returns a `ContainerAccessor` for a container by id
  (replaces the standalone `dockerContainer()`).
- The old entry and targets (`spec()`, `app()`, `stack()`, `command()`) are removed.

#### Chains are terminal — no labels, no `.run()`

The facet returned by each constructor is the chain entry itself. There is no label (the
vitest test name is the only description, B3) and no `.run()`: terminal actions execute
the specification directly and resolve to their typed result (B2):

- `api` — `.request(file)`, `.get()`, `.post()`, `.put()`, `.delete()` → `Promise<HttpResult>`
- `jobs` — `.trigger(name)` → `Promise<BaseResult>`
- `cli` — `.exec(args, options?)` → `Promise<CliResult>`

Facets are subject-typed: `cli` only exposes command setups/actions, `api` only HTTP
ones — no casts needed anywhere.

#### `.exec()` is the only command method — `.spawn()` removed

`.exec()` is the single execution method (B2). Pass `{ waitFor }` for a long-running
process: it resolves when the pattern appears on output (exit code 0) and is killed at
`timeout` (default 10 000 ms; exit code 124).

```diff
- await cli.spawn('dev', { waitFor: /listening/ });
+ await cli.exec('dev', { waitFor: 'listening', timeout: 30_000 });
```

#### Assertions moved to vitest `expect()` matchers

Result accessors are read-only — every assertion method became an auto-registered,
subject-typed matcher (D1–D3):

- `toMatch(name)` — every subject resolves against `expected/<name>` (flat, extension
  required — organize with a slash in the name, C5/C6): streams/JSON compare against
  `expected/<name>`, `result.response` against an `.http` fixture (status, a header subset,
  and body), filesystem/directory subjects → async tree compare against `expected/<name>/`.
  Non-accessor subjects keep vitest-native `toMatch` (string substring / regexp).
- `toContain(text)` on text accessors (native semantics elsewhere).
- Async `toMatchRows({ columns, rows })` / `toBeEmpty()` on the read-only `result.table(...)`
  accessor (replaces `TableAssertion`).
- Async `toBeRunning()` on container accessors. Container property reads (`exists`,
  `running`, `status`, `file().content`) stay sync — the documented exception to the IO rule.
- The `DockerAssertion` fluent API and `DirectoryAccessor.toMatchFixture()` are removed —
  directory snapshots go through `await expect(result.directory(...)).toMatch(name)`.

#### `TextAccessor` (renamed from `StreamAccessor`) and composable `.grep()`

`StreamAccessor` is renamed **`TextAccessor`** — the one universal text handle for stdout,
stderr, container logs, and file text. `.grep(pattern)` moves onto `TextAccessor` (and
`FileAccessor`) and now **returns a `TextAccessor`** instead of a string, preserving the
`expected/` resolution context and the `transform`. It is chainable and snapshot-able:

```typescript
expect(result.stdout.grep('users.ts').grep('error')).toMatch('block.txt');
```

The `result.grep()` shortcut on `CliResult` is **removed** — the source is now always
explicit (`result.stdout.grep(...)`).

#### `Command*` exports renamed to `Cli*`

The command-subject public types now read one-word-per-concept, matching the `cli` facet
they belong to (constitution §B — no competing vocabulary): `CommandResult` → **`CliResult`**, `CommandPort` →
**`CliPort`**, `CommandEnv` → **`CliEnv`**, `CommandOutput` → **`CliOutput`**. Update any
type-only imports (`import type { CliResult } from '@jterrazz/test'`); the runtime shape
is unchanged.

#### Unified `{{token}}` grammar + `match.*` mirror

One frozen vocabulary (D4), valid in `expected/*.http` (body AND headers), `expected/*.json`,
text snapshots, and tree-snapshot file contents — 21 tokens: `uuid`, `ulid`, `iso8601`,
`date`, `time`, `duration`, `number`, `int`, `float`, `semver`, `sha`, `hex`, `base64`,
`port`, `ip`, `url`, `email`, `path`, `workdir`, `string`, `any`. Each is capturable via
`{{type#ref}}` (first occurrence captures, later ones must be equal; ref scope = one spec).
The code-side mirror is `match.*`, plus `match.regex(re)` and `match.ref(name, { not? })`.

- `TEST_UPDATE=1` / `vitest -u` writes **tokens, not values**: existing placeholders are
  preserved and `{{workdir}}` is substituted automatically (D5).
- **ANSI escapes are stripped by default** before stream and JSON comparison (D6); `.text`
  stays raw. The `transform` option remains only as an escape hatch for noise no token covers.

#### `.http` request/response files, flat `expected/`

`api.request(file)` sends the COMPLETE request described by `requests/<file>` —
`METHOD /path`, headers, blank line, body (sent raw — fixes the double-stringified body
bug). Response fixtures live in `expected/` like every other expected fixture: they start
with `HTTP/1.1 <status>`, assert a SUBSET of headers, and support tokens. `.request()` is
the only reader of `requests/`; `toMatch(...)` always reads `expected/`. `expected/` is
flat — the extension is part of the snapshot name, and a slash creates a subfolder. JSON
request/response fixtures and the `responses/` directory are removed.

#### Fixtures unified on `.fixture()` — `.project()` and `seedHandlers` removed

The cli facet copies files through a **single verb**, `.fixture(path)`, and the seed/fixture
split is a hard taxonomy (C7): `.seed()` carries **database state** (SQL only), `.fixture()`
carries **file state**.

- `.project(name)` is removed — use `.fixture('$FIXTURES/name/')`.
- `seedHandlers` is removed. There is no path-prefix dispatch and `.seed()` no longer copies
  files — a "transformation" is expressed declaratively, in the _shape_ of a fixture tree
  laid out as the cwd should look, layered via chained `.fixture()` (last write wins).
- `.fixture(path)` resolves two ways: `$FIXTURES/<rest>` → the **shared pool** at
  `<specs-root>/fixtures/<rest>` (the nearest ancestor `specs/` dir); any other path →
  **feature-local** `<test-dir>/fixtures/<path>`. Any other `$…` marker is an error. Copy
  semantics follow rsync's trailing slash: `dir/` spreads the directory's contents into the
  cwd (the old `.project()` behaviour), `dir` (or a file) is copied under its basename.
- `root` is decoupled from fixtures — it now means only the project-root override (A9); the
  `fixturesRoot` plumbing is gone. The shared pool's home moves to `specs/fixtures/`.

#### Services are a named record

`services` is a record on all three constructors — `{ db: postgres() }` — and the `.api()`
`server` factory receives the exact same record, fully typed. Record keys become the spec's
database vocabulary:

- A key without `composeService:` binds to the compose service named exactly like it, else
  the kebab-case conversion of the key (`analyticsDb` → `analytics-db`); both names present
  is an ambiguity error. The `composeService` option (formerly `compose`) is the escape
  hatch for non-derivable names (A6).
- `.seed()` and `result.table()` target databases via `database:` (replaces `service:`); on
  `.seed()` the key is typed (`DatabaseKeys<Services>`) — a typo is a compile error. With 2+
  declared databases the option is mandatory; with exactly one it is forbidden (A7).
- **CLI env auto-injection (B6):** `.cli` with `services` injects connection URLs into the
  child env — `<KEY>_URL` per record key (CONSTANT_CASE with camelCase boundaries split, so
  `analyticsDb` → `ANALYTICS_DB_URL`), plus `DATABASE_URL` (exactly one SQL database) and
  `REDIS_URL` (exactly one redis). `.env()` overrides; `null` unsets.
- `Orchestrator` now takes `services: Record<string, ServiceHandle>`; `getDatabases()` is
  keyed by record key and `getDatabase()` takes no argument.

#### Intercepts — flat contracts, strict matching, provider renames

`defineContract({ trigger, response })` declares an external interaction as a single flat
TypeScript file `contracts/<name>.<provider>.ts` (`provider ∈ { openai, anthropic, http }`,
`defineContract` default export, no subfolders, C4). `.intercept(contract)` accepts an
imported contract or an **array** of them; inline `.intercept(trigger, response)` remains
for one-off cases.

- **Provider triggers are named after each provider's own official API:** `openai.chat()`
  (Chat Completions) and `openai.responses()` (Responses) replace `openai.request()` /
  `openai.agent()`; `anthropic.messages()` (Messages) replaces and merges
  `anthropic.request()` + `anthropic.message()` — object fixtures pass through verbatim,
  strings get the Messages envelope. The `claude` alias is merged into `anthropic` (removed).
- **`http` filters:** every `http` trigger (`get`/`post`/`put`/`delete`/`any`) takes an
  optional subset filter `{ body?, headers?, query? }` — object `body` is a deep subset
  match (`match.*` allowed as leaves), string/RegExp `body` is a containment/`test()` over
  the raw text body, `headers` match case-insensitively, `query` matches a subset of the
  URL search params. A request that hits the URL/method but fails the filter is unmatched (D7).
- **Strict by default (D7):** once a chain (`api`/`jobs`, node mode) declares at least one
  intercept, any outgoing HTTP request that matches no registered intercept — including an
  exhausted queue — fails the spec, rejecting the action promise (never an unhandled
  rejection) and naming the offending request plus every trigger and its consumption state.
  Unconsumed intercepts never leak into the next chain. A chain that declares NO intercept
  keeps MSW off — its network is not guarded.
- `.intercept()` on a compose-mode `api` runner throws immediately: intercepts are in-process
  (MSW) and unavailable in compose mode — keep intercept specs in node-only vitest projects (I3).

#### Packaging — single import point, msw bundled, vitest the only peer

- **Subpath exports are removed** — everything imports from `@jterrazz/test` (F1). The one
  sanctioned exception is the tool-facing `@jterrazz/test/oxlint` (see Added).
- **`msw` moves from an optional peer dependency to a bundled direct dependency** — no
  separate install for HTTP interception.
- **The `hono` peer dependency is removed.** In-process API specs pass your app to `server`;
  the adapter only needs an object with a `request()` method, so bring your own web
  framework in your project.
- **`vitest` is now the sole peer dependency.**
- **Framework env vars:** the framework reads exactly two variables, `TEST_MODE` and
  `TEST_UPDATE` (E1). The old `JTERRAZZ_TEST_UPDATE` / `UPDATE_SNAPSHOTS` update triggers
  are removed.

#### `specs/` layout — facet root, domain-nested tests (C1)

The `specs/` layout is now facet → domain. Each facet (`api`, `jobs`, `cli`, `integrations`,
`lint`) carries its runner(s) at its **root** (`specs/<facet>/<name>.specification.ts`; the
canonical name is the facet name for a single runner). Tests live one level down in **domain**
folders (`specs/<facet>/<domain>/<aspect>.test.ts`, 1..n aspects per domain). **The folder
follows the assets:** a test with its own asset dirs gets its own domain; asset-less tests
group as sibling `<id>.test.ts` in a named group folder. `specs/setup/` is gone — runners
moved to their facet roots. Enforced by the reworked `jterrazz/c1-domain-structure` rule
(renamed from `c1-feature-file-name`).

#### Removals

- The dead `.mock()` builder method (registered files were never used — use `.intercept()`).
- The v8 compatibility aliases (`cli()`, `CliResult`, `SpecOptions`, `SpecRunner`,
  `AppServices`) and their subpath exports.

### Added

#### `text(value)` — any string as a golden subject

`text(value)` (exported from `@jterrazz/test`) wraps an arbitrary string into a `TextAccessor`
anchored on the calling test's directory via the same caller-detection the runners use. ANSI
is stripped before comparison, the `{{token}}` grammar applies, and `.grep()` composition
works exactly as on a captured stream — so a checker's output, an error message, or a report
can be goldened like any other product surface instead of a `try/catch` + N×`toContain` cluster:

```typescript
import { text } from '@jterrazz/test';

const message = await catchMessage(() =>
    expect(result.response).toMatch('wrong-body.http', { frozen: true }),
);
expect(text(message)).toMatch('errors/wrong-body-error.txt'); // resolves to expected/
```

#### Frozen fixtures — `toMatch(name, { frozen: true })`

Update mode rewrites a mismatching fixture from the actual output — correct for a positive
golden, silently destructive for a **negative** one (a deliberately-wrong fixture whose diff
or missing-fixture error is the behaviour under test). `toMatch` now accepts a second argument
on every fixture subject (`response`, `stdout`, `stderr`, `json`, `directory`, `filesystem`):

```typescript
// The diff rendering is the subject — never rewrite the wrong fixture.
expect(() => expect(result.response).toMatch('wrong-body.http', { frozen: true })).toThrow(
    /Response mismatch/,
);
```

A frozen fixture is never written under `TEST_UPDATE=1`; a frozen mismatch still throws its
diff and a frozen missing fixture still throws "does not exist". The option type
`MatchFixtureOptions` is exported. The static rule `d13w-unfrozen-negative-fixture` (warning)
flags a `toMatch` wrapped in `expect(() => …).toThrow()` / `.rejects` that omits it.

#### `.exec()` with no arguments

`cli.exec()` now runs the binary bare — clearer than the `.exec('')` idiom. The empty **array**
`cli.exec([])` still throws: a command _sequence_ must name at least one command.

#### Dynamic intercept responses

An intercept `response` can be a **function of the request** —
`(request: MatchableRequest) => InterceptResponse` — evaluated per consumed request, so the
reply can echo or derive from the body, headers, or URL. Works in `defineContract` and inline:

```typescript
.intercept(http.post(url), (request) => http.json({ received: request.body }))
```

Fixed responses remain the default. New exported types: `InterceptResponder`,
`InterceptResponseValue`, and `MatchableRequest`.

#### Lint plugin — `@jterrazz/test/oxlint`

The statically-checkable conventions ship as an oxlint JS plugin (the one sanctioned subpath,
tool-facing and zero-runtime — rule F1). Enable it by composing the `testing` fragment into
your preset:

```typescript
import { testing } from '@jterrazz/test/oxlint';
import { compose, node } from '@jterrazz/typescript/oxlint';

export default compose(node, testing, {
    rules: { 'jterrazz/b5-await-using': ['error', { runners: ['dockerCli'] }] },
});
```

- **40 rules**, one per mechanized convention, named `jterrazz/<convention>-<name>`: runner
  creation and destructuring (a1–a5, a10), fixture markers and job names (b2, b8),
  Given-before-Then narrative ordering (b4), `await using` for docker-aware runners (b5),
  file/content shape (c1, c2, c4, c6, c7), referenced-fixture existence (c8), awaited IO
  matchers (d2), import protection (f1–f5), source architecture (i1, i2, i4), and hygiene
  (j1–j5). Warning-severity redundancy heuristics (`a6w`, `a9w`, `b6w`, `d2w`, `d6w`, `d8w`,
  `d9w`, `d12w`, `d13w`) flag derivable options, redundant config, and lazy `.body` probe
  clusters that want a full-response golden. Two new conventions land here:
  `b9w-product-command` (a spec should exercise the real product binary) and `j5-lowercase-title`
  (test/describe titles start lowercase, identifier-shaped tokens exempt).
- **`testing`** wires the plugin, enables the whole catalogue (`recommendedRules`, also
  exported standalone), and ships the one `overrides` strict consumers need
  (`import/exports-last` off for `**/*.specification.ts`). Wiring is explicit — no dependency
  auto-detection. `f1`/`f2` exempt `@jterrazz/test/oxlint` from any file, and `./oxlint` gains
  a `require` condition so a shared preset can pull `testing` synchronously.

#### Conventions checker — `jterrazz-test-check`

A second static channel (`dist/checker.js`, also the `jterrazz-test-check` bin, chained into
`npm run lint`) for what oxlint cannot see because it reads data files or two files at once:
rejects `{{tokens}}` outside the frozen D4 vocabulary and malformed captures across every text
file under `expected/`, enforces the `.http` first-line grammar, warns on tokens leaking into
`requests/`, and runs the cross-file passes — dead fixtures & orphan feature dirs (C9), await-using
by inference (B5), and the `{ database }` requirement cross-checked from the `services:` record
(A7). It shares `TOKEN_KINDS` with the runtime matcher, so the channels cannot drift.

#### Docs-as-code conventions catalogue

The code is the source of truth for the mechanized rules: each rule carries its normative
sentence in `src/lint/manifest.ts`, and a generator (chained into `npm run docs`) renders the
`docs/10-linting.md` rule table and the `CONVENTIONS-CATALOG.md` annex deterministically;
`CONVENTIONS.md` shrank to a hand-written constitution of principles.

### Fixed

- `{{duration}}` / `match.duration()` accepts hours (`3h`) as documented.
- Embedded `{{port}}` placeholders enforce the 0–65535 range (`99999` no longer matches),
  consistent with the whole-value form.
- Ref captures of objects compare with a stable (sorted-key) stringify — two captures of the
  same object are equal regardless of key order.
- Response fixture update mode writes only headers present in the actual response
  (intersection), preserving still-matching placeholders — a freshly updated fixture always
  passes the next run.
- Update mode now substitutes the known cwd for `{{workdir}}` on the **JSON** (`expected/*.json`)
  and `.http` response-body paths, not just text snapshots — parity across all three fixture
  kinds (D5). A golden containing `{{workdir}}` is preserved, and a fresh cwd-bearing value is
  tokenized instead of pinning a run-specific temp path, so an updated JSON/`.http` golden
  matches the next run's cwd.
- `toMatch` on an accessor subject (`stream` / `json` / `response` / `filesystem` / `directory`)
  now rejects a `RegExp` (or any non-string) argument immediately with a clear error — it names
  the subject kind, states that the argument is a fixture name (extension included), and points
  at the escape hatch `expect(x.text).toMatch(/re/)` — instead of tripping the extension check or
  coercing the regex to `"/re/"` (runtime rule D14).
- `.exec(args, { waitFor })` runs through the shell exactly like one-shot `.exec()` (no naive
  whitespace split — quoting behaves identically); the watch timeout is cleared/unref'd on
  resolution, and termination escalates SIGTERM → SIGKILL after a 2 s grace period.
- Long-running termination kills the whole **process group**, not just the direct shell child:
  the `waitFor` child is spawned detached and signalled via the negative pid, so grandchildren
  (an orphaned `tsdown --watch` under a `dev` command) no longer survive the spec. Degrades to
  the direct kill where process groups are unsupported (Windows) or already reaped.
- `exec([])` now throws `exec([]) requires at least one command` instead of silently succeeding
  with empty output.

### Migration

1. **Update dependencies.** Bump `@jterrazz/test` to `9`, keep `vitest ^4.1` (now the sole
   peer). `msw` is bundled — drop it from your `devDependencies` unless you use it directly.
   `hono` is no longer a peer; keep it only if your app uses it.
2. **Replace the entry point and targets.** `spec(app(...))` →
   `specification.api({ services, server })`; `spec(stack(...))` → `specification.api(...)` run
   under `TEST_MODE=compose`; `spec(command(bin))` → `specification.cli(bin)`. Create runners in
   `*.specification.ts` files, destructure the canonical names (`api`, `jobs`, `cli`), and call
   `afterAll(cleanup)`.
3. **Move the node/compose switch to vitest config.** vitest 4 removed workspace files — move
   the projects from `vitest.workspace.ts` into `vitest.config.ts` (`test.projects`) and set
   `env: { TEST_MODE: 'compose' }` on the compose project.
4. **Drop labels and `.run()`.** `run('creates a user').post(…).run()` → `api.post(…)` — the
   test name is the description.
5. **`.spawn(cmd)` → `.exec(cmd, { waitFor, timeout })`.**
6. **Convert services arrays to a named record** (`{ db: postgres() }`) and rename the
   `compose:` option to `composeService:` (omit it when the key matches the compose service name).
7. **`{ service: 'compose-name' }` → `{ database: 'recordKey' }`** on `.seed()` / `.table()`;
   drop the option when exactly one database is declared. Remove any hand-wired `*_URL` env
   entries the framework now injects.
8. **`.project('name')` → `.fixture('$FIXTURES/name/')`** (note the trailing slash — it spreads
   the contents into the cwd). Move shared fixture projects from `specs/setup/fixtures/` to
   `specs/fixtures/`, and drop any `root: '../fixtures'` that only served `.project()` resolution
   (keep `root` only where it overrides the A9 project root).
9. **Remove `seedHandlers`.** Convert each handler + its `seeds/<prefix>/` fragments into a
   fixture tree under `fixtures/` (or the shared pool) shaped like the target cwd, and replace
   `.seed('prefix/fragment')` with a chained `.fixture(...)`. `seeds/` now holds `*.sql` only.
10. **Move assertions to `expect()`.** `result.directory(p).toMatchFixture(name)` →
    `await expect(result.directory(p)).toMatch(name)`; table assertions →
    `await expect(result.table(...)).toMatchRows(...)` / `.toBeEmpty()`; container checks →
    `await expect(...).toBeRunning()`.
11. **Convert fixtures to `.http`.** JSON request fixtures → `.http` files under `requests/`,
    response fixtures → `.http` files under `expected/` (same folder as every other expected
    fixture — `responses/` is gone); flatten `expected/` (the extension is part of the name).
12. **Move contracts to flat `contracts/<name>.<provider>.ts`** files with
    `export default defineContract(...)`. `claude` → `anthropic`, and rename provider triggers
    to their official API names: `openai.request` → `openai.chat`, `openai.agent` →
    `openai.responses`, `anthropic.request` / `anthropic.message` → `anthropic.messages`.
13. **Import everything from `@jterrazz/test`** (subpaths are gone) and replace
    `JTERRAZZ_TEST_UPDATE=1` / `UPDATE_SNAPSHOTS=1` with `TEST_UPDATE=1`.
14. **Enable the conventions.** Compose the `testing` fragment from `@jterrazz/test/oxlint` into
    your oxlint preset, and chain `jterrazz-test-check` into your lint script.

## [8.0.0] - 2026-04-14

The final release of the `spec()` line, published to npm and recorded here for
completeness ahead of the 9.0 redesign. `spec(target)` stayed the single entry point,
with `app()`, `stack()`, and `command()` targets returning a fluent
`SpecificationBuilder`; this entry summarizes the surface as it shipped.

### ⚠ BREAKING CHANGES

- **`docker()` target removed — Docker awareness folded into `command()`.** Container
  introspection became an opt-in `docker: { envVar, nameLabel, testRunLabel }` option on
  `SpecOptions`, passed alongside `command(bin)`. The `DockerCliResult` class was removed and
  `CliResult` grew `container(name)`, `containerIds`, and a guarded `[Symbol.asyncDispose]`. The
  test-run id became stable per runner instance (per vitest file), not per `.run()` call, so a
  spawn in one step and an inspect in another share one container scope.
- **`toMatchFixture` renamed to `toMatch`** on the stream / JSON / filesystem accessors, and the
  name argument now requires an explicit extension (`toMatch('valid.txt')`, not `toMatch('valid')`).

### Added

- **Result accessors** — `stdout`, `stderr`, `json`, and `filesystem` accessors on `CliResult`,
  plus `StreamAccessor.toContain(substring)` so a substring assertion no longer reaches through
  `.text` into `expect(...).toContain(...)`.
- **`SpecOptions.transform`** — normalise stdout/stderr (ANSI strip, path scrub, …) before every
  `toMatch` comparison.
- **`ContainerAccessor`** with lazy docker queries: `exists`, `running`, `status`, `stdout`,
  `stderr`, `inspect`, `file(path)`, `exec(cmd)`, and the underlying container `id`.
- **Seed handlers** — pluggable routing for non-SQL overlays via `seedHandlers`.
- `exec.adapter` captures stderr regardless of exit code — fixes Unix-style
  status-banner-on-stderr CLIs that had their stderr discarded on exit zero.

## [7.1.0] - 2026-04-14

### Changed

- **Adapter-validated file-based intercepts.** `InterceptTrigger` gained a required `adapter`
  field and a `wrap` function; intercept file paths must start with the adapter name
  (`'openai/file.json'`), validated by the builder at runtime. Provider methods were unified so
  every adapter reads the same way — `request()` / `agent()` for triggers, `reply()` for
  responses (`anthropic.messages()` / `.response()` became `.request()` / `.reply()`).

## [7.0.0] - 2026-04-14

### Added

- **File-based `.intercept(trigger, 'file.json')`** — loads JSON from the `intercepts/` dir and
  lets the trigger's `wrap()` auto-format the payload (OpenAI envelope, raw HTTP, …):
  `.intercept(openai.agent({ user: /ingest/ }, GATEWAY), 'ingest-tech.json')`.

### ⚠ BREAKING CHANGES

- **Cleaner OpenAI naming.** `openai.chat()` → `openai.request()` (Chat Completions trigger),
  `openai.responses()` → `openai.agent()` (Responses API trigger with auto-wrap), and
  `openai.response()` → `openai.reply()`. The old names stayed as deprecated aliases.

## [6.5.0] - 2026-04-14

### Added

- **Body-based intercept routing + OpenAI Responses API support.** Triggers can route on the
  request body, and the Responses API response shape is supported alongside Chat Completions.

### Fixed

- **6.5.1** — add the required `id` field to the Responses API output envelope.

## [6.4.0] - 2026-04-14

### Added

- **`.job(name)` action** for background-job testing, alongside `.get()` / `.exec()`. The `app()`
  factory can now return `{ server, jobs }` to register named jobs, triggered via `.job(name)`.

### Changed

- **Screaming-architecture refactor** — the builder split into `builder/common`, `builder/http`,
  and `builder/cli` by subject.

### Fixed

- **6.4.1 / 6.4.2** — discriminate `AppFactoryResult` by the `jobs` array rather than the
  `server` property, and align the `.job()` error-message test.

## [5.2.0] - 2026-04-11

### ⚠ BREAKING CHANGES

#### CLI specs always run in a fresh empty temp directory

Previously, a CLI spec without `.project()` or `.fixture()` fell back to running in `fixturesRoot` itself — which meant scaffolding CLIs (copier, plop, your own codegen tools) would silently write into your committed fixture directory if you forgot to attach a project. The old fallback was surprising and unsafe.

Now every `.exec()` / `.spawn()` invocation runs in a fresh `mkdtemp` directory unconditionally. `.project("name")` still copies a fixture project into that temp dir before the command runs; `.fixture("file")` still copies individual files on top.

**You are affected if:** you wrote a CLI spec like `spec("x").exec("...")` _without_ calling `.project()` or `.fixture()` and were relying on the command running inside `fixturesRoot` (e.g., your CLI was modifying files committed under `tests/fixtures/`).

**Migration:**

```diff
// BEFORE — silently ran in fixturesRoot, polluted committed fixtures
const result = await spec("scaffold")
  .exec("copier copy template .")
  .run();

// AFTER (no change needed — you now get an isolated temp dir for free)
const result = await spec("scaffold")
  .exec("copier copy template .")
  .run();

// If you were ACTIVELY relying on running in fixturesRoot (rare),
// switch to .project() with an explicit fixture project:
const result = await spec("scaffold")
  .project("scaffold-base")     // copies fixturesRoot/scaffold-base into a temp dir
  .exec("copier copy template .")
  .run();
```

For most callers there is no migration step — you simply stop accidentally writing into your fixture directory. If you previously needed an `empty-project` placeholder fixture purely to force isolation (a common workaround), you can delete it.

### Fixed

- Lint baseline restored after the codestyle 2.2.0 + knip upgrade. Validate workflow is green again.

## [5.1.0] - 2026-04-11

### Added

- **`result.directory(path).toMatchFixture(name)`** — directory snapshot assertion. Walks the generated tree, diffs it against `expected/{name}/` (relative to the test file), and throws a structured diff (added / removed / changed, with line-level diff for changed files) on mismatch. Default ignores: `.git`, `.DS_Store`, `node_modules`, `.next`, `dist`, `.turbo`, `.cache`. Pass extra ignores via `{ ignore: [...] }`. Update fixtures with `JTERRAZZ_TEST_UPDATE=1`, `UPDATE_SNAPSHOTS=1`, or `vitest -u`. Designed for testing scaffolding tools, code generators, and bundler outputs.
- **`result.directory(path).files()`** — recursive sorted file list with the same default ignores, for ad-hoc presence/absence assertions when a full snapshot is overkill.
- **`spec.env({ KEY: "value" })`** — set environment variables on the CLI child process. `null` unsets a variable. The token `$WORKDIR` in any value expands to the temp working directory at run time (e.g. `HOME: "$WORKDIR"` for full home isolation). Multiple `.env()` calls merge.

### Changed

- README and skill docs reorganized; new sections for directory snapshots, env vars.

## [5.0.0] - 2026-03-28

### Added

- Initial 5.x baseline with `integration()`, `e2e()`, `cli()` specification runners; `postgres()` and `redis()` service factories; `mockOf` / `mockOfDate` mocking helpers; Docker assertion port; full `SpecificationBuilder` fluent API (`seed`, `fixture`, `project`, `mock`, `get` / `post` / `put` / `delete`, `exec`, `spawn`).

[Unreleased]: https://github.com/jterrazz/package-test/compare/v9.1.0...HEAD
[9.1.0]: https://github.com/jterrazz/package-test/compare/v9.0.0...v9.1.0
[9.0.0]: https://github.com/jterrazz/package-test/compare/v8.0.0...v9.0.0
[8.0.0]: https://github.com/jterrazz/package-test/compare/v7.1.0...v8.0.0
[7.1.0]: https://github.com/jterrazz/package-test/compare/v7.0.0...v7.1.0
[7.0.0]: https://github.com/jterrazz/package-test/compare/v6.5.1...v7.0.0
[6.5.0]: https://github.com/jterrazz/package-test/compare/v6.4.2...v6.5.0
[6.4.0]: https://github.com/jterrazz/package-test/compare/v6.3.0...v6.4.0
[5.2.0]: https://github.com/jterrazz/package-test/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/jterrazz/package-test/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/jterrazz/package-test/releases/tag/v5.0.0
