# Conventions

The conventions say where a test lives, what it compares, what it may stand on and how its files are named. Most of them are rules a machine checks, and each of those has its normative sentence in the code, generated into the catalogue of [Linting](../reference/linting.md). This page holds the rest: the principles those rules come from, and the judgements no rule can make, which are review's.

They bind every test file of a repository that lists the `test()` preset — a plain unit test that imports nothing of this package included.

## Quick rules

The rest of the chapter explains each of these. When a rule is broken, the finding names it.

- **Where a test goes.** A module's test sits in the `__tests__/` of its module's folder: `dir/__tests__/<file>.test.ts` for `dir/<file>.ts`, or `.test.tsx` for a rendered component. A spec of the assembled product goes under `specs/<kind>/<subject>/<aspect>.spec.ts`. Its runner, `<kind>.specification.ts`, sits at the root of `specs/<kind>/`.
- **One file, one subject, one `describe`.** The folder names the subject (`users/list/` is `GET /users`). The file name names the question asked of it (`pagination`), and the file's one top-level `describe` repeats that name. A module test has no aspect: its `describe` names the module's export it is about — `describe('rank', …)` in `__tests__/ranking.test.ts` for `export function rank` ([§ The aspect](#the-aspect)).
- **Given, then Then.** Every test carries a `// Given -` line and a `// Then -` line. A `// When -` line is optional, in any kind of test; written, it sits between the two (`when-between-given-and-then`), and `given-and-then-markers-present` neither asks for it nor counts it. Its chain has exactly one action.
- **What a test stands on sits in a special folder, `__<word>__/`.** `__seeds__/` holds SQL, `__requests__/` what is sent, `__fixtures__/` files the program reads, `__expected__/` what is compared, and `__setup__/` helper code. At the root of `specs/` they hold what several kinds share. No other `__<word>__/` is allowed under `specs/`, and in a code root only `__tests__/`.
- **Write it in the test, or in a file.** A value one test compares, or a request one test sends, is written in the test, up to 30 lines for a request or body and 150 for an expectation. Past those caps, or when several tests read it, it goes in a file. A seed is always a `.sql` file.
- **Shared things sit at the lowest common folder.** A seed or a helper read by `events/list/` and `events/get/` goes in `events/__seeds__/` or `events/__setup__/`. Only what several kinds share goes in the special folders at the root, `specs/__seeds__/`, `specs/__setup__/`.
- **Paths are written with `file()` or `directory()`, in the test.** They resolve against the spec file that calls them.
- **A repository suite is the one exception.** A test of the repository itself, such as what its tarball holds, has no module to sit beside and no runner to reach. It goes in a first-level folder of `specs/` that is not a kind's name ([§ A repository suite](#the-third-door-a-repository-suite)).

## Which test earns its place

A test earns its place by proving what a user relies on, in real conditions. A test that restates the implementation, repeats a spec, or stays green when the behaviour breaks is deleted, not kept for the count, and a suite's value is measured by the mutants it kills, not by its line coverage. [The fork](../start/getting-started.md#which-kind-of-test) says which kind a test is; this says whether it should exist at all.

**End to end is the default.** A behaviour a user relies on is specified through the surface the user meets, on a specification under `specs/`, with the real engines — the app in-process, a declared service ([Services](../reference/services.md)), a real Chromium, the built binary. A module test is the exception, and it is kept only when one of two criteria holds:

| Keep the module test when                                                                                           | Because                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| the module is a pure algorithm — a parser, a matcher, a ranking — whose edge cases are cheaper at its own level     | each edge through the surface costs a whole chain, and at the module it costs one line of a `test.each` |
| the failure it proves is one no end-to-end path can provoke honestly — a broken invariant, a race, a refused engine | reaching it from the surface would mean faking the engine, and the spec would then prove the fake       |

**Every test file is given one verdict, and only one.**

| Verdict     | When                                                                                                             | What is done                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| keep-module | one of the two criteria above holds                                                                              | it stays in its module's `__tests__/`                                    |
| promote     | it proves something a user relies on, at the wrong level                                                         | the spec is written through the surface, then the module test is deleted |
| delete      | it restates the implementation, repeats a spec, tests a private helper, or stays green when the behaviour breaks | it is deleted, not kept for the count                                    |
| strengthen  | it earns its place, and its assertions probe a part of an outcome that can be compared whole                     | its oracle becomes the whole outcome                                     |

**A published package is specified from its artefact.** What a package publishes — every subpath of its `exports` map under each condition, the declarations a consumer compiles against, every bin — is proven against the tarball `npm pack` writes, installed in a fixture's `node_modules/` as a consumer installs it — the package beside what its `dependencies` and required peers reach, and each package the consumer's own install would hold linked by name, never the checkout's whole install — and never against the checkout's `src/` or its own `dist/`: a file the `files` field leaves out, or an import the manifest does not declare, passes every spec that reads the checkout and fails every consumer. This package does it with its own `.link('@jterrazz/test', packed())`, on `specs/cli/packed-cli.specification.ts` — `specs/cli/node/` loads every published subpath and resolves every package the browser build imports under the browser condition, `specs/cli/tsc/` compiles a consumer module against the installed `.d.ts` ([Test](https://github.com/jterrazz/package-test/blob/main/docs/guides/test.md#the-meta-test-channel)). The browser build is checked from the install for resolution only: it runs in the component project, which aliases `@jterrazz/test` to the checkout's `dist/browser/index.js`.

**An assertion compares an outcome someone would care about**, whole when it can. That half is mechanized, in the `expectations` family of the catalogue ([Linting](../reference/linting.md)): `result-compared-whole`, `no-status-only-test`, `no-existence-only-assertion`, `no-probe-cluster`, `no-double-only-assertion`, `no-sampled-value-in-expectation`.

**Mutants measure a suite, not lines.** Full line coverage with surviving mutants proves only that the lines ran; a mutant that survives names the assertion that is missing or too weak. A tool such as [Stryker](https://stryker-mutator.io) finds them. This package runs a zero-survivor mutation verdict inside the gate, incrementally: the module tests over the sources they test, and the whole suite, specs included, over what the module tests let live and the lines a change touches that they leave ([Test § The mutants no test kills](https://github.com/jterrazz/package-test/blob/main/docs/guides/test.md#the-mutants-no-test-kills)).

**Why no rule decides the verdict.** Whether a module is a pure algorithm, whether a failure is provokable from the surface, and whether a test repeats a spec are readings of the product, not shapes of a file: a rule would have to know every path the specs drive. What a machine can take is taken — the assertion rules above, and the surviving mutant, which is the evidence a verdict is argued from ([What stays human](#what-stays-human-and-why)).

## One way to write a test

The framework's constructors serve a product reached through an entry — an API, a job, a binary, a page, a screen. The conventions reach further: they bind every test file of the repository, a plain unit test of a pure function included, whether or not it imports `@jterrazz/test`. A repository has one way to write a test, so a reader moving from a module test to an API spec reads the same shape, and a rule that judged only the framework's tests would leave most test files unguarded.

So every test sits where its kind says ([the fork](../start/getting-started.md#which-kind-of-test)), narrates a Given then a Then, keeps its doubles out of `src/`, and never sleeps. The hygiene floor — no committed `.only` or `.skip`, an assertion in every test, no two titles alike in a file, a lowercase title — is oxlint's own `vitest` plugin, which `@jterrazz/typescript` turns on in every profile; this package adds only what that plugin has no rule for ([Linting § What oxlint's own `vitest` plugin owns](../reference/linting.md#what-oxlints-own-vitest-plugin-owns)).

## One file, one subject

A spec file answers one question about one subject, and both are written in its path: the folder is the SUBJECT, the file name the ASPECT asked of it — `<specs>/api/events/list/pagination.spec.ts` is the pagination of `GET /events`. A reader who knows the route knows where its specs are, and a change to that route opens one folder.

### The subject, and its standard name

The subject is what the file's chains reach, read statically: an api chain's method and route, a job chain's job, a cli chain's command, a website chain's page, a mobile chain's journey. A file reaches ONE (`one-subject-per-spec`); a file reaching several is several files, and `typescript fix` splits it, each test going with the imports and file-level constants it reads — whole or not at all: where it would have to guess (a file to name, two subjects on one folder, a test in a loop) or would write fewer tests than it read, it leaves the file and the finding says why ([the row](../reference/linting.md#one-subject-per-spec)). What two of the new files still read is written once: the split moves it, exported, into `<lowest common folder>/__setup__/<aspect>.ts` — the aspect of the file it splits — and each file imports it, never a copy per file; the folder is the one the placement law of [the naming recap](#the-naming-recap) names. A declaration that builds a `file()` or a `directory()` stays in the files that read it, since a module no test is may not build a path (`paths-named-in-the-test`).

The folder is the subject's STANDARD name, derived and never listed (`spec-in-subject-folder`), so two repositories never argue it:

| Subject                         | Folder                        |
| ------------------------------- | ----------------------------- |
| `GET /events`                   | `events/list/`                |
| `GET /events/:id`               | `events/get/`                 |
| `POST /events`                  | `events/create/`              |
| `PUT` or `PATCH /events/:id`    | `events/update/`              |
| `DELETE /events/:id`            | `events/delete/`              |
| `GET /events/:id/timeline`      | `events/timeline/`            |
| `GET /health`, a singleton      | `health/get/`                 |
| `GET /market/:symbol/chart`     | `market/chart/`               |
| a method-less route, `ALL /mcp` | `mcp/`, whatever the verb     |
| a job                           | `specs/job/<job>/`            |
| a cli command, `spawn shop`     | `specs/cli/<word>/`, `spawn/` |

How the folder is derived:

- **Collections.** A GET on one segment lists a plural noun and gets anything else.
- **Parameters.** A segment is a parameter when the chain writes the route's template (`.get('/market/:symbol/chart', { params: { symbol: 'btc' } })`), or when it is anything but lowercase words (`42`, `AAPL`, a template hole).
- **An ambiguous word.** A filled path whose word sits right after a collection with more path after it — `btc` in `/indicators/btc/chart` — reads two ways, a value or a segment of the route. `spec-in-subject-folder` files no folder from it and asks for the template, or for `{ params: {} }` when the word is the route's own.
- **Collections English does not mark.** The plural test cannot know them, so a repository names them in `jterrazz.config.ts`: `test: { collections: ['data', 'people'] }`, and `GET /data` is filed under `data/list/`.
- **Routes taken on any method.** A chain cannot tell a route that takes any method (`app.all('/mcp', …)`) from one that takes the verb it sends, so a repository names those there too: `test: { methodless: { '/mcp': 'the MCP transport answers GET and POST' } }`. A POST and a PUT to `/mcp` are then one subject, `ALL /mcp`, filed under `mcp/` and never split by verb. The api run holds the list to the app's own route table, when the app exposes one ([API specs § A route taken on any method](../guides/api-specs.md#a-route-taken-on-any-method)).
- **Commands.** A command is its first word, so a positional argument is never read as a subcommand (`exec('spawn shop')` is `spawn/`). A runner whose commands take several words declares them, `specification.cli(bin, { commands: ['db', 'migrate'] })`, and a command is then every leading word the list holds: `exec('db migrate --dry-run')` is `db/migrate/`.
- **Pages and journeys** have no standard name: the file reaches one, and its folder stays the author's.
- **A test reaching two subjects** cannot be cut. It states what it stands on with a seed rather than a second action.

### The aspect

The file name is the aspect, and the file's one top-level `describe` is titled with it (`one-describe-per-file`), so a failure's first word names its file. An aspect is kebab-case and says which question the file asks — never a name for what fit nowhere else (`misc`, `other`, `basic`, `general`, `more`, `edge-cases`, `tests`, `main`; `spec-named-for-its-aspect`). For an api, the vocabulary to reach for first, advised and not enforced:

| Aspect       | Asks                                            |
| ------------ | ----------------------------------------------- |
| `pagination` | the pages, their size, their cursor             |
| `filters`    | what a query parameter narrows                  |
| `sorting`    | the order a list comes back in                  |
| `language`   | what the `Accept-Language` of a request changes |
| `validation` | what a malformed request is refused with        |
| `not-found`  | what an unknown id answers                      |
| `auth`       | who may, and what the others get                |
| `shape`      | the whole response of the ordinary case         |

A module test is held to the same one `describe`, titled with its SUBJECT rather than an aspect: the symbol of the module it names that the test is about — the one in the folder above its `__tests__/` — read from that module's exports: `__tests__/locale-note.test.tsx` for the `LocaleNote` it renders opens `describe('LocaleNote', …)`. Which export answers, in order, is [`one-describe-per-file`'s row](../reference/linting.md#one-describe-per-file); a test naming no module is titled with its base name.

A file holds at most 400 lines (`spec-file-within-line-limit`); past it, the tests usually group by a prefix of their titles, and that is where the file is cut.

A test's body spans at most 60 lines of gestures (`test-body-within-line-limit`), in a module test as in a spec; the value a `toMatch`, a `toStrictEqual` or a `toEqual` compares is the claim, not a gesture, and `ground-shared-or-inline` caps a `toMatch` one instead. The toolchain's function cap leaves a test file alone, because the file's one `describe` is a function as long as the file; the cap it would have put on each test is this one.

### A specimen's spec

This section matters only to a repository that tests a testing tool. A framework specifies itself against small sample apps it keeps as ground, under `specs/__fixtures__/`. These are SPECIMENS, not the project's product. A spec that drives a specimen specifies the FRAMEWORK, and the route, the job or the command the specimen answers on is no subject of the project: `one-subject-per-spec` and `spec-in-subject-folder` leave it alone.

A spec drives a specimen when either holds:

- **its runner names the shared fixtures** — the specification module, the one that module builds on, or the spec itself when it builds its runner inline. It names them by:
    - a file inside a specimen's folder — the app module, the binary, the script a command runs;
    - or the folder itself, as the root a `server: { command }` of the runner it feeds runs from, written in the call or in a `const` the call names. A root alone does not count: it is where the services read their ground, and no app.
- **it is an integration spec importing the module of the shared fixtures its chains call.**

Where such a spec is filed is the framework's own to say; this package's answer is [Test § A specimen's capability folder](https://github.com/jterrazz/package-test/blob/main/docs/guides/test.md#a-specimens-capability-folder). An application's specs keep the route's folder — its routes are its product.

### What a file shares

A file shares only what its tests share. A SETTING every chain of a file repeats — the same `.clock(…)`, the same `.headers(…)`, the same `.env(…)` — is stated once, on a view of the specification: `const events = api.with({ clock: '2026-03-04T09:30:00Z' })`, every chain of `events` starting with it and its own setups merging over it. A seed and a stub are the Given of one test and stay on its chain; `no-repeated-chain-setting` refuses the setting every chain repeats, and `typescript fix` declares the view. A file-level expectation serves two tests or more, and one a single test reads is written in that test (`expected-constant-shared`). An expectation is never imported from another module of the specs tree (`no-imported-expectation`): a helper the test calls, a stub, the runner are imports; the value a matcher compares is the test's own. The product's own data is the subject's, not an expectation — a spec may compare against `package.json`'s version or a constant the product exports.

## The naming recap

**One folder per verb that reads the disk.** Each verb that takes what a spec stands on has its folder, named for what it holds: `seed()` reads `__seeds__/`, `fixture()` reads `__fixtures__/`, `intercept()` takes what `__setup__/stubs/` declares, `request()` reads `__requests__/`, and `toMatch()` reads `__expected__/`. The inputs come in several kinds because several mechanisms set them up — a database, a working directory, the network, the request itself. The expectation is one kind, because one verb compares every subject.

One rule decides every folder of a spec tree: **a folder whose name starts with `_` is never a subject, and a subject never starts with `_`.** A subject's folder is derived — from a route, a command, a job — so it may take any word (`GET /requests` files under `api/requests/list/`), and only the marks keep the folders that are no subject from colliding with one: a special folder is spelt `__<word>__/`, the spelling the ecosystem already reads as no route (Jest's `__tests__/`, `__mocks__/`). The special folders are a closed list, one in the kit that every tool's globs read (`special-folder-in-closed-list`, `reserved-folder-in-closed-list`):

- `__setup__/` — the TypeScript that prepares specs: a test adapter, a shared value, a helper, a stub facade and its kind folders (`__setup__/stubs/`). Never a spec, never data. It is code: linted, formatted and typechecked like any module, and every module of a specs tree that is no spec, test or runner lives in one (`spec-code-in-setup-folder`).
- `__fixtures__/`, `__expected__/`, `__requests__/`, `__seeds__/` — the GROUND, material a spec names by its path, spelled in full on the line that reads it (`file('./__seeds__/users.sql')`, `directory('../../__fixtures__/shop/')`). The ground names are reserved wherever a test stands on a file, in a module's `__tests__/` under `src/` as much as under `specs/`: the toolchain and the vitest preset ignore all four at any depth, and production code may import nothing from them (`no-test-code-in-production`).

At the specs root, the same five hold what the specifications share — there is no folder of shared things: the placement law below puts a thing at the root exactly when its readers span specifications. Any other `_` name is refused, its fix naming the list: an unknown `__<word>__/` (`__mocks__/`, `__snapshots__/`, `__helpers__/`), a subject that starts with `_`, and an earlier spelling — `_setup/`, `_fixtures/`, `_expected/`, `_requests/` and `_seeds/` name their special folder, and what `_shared/` held moves to the special folders at the specs root.

A folder with a special name but no marks — `setup/`, `seeds/`, `requests/`, `expected/`, `fixtures/`, and `doubles/` for test adapters — is refused where it holds no spec, the fix naming its special folder; a `shared/` holding no spec is refused too, its fix the special folders of the folder that encloses it. Inside a `__setup__/` the names are the code's own, and `__setup__/` holds code alone: a ground folder or a file that is no module inside it is refused, the fix naming the ground folder of its role beside it. `docker/` sits at the project root, outside any row of specs, and is untouched by the rule.

**The specs root holds its specifications and the special folders of what they share, and nothing else** (`specs-root-holds-specifications-and-shared`):

- A repository suite is a first-level folder too ([the third door](#the-third-door-a-repository-suite)).
- A specification folder holds its runners at its ROOT — `<name>.specification.ts`, the one place a runner lives, in every `depth` mode (`specs-at-declared-depth`) — then subject folders, specs and special folders. Any other folder holds subject folders, specs and special folders.
- What the specifications share sits in the special folders of its role at the root: `<specs>/__setup__/`, `<specs>/__fixtures__/`, `<specs>/__seeds__/`, `<specs>/__requests__/`, `<specs>/__expected__/`.
- A seed the specifications share is `<specs>/__seeds__/catalog.sql`, reached as `../../__seeds__/catalog.sql`. Parked at `<specs>/__fixtures__/__seeds__/`, it is file state by its first ground folder, and `verb-reads-its-ground-folder` refuses it, naming `<specs>/__seeds__/`.

**A test adapter is named for the port it replaces**: `<port>.adapter.ts` in a `__setup__/`, whatever its class is called — `class FixedTickerSource implements TickerSourcePort` is `ticker-source.adapter.ts` (`adapter-named-for-its-port`, which reads a class implementing a type imported from outside the specs tree; a double built another way is review's to name). "Fixture" means input data: a file in `__fixtures__/`, or a module test's `__tests__/<file>.fixtures.ts` under `src/` — under `specs/` a `*.fixtures.ts` is refused, and the module is named for what it holds.

Three further rules decide WHETHER and WHERE shared things live, and they are one question asked from three sides. **The placement law is the same for code and for data: a shared thing sits in the reserved folder of the LOWEST folder every one of its readers shares** — beside them when one leaf reads it, in `events/__seeds__/` or `events/__setup__/` when `events/list/` and `events/get/` do, and in the special folders at the specs root only when its readers span specifications. `ground-shared-or-inline` holds data to it, `setup-module-at-lowest-common-folder` holds a `__setup__/` module to it, read on the imports: a module one spec alone imports belongs in that spec, as a file one test alone reads does.

**A file exists only if it is shared** (`ground-shared-or-inline`, both halves autofixed by `typescript fix`):

- **One reader: write it in place.** A golden or a request ONE test reads, and no module test names, belongs in that test — the value `toMatch` compares, the request's text or its body.
- **The caps.** The exceptions are a directory tree, a binary file, a text no literal survives in place (one opening on a line break whose lines share an indentation, which the comparison's dedent strips from either form), or a value longer than its role's cap: 30 lines for a request or a body, 150 for an expectation. The caps hold the other way too: a request written in the test past 30 lines, or an expectation past 150, belongs in a file beside the test.
- **Always files.** A `__fixtures__/` entry is file state and stays a file, and so does a seed: SQL is never written in a test, so a seed one test reads lives beside it in `./__seeds__/`.
- **Several readers: the lowest folder they share.** An entry kept above it — the shared ground's included — belongs in that folder's ground of the same role: `<specs>/__seeds__/x.sql` read by one leaf becomes `<leaf>/__seeds__/x.sql`. Every reader counts where it stands: a test at its folder, a runner at its specification root, a `__setup__/` module at the folder that owns that `__setup__/`.
- **Readers outside the specs tree.** Only a reader outside the specs tree — a module test, the member's Makefile or its vitest config — keeps an entry where it is whatever the specs say, by a relative literal, the literal pieces `named-path-exists` reads, or a path spelled from the member root (`specs/…`).

**What several leaves share lives there once**: an entry two leaves hold byte for byte, under the same role, is a copy whatever each is called, and belongs once in the ground of the lowest folder they share (`no-duplicate-ground`; two leaves that mean to diverge tomorrow diverge the day they do, and a copy held until then is debt the ratchet records; when the copies share a name, `typescript fix` moves one up, deletes the others and rewrites every relative literal that named one — copies of several names wait for the author to pick the name).

**A path leaves its leaf only by climbing**: a `file()` or `directory()` whose target is neither under the referring spec's own directory, nor under the ground of a folder that encloses it, nor under one of the four at the specs root, is an error (`no-reach-into-sibling-ground`) — a leaf reaching into a sibling's ground is one such path. Climbing is how sharing reads: `events/list/` and `events/get/` reach `../__seeds__/` of `events/`, and a route's leaf reaches the ground of the route above it (`map/pois/detail/` reads `../__seeds__/base.sql` of `map/pois/`).

So write ground and helpers local first: the day a second leaf copies an entry, `no-duplicate-ground` moves it up to the folder they share, and the day only one leaf is left, `ground-shared-or-inline` moves it back down — and the day only one test is left, `ground-shared-or-inline` writes it into that test. Where a shared thing sits says who depends on it: a reader trusts the folder to tell them what a change reaches, and it does only while the thing sits exactly as high as its readers.

Two more hold what each path says. **The verb and the folder agree**: `seed()` reads `__seeds__/`, `request()` and a request body read `__requests__/`, `fixture()` reads `__fixtures__/`, a golden reads `__expected__/` (`verb-reads-its-ground-folder`). **What a path names exists**, of the kind its wrapper says — and a path a test resolves from its own directory with literal pieces alone (`resolve(import.meta.dirname, '..', 'fixtures', 'gone')`, one piece only when spelled `./` or `../` — a lone bare piece is as often a folder the test makes) too, a module test's as a spec's (`named-path-exists`, the checker, reported where the path is written; the runtime refuses the same with the path it resolved to). A fixer that moves ground rewrites every whole relative literal that named it, a module test's included; a path built from pieces, or spelled into a command a process runs, is the author's to rewrite, and `named-path-exists` names it once the ground has moved. And a path is **built in the test that stands on it**: it resolves against the spec that starts the chain, so a `file()` built in a shared helper would name a different file for every spec that reaches it — a helper takes the `file()` as a parameter (`paths-named-in-the-test`).

| Thing           | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specs root      | `specs/` (`api/`, `job/`, `cli/`, `integration/`, `website/`, `mobile/`, `lint/`) — one folder per constructor, beside the special folders of what the specifications share: `__setup__/`, `__fixtures__/`, `__seeds__/`, `__requests__/`, `__expected__/`, and any repository suite ([the third door](#the-third-door-a-repository-suite))                                                                                                          |
| Specification   | `specs/<specification>/<name>.specification.ts` (at the specification root)                                                                                                                                                                                                                                                                                                                                                                          |
| Instances       | `api`, `job`, `cli`, `integration`, `website`, `mobile`, `lint` — enforced by the destructuring (`no-runner-alias`)                                                                                                                                                                                                                                                                                                                                  |
| Spec file       | `specs/<specification>/<subject>/<aspect>.spec.ts` — the assembled product's word (`file-suffix-matches-place`); the subject's folder derived where the specification has one ([One file, one subject](#one-file-one-subject))                                                                                                                                                                                                                       |
| Spec document   | `<case>.spec.yaml`, beside the spec it belongs to — never under `__expected__/` ([Spec documents](../guides/spec-documents.md))                                                                                                                                                                                                                                                                                                                      |
| Module test     | `__tests__/<file>.test.ts`, in the folder of `<file>.ts` (under `src/`)                                                                                                                                                                                                                                                                                                                                                                              |
| Component test  | `__tests__/<file>.test.tsx`, in the folder of `<file>.tsx` — or of the `<file>.ts` of a hook or a DOM function; beside it under `specs/` ([Component specs](../guides/component-specs.md))                                                                                                                                                                                                                                                           |
| Module fixtures | `__tests__/<file>.fixtures.ts`, beside the `.test.ts` under `src/` (typed exports) — outside `specs/`, the one name the tests of a module share code or data through, test material only a test imports (`fixtures-imported-by-tests-only`) — what the module tests of several folders share sits in the `__tests__/` of the lowest folder they share (`test-in-its-tests-folder`); never under `specs/`, where a fixture is data in `__fixtures__/` |
| Setup           | `__setup__/<meaning>.ts`, in the lowest folder its readers share — a test adapter `__setup__/<port>.adapter.ts`, named for the port it replaces                                                                                                                                                                                                                                                                                                      |
| Stubs           | `__setup__/stubs/<name>.stubs.ts` (facade) · `__setup__/stubs/<kind>/<name>.ts` (unit, kind ∈ http\|openai\|anthropic — the stub builders the package exports)                                                                                                                                                                                                                                                                                       |
| Stub data       | `__fixtures__/<name>.json` (served, imported by its unit) · `__setup__/stubs/<kind>/<name>.request.ts` (matched)                                                                                                                                                                                                                                                                                                                                     |
| Requests        | what a spec sends: `__requests__/<name>.http`, read by `.request(file('./__requests__/<name>.http'))`, and a body `__requests__/<name>.<ext>`, sent by `.post(path, file('./__requests__/<name>.json'))`                                                                                                                                                                                                                                             |
| Seeds           | database state: `__seeds__/<name>.sql`, read by `.seed(file('./__seeds__/<name>.sql'))` — beside its test, or at the level of the tests that share it; SQL is never written in a test                                                                                                                                                                                                                                                                |
| Fixtures        | `__fixtures__/<name>` (file state) — in the lowest folder its readers share; across specifications the pool `specs/__fixtures__/`, reached by the path that climbs to it, as `<specs>/__seeds__/` is for seeds                                                                                                                                                                                                                                       |
| Goldens         | `__expected__/<name>.<ext>` (everything asserted, response `.http` included), read by `.toMatch(file('./__expected__/<name>.<ext>'))`; a tree by `.toMatch(directory('./__expected__/<name>/'))`                                                                                                                                                                                                                                                     |
| Service keys    | name the service: the report prints the key, and its kebab-case form is the folder its init script sits in                                                                                                                                                                                                                                                                                                                                           |
| Framework env   | `TEST_UPDATE`                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## The third door: a repository suite

Two doors carry every test the fork names: a UNIT sits in the `__tests__/` of the folder of the module it covers (`<file>.test.ts`, `test-in-its-tests-folder`), and the ASSEMBLED product sits under `specs/<specification>/` and reaches the runner that folder promises (`<aspect>.spec.ts`, `file-suffix-matches-place` and `specification-test-uses-its-runner`). A few specifications have neither address, and they are not mistakes.

### What has no address of its own

What they specify is a REPOSITORY's own surface read as files: what its packed tarball carries, the links its shipped pages hold, the files a build is expected to write. There is no one module to sit beside — they resolve every module there is — and no runner to reach, since nothing is started. Put under a specification folder, `specification-test-uses-its-runner` refuses them ("reaches no runner"); put beside a module under `src/`, `test-in-its-tests-folder` refuses them ("no neighbour `exports.ts` found"). Both refusals are right, and a legitimate file shape with no green position is a hole in the conventions, not a defect in the file.

### The door, and the depth it is judged by

**The third door is a FIRST-LEVEL folder under `specs/` that is not a specification name.** It is a repository suite: it covers a TREE rather than a product served through an entry. `file-suffix-matches-place`'s rename clause does not reach it, `specification-test-uses-its-runner` and `specification-folder-has-its-runner` do not reach it, and `specs-at-declared-depth`'s declared depth is what judges its shape.

**`specs-at-declared-depth` judges a suite exactly as it judges a specification.** The suite folder is the first level and the tests sit one level down, in a folder named for what they cover: at the default depth, `specs/<suite>/<domain>/<aspect>.test.ts`. A test written straight into the suite folder is refused for the same reason one at a specification root is — the level that says what a file covers would be missing.

**A suite is a door because it holds tests.** One test is enough: a first-level folder holding a single `.test.ts` is a suite, and legal. A first-level folder that holds none — a `support/` of helpers and mocks — is no suite, no specification and no special folder, and `specs-at-declared-depth` refuses each module in it, a runner included, in every mode: a runner lives at the root of the specification it builds, a test helper in the `__setup__/` of the lowest folder its tests share, a fixture under `specs/__fixtures__/`.

### The one shared suite name

One suite carries a name every repository shares, because two repositories inventing two names for one idea is the drift a vocabulary exists to stop: a package's own published SURFACE is `surface/`. Every other suite is named for what it covers. The rules a repository ships are no suite: they are the lint specification's subject, and `specs/lint/` is that specification's folder ([Lint specs](../guides/lint-specs.md)).

```text
specs/
└── surface/                      # what the package publishes
    └── package/
        ├── tarball.test.ts       # the files `npm pack` writes, and none it should not
        └── shipped-links.test.ts # every link a shipped page holds resolves
```

What a consumer DOES with the package — loading a subpath, compiling against its declarations, running its bin — is no suite's: it is a cli spec on the tarball installed as a consumer installs it ([Which test earns its place](#which-test-earns-its-place)).

### The suffix, and the one thing the door does not license

The files there carry `.test.ts` — the UNIT's word — because what they prove is read without assembling anything, and `unit()` is what collects them (`roots`, or `include` outright). A specification helper would put them in a project whose budget and services they never use.

One thing the door does not license: a module test parked under `specs/` to escape `test-in-its-tests-folder`. The question to ask of a file before it goes through is whether any single module could hold its test — if one could, that module is its address.

## Process rules (review-borne)

Three rules cannot be mechanized — they turn on judgement no single channel can settle. They are listed in the catalogue for completeness, but their full rationale lives here.

### The folder follows the assets

The grouping criterion: a test that owns **its own** asset directories (`__fixtures__/`, `__expected__/`, `__seeds__/`, …) gets **its own** domain folder; specs **without local assets** (or sharing the `specs/__fixtures__/` pool) group as sibling `<aspect>.spec.ts` files inside a named **group** folder. Both shapes are legal — the assets decide, and a nascent single-test domain is legitimate. The static rule `specs-at-declared-depth` checks only placement; which of the two shapes is right is the review call.

Placement itself is **declared**, because a spec tree may legitimately have a shape this package cannot know:

```jsonc
"jterrazz/specs-at-declared-depth": ["error", { "depth": "specification-domain" }] // the default
```

| `depth`                  | The tree                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'specification-domain'` | the default — `specs/<specification>/<domain>/<aspect>.spec.ts`, `*.specification.ts` at the specification root; an api or cli spec's domain is its subject's standard name, one folder or several (`events/list/`) |
| `'specification'`        | the assets decide the folder — a spec at the specification root (`specs/<specification>/<aspect>.spec.ts`) OR one domain down, never deeper; `*.specification.ts` at the specification root                         |
| `'mirror'`               | the tree mirrors a structure outside itself (a command tree, a source tree): a spec at any depth ≥ 1, named `<dir>/<dir>.spec.ts`                                                                                   |
| `'off'`                  | no placement check — for a tree whose shape is guarded by something stronger and project-specific                                                                                                                   |

A project states the shape it has — `specification` when asset-less tests sit beside their siblings at the specification root, `mirror` when the tree mirrors something outside itself — and keeps a checked shape, instead of switching the rule off and keeping none.

One clause of the rule is not the project's to declare, and holds in every mode, `off` included: **a folder named `__fixtures__/`, `__expected__/`, `__requests__/` or `__seeds__/` is ground, never a specification, domain or suite folder**, so no spec lives inside one — and a domain named with one of the four words is refused. Depth is a shape a tree may choose; the ground/member split is the naming law recapped in [The naming recap](#the-naming-recap).

Ground is not always inert. It may be **code** the specs stand on — the build of the subject under test, a harness the runner spawns — and code carries its unit test beside it — a specs tree holds no `__tests__/`. So the clause lets exactly one pairing through: `<module>.test.ts` NEXT to the `<module>.ts` it is named after, inside the ground it belongs to. A test with no module beside it, or a `*.specification.ts`, is a spec that wandered in and is still reported — which is why the clause needs no `off`, and why no project has to switch off a rule it cannot switch off.

### `output-asserted-as-a-golden` — the whole result, not a cluster of greps

**Every test compares its whole result.** A response, a json, a table, a tool's output (a linter, a compiler, a product CLI) is asserted as a **full snapshot per scoped use case** — written where the test reads it, ``expect(result.response).toMatch(`…`)``, or in a file when several tests share it — and a precise assertion on one property is allowed only beside it, stating what the case is about (`no-vitest-snapshot` mechanizes it for a response, a json and a table). Each case gets **its own fixture project** (its small valid/invalid files) — the fixture IS the Given, no shared `beforeAll` state — and the assertion is the whole snapshot (``expect(result.stdout).toMatch(`…`)`` + `exitCode`), volatile parts covered by tokens, written by `TEST_UPDATE=1` from an empty `toMatch('')`.

`.grep()` / `toContain` remain the **scalpel** — targeted probes, never the default mode. They are legitimate only for:

- **(a)** assertions of **absence**;
- **(b)** output **cut at an arbitrary instant** (`waitFor`, a long-running process);
- **(c)** **container-log probes**;
- **(d)** asserting **rule ids** in the E2E lint specs (avoiding coupling to a third-party binary's exact format);
- **(e)** probes into **third-party-formatted** output.

Every other use is converted to a full snapshot. A single "kitchen-sink" project + full snapshot serves as the whole-surface regression net (it churns — that is its job). The static channel cannot tell a legitimate grep from a lazy one, hence the process channel. The mechanized boundary for a result (a response, a json or a table read and never compared whole) is `no-vitest-snapshot`, and a lone HTTP-status probe `no-status-only-test`; the negative-fixture guard is `negative-golden-frozen` (wrapped forms) plus a process rule for helper-routed residue.

## Source-code architecture

The `architecture` family governs the source tree rather than the spec tree, and it splits in two.

**The layer map is the project's to declare.** This package cannot know another repository's architecture, so it ships no layer rule: a project states its layers in `jterrazz.config.ts`, under `typescript.architecture`, and `@jterrazz/typescript`'s Architecture pass holds its imports to them. What THIS repository declares, and why each sanctioned edge exists, is [Architecture](https://github.com/jterrazz/package-test/blob/main/docs/concepts/architecture.md) — a consumer's own map is its own chapter's, written the same way.

**The test-file rules need no declaration.** `test-in-its-tests-folder` (a module's test sits in the `__tests__/` of its folder) and `no-module-mock` (no `vi.mock`, `__mocks__/` or data-asset imports under `src/`) hold in any repository that adopts this preset — they are part of the floor described above, not of the layer map. A module's typed fixtures are a `__tests__/<file>.fixtures.ts` beside its test, as the naming recap says.

## A message teaches

A finding is the only page of the catalogue most readers ever see, so it carries what the reader needs to act without opening another: **what was found** and where, **why** the convention holds, **the fix for this case** — its paths and names, and `typescript fix` when a fixer does it — and **where to read** the rule whole. A message that names the fault and stops sends its reader to the chapter for what the line could have said; one that states the rule and not the case sends them back to the code to find out what it saw.

The four parts are the same everywhere a rule speaks — a static rule, a checker pass, a refusal the runtime throws — and none is optional. How each channel prints them is [Linting](../reference/linting.md#what-a-finding-says)'s. The runtime throws nothing else: an error only the framework can cause — a broken invariant of its own — says so, and that the bug is not the reader's to fix.

## What stays human, and why

Every convention a machine can settle is a row with a channel. These are the
ones no channel can decide — listed with the reason, and with what the machine
takes of them anyway, so neither side is silently dropped.

| Convention                                                                                                                                                          | Why no channel decides it                                                                                 | What the machine takes                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `folder-follows-assets` grouping — own domain vs sibling aspects                                                                                                    | what the assets will become is a reading of the domain                                                    | `ground-beside-its-only-reader` flags the one-owner half                                                                                                                  |
| `output-asserted-as-a-golden` the legitimacy of a probe                                                                                                             | absence, cut output and a third-party format are meanings, not shapes                                     | `result-compared-whole` / `no-status-only-test` / `no-probe-cluster` draw the cluster boundary                                                                            |
| `negative-golden-frozen` residue routed through a helper                                                                                                            | inter-procedural analysis is out of an oxlint JS plugin's reach                                           | `negative-golden-frozen`'s bounded heuristic                                                                                                                              |
| the truth of a Given/Then sentence, or of a title                                                                                                                   | a sentence can be well-formed and false                                                                   | `given-and-then-markers-present`, `when-between-given-and-then`, `marker-on-one-line` and `vitest/valid-title` hold the shape                                             |
| whether an updated golden is RIGHT                                                                                                                                  | correctness is the diff, read at review                                                                   | `no-volatile-literal` holds the volatile literals, in a document and under `__expected__/` alike; the pinned-value half of ground waits for `no-unseeded-value-in-golden` |
| whether an allow-listed `vi.mock` has no seam                                                                                                                       | the claim is disputable, and recorded in the entry's `reason`                                             | `no-module-mock` holds the list, and an entry with no reason clears nothing                                                                                               |
| `exact` versus `within` when both disambiguate                                                                                                                      | taste between two user-facing forms                                                                       | `test-id-states-what-is-missing` forces a reason on the escape hatch; `target-matches-one-element` offers both                                                            |
| `expected-named-for-its-content` — an expected file is named for what it HOLDS, not for the parameters that produced it: `limit-one.http` → `single-quiz-page.http` | what a response holds is a reading of its body; a name built from the request is still a well-formed name | —                                                                                                                                                                         |
| one fixture per answer of the system                                                                                                                                | a reading of what the chain proves                                                                        | `document-description-unique` holds unique descriptions                                                                                                                   |
| stub realism                                                                                                                                                        | only a recorded exchange could judge it                                                                   | —                                                                                                                                                                         |
| whether a module test earns its place — a pure algorithm, or a failure no end-to-end path provokes                                                                  | it is a reading of the product and of every path its specs drive                                          | the `expectations` rules hold the oracle; a surviving mutant names the weak test                                                                                          |
| the depth a repository declares                                                                                                                                     | reviewed once, when the tree is born                                                                      | `specs-at-declared-depth` thereafter                                                                                                                                      |

## The backlog — the criterion written, coded on its first occurrence

A rule is written when its defect class has been SEEN once and its criterion is decidable. A class nobody has seen yet is not a rule: it is a line here, with the criterion it would be written against, so the day it appears the guard is a translation rather than a design. A dry run of the whole catalogue over every repository its author maintains is what moves a line either way.

| Line                                     | The criterion, ready to code                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-intercept-in-a-loop`                 | an `.intercept(` call inside a `for`/`while` body, or a `.map(`/`forEach(` callback, in a test file                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `no-marker-inside-a-declaration`         | a Given/When/Then marker whose offset falls inside a `VariableDeclaration` with ≥ 2 declarators                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `no-domain-repeated-in-golden-path`      | a `toMatch(file(` path whose directory part repeats the leaf's own domain folder                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `no-ground-under-a-screen-specification` | a `__seeds__/` or `__requests__/` under a specification whose runner constructs `website()` or `mobile()` — a screen owns no database                                                                                                                                                                                                                                                                                                                                                                                           |
| `no-unseeded-value-in-golden`            | a uuid, or an iso8601 whose time is NOT midnight UTC, in a file under `__expected__/` that appears in no `__seeds__/`, `__requests__/`, `__fixtures__/`, `stubs/` or referring test of the same leaf, nor in the `specs/__fixtures__/` pool. The hour is part of the criterion: a clock read during a run is never exactly midnight, a publication date always is ([ADR-006](https://github.com/jterrazz/package-test/blob/main/docs/decisions/006-the-catalogue-reaches-a-file-by-its-role.md) records what the dry run found) |
| `no-golden-in-module-test`               | a `toMatch(file(…))` in a `module`-role file OUTSIDE every `specs/` tree: a unit test standing on a golden file is an integration spec, and `specs/integration/` is where it belongs (`golden-path-has-extension` holds the same call inside a specs tree)                                                                                                                                                                                                                                                                      |
| `no-unreachable-only-negative`           | a test whose stub list is `http.unreachable()` on every feed and whose assertions name `result.error` alone: the case proves the call FAILED, not that it never happened. The fix it teaches is [`http.never(request)`](../reference/stubs.md#never--a-call-that-must-not-happen)                                                                                                                                                                                                                                               |
| `no-empty-golden`                        | a file under `__expected__/` whose trimmed content is exactly `{{any}}`                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `no-duplicate-stub-payload`              | two response payloads with the same content hash under one `stubs/` tree, outside the shared pool                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `no-inline-body-beside-requests`         | a request body written inline in a test that also carries a `__requests__/` directory                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `no-retry`                               | a `retry:` option on `test(`/`describe(`, or `test.retry(`, or `retry` in a vitest config — react-query's `retry: false` is not one                                                                                                                                                                                                                                                                                                                                                                                             |
| `no-namespace-spy`                       | a `vi.spyOn(<namespace import>, …)` — a module's own export spied through its namespace object                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Parked**, for a criterion that is not settled: **`no-negated-golden`** (15 hits across those repositories, every one a `toMatch(/re/)` the criterion must exclude) and **`no-unreachable-stub`** (the criterion has to compare filter arguments, not just methods and urls).

## Changing the conventions

- A rule a machine can check is added to the code — its row in `lint/consumer/catalogue/manifest.ts` beside its implementation — and `npm run docs` regenerates the catalogue. It is never written here: the code is its one source.
- A principle, or a criterion no machine can settle, is added here, as a process rule or in [What stays human](#what-stays-human-and-why).
- A defect class seen once and decidable becomes a rule; one nobody has seen yet is a line of [the backlog](#the-backlog--the-criterion-written-coded-on-its-first-occurrence).

## Pitfalls

- **Treating these docs as the spec.** They explain and illustrate; this constitution and the generated catalogue ([Linting](../reference/linting.md)) decide. When the docs and the catalogue disagree, the docs are fixed in the same change.
- **Editing the generated catalogue by hand.** The [Linting](../reference/linting.md) catalogue is GENERATED from `lint/consumer/catalogue/manifest.ts` — a hand edit is overwritten by the next `npm run docs` and fails the freshness meta-test. Change the rule's text in the code; regenerate.

## Related

[Getting started](../start/getting-started.md) · [Time and doubles](../reference/time-and-doubles.md) · [Assertions](../reference/assertions.md) · [Linting](../reference/linting.md)
