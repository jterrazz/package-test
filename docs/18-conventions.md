# 18 — Conventions: the constitution

This chapter is the **constitution**: the principles, the non-mechanizable criteria, and the design rationales behind the conventions. It is hand-maintained and stable.

The **mechanized per-rule catalogue** does not live here — it is **generated from the code** (`lint/consumer/catalogue/manifest.ts`, where each rule carries its own normative text): the consumer rules into the [19 — Linting](19-linting.md) catalogue, the package's own into [03 — Testing § The package's own rules](03-testing.md#the-packages-own-rules).

This is the **docs-as-code inversion**: the code is the source of truth for the mechanized rules (a rule and its normative text live together, so they cannot drift), and this constitution is the source of truth for the principles. There is **no duplication** — a machine-checkable rule is written once, in the code. The broader repo-layout doctrine this follows — a written corpus, thin injection layers, a compiler that projects; committed projections against CI-built presentations — is `jterrazz-studio`'s repo-structure chapter, its canonical home for every language.

Guiding aim: **most enforcement is programmatic, not manual review.**

Which CHANNEL holds a given rule — statique, checker, runtime, process, and the meta-test and type channels that double them — is not this chapter's: it is [01 — Architecture](01-architecture.md), where the shape of the enforcement machinery is drawn. What follows is what the rules SAY and what a reviewer must judge.

## The rule families

The catalogue is organized by family. What each family judges is its section heading in the generated catalogue of [19 — Linting](19-linting.md), rendered from `lint/consumer/catalogue/families.ts`; that catalogue also carries the normative sentence and channel of every rule, and the chapters the table names illustrate each family's usage.

| Family         | Explained in                                                                         |
| -------------- | ------------------------------------------------------------------------------------ |
| `setup`        | [02](02-developing.md), [07](07-component.md), [10](10-api.md), [17](17-services.md) |
| `chain`        | [10](10-api.md), [11](11-job.md), [12](12-cli.md)                                    |
| `layout`       | [02](02-developing.md), [14](14-assertions.md)                                       |
| `expectations` | [14](14-assertions.md), [15](15-tokens.md), [20](20-documents.md)                    |
| `world`        | [16](16-stubs.md), [17](17-services.md)                                              |
| `elements`     | [08](08-website.md), [09](09-mobile.md)                                              |
| `imports`      | [02](02-developing.md)                                                               |
| `architecture` | below · [01](01-architecture.md) for this repo's own layer map                       |
| `catalogue`    | [03](03-testing.md#the-packages-own-rules), this package's own rules                 |

## The reach of the conventions

The framework and the conventions do not have the same scope, and confusing the two is the commonest misreading of this constitution. `specification.*` — with its seeds, fixtures, stubs, goldens and containers — is for specifying a **surface** something is served through: an HTTP API, a background job, a CLI, a rendered page, a native screen. A plain unit test of a pure function has no such surface and needs none of it.

A **rendered component** needs no RUNNER — nothing is started, so it has no constructor and no `*.specification.ts` — and it does need a real browser, a Vite pipeline and a network double, every one of which the framework owns. So the fork is the SUBJECT, not the amount of machinery: one unit — a module, a component — sits beside its code and is judged by its suffix (`<file>.test.ts`, `<file>.test.tsx`); the assembled product, reached through an entry, sits under `specs/`. [07 — Component specs](07-component.md) holds the rendered half.

The conventions bind **every test file of the repository**, that plain unit test included, whether or not `@jterrazz/test` is imported in it. A test is a test: it sits beside the module it covers (`test-beside-its-module`), it narrates its Given then its Then (`given-and-then-markers-present`), it keeps its doubles out of `src/` (`no-module-mock`), and it stays honest under the hygiene floor — no committed `.only`/`.skip`, an assertion in every test, no two literal titles alike in a file, a lowercase title. That floor is oxlint's own `vitest` plugin, which `@jterrazz/typescript` turns on over the test globs in every profile; this package keeps only what the plugin has no counterpart for — the arbitrary-sleep ban (`no-sleep`), which reaches every test file, since a sleep beside a module waits as blindly as one under `specs/`, and the spec-document mirrors. Every one of these is mechanized, so its normative sentence lives in the catalogue ([19 — Linting](19-linting.md)) and not here.

The reason for the wide reach: a repository has **one** way to write a test, so a reader moving between a sibling module test and a spec of a surface reads the same shape and the tooling has a single target. A rule that applied only to framework tests would leave the majority of test files — the plain ones — unguarded.

## The third door: a repository suite

Two doors carry every test the fork names: a UNIT sits beside the module it covers (`<file>.test.ts`, `test-beside-its-module`), and the ASSEMBLED product sits under `specs/<facet>/` and reaches the runner that folder promises (`<aspect>.spec.ts`, `file-suffix-matches-place` and `facet-test-uses-its-runner`). A few specifications have neither address, and they are not mistakes.

### What has no address of its own

What they specify is a REPOSITORY's own surface: the subpaths its `package.json` publishes, a `.d.ts` beside every `.js` it ships, the lint guards a tree owes, the files a build is expected to write. There is no one module to sit beside — they resolve every module there is — and no runner to reach, since nothing is started. Put under a facet folder, `facet-test-uses-its-runner` refuses them ("reaches no runner"); put beside a module under `src/`, `test-beside-its-module` refuses them ("no neighbour `exports.ts` found"). Both refusals are right, and a legitimate file shape with no green position is a hole in the conventions, not a defect in the file.

### The door, and the depth it is judged by

**The third door is a FIRST-LEVEL folder under `specs/` that is not a facet name.** It is a repository suite: it covers a TREE rather than a product served through an entry. `file-suffix-matches-place`'s rename clause does not reach it, `facet-test-uses-its-runner` and `facet-folder-has-specification` do not reach it, and `specs-at-declared-depth`'s declared depth is what judges its shape.

**`specs-at-declared-depth` judges a suite exactly as it judges a facet.** The suite folder is the first level and the tests sit one level down, in a folder named for what they cover: at the default depth, `specs/<suite>/<domain>/<aspect>.test.ts`. A test written straight into the suite folder is refused for the same reason one at a facet root is — the level that says what a file covers would be missing. This package's own `specs/lint/` is two levels deep for that reason.

**A suite is a door because it holds tests.** One test is enough: a first-level folder holding a single `.test.ts` is a suite, and legal. A first-level folder that holds none — a `support/` of helpers and mocks — is no suite, no facet and not `_shared/`, and `specs-at-declared-depth` refuses each module in it, a runner included, in every mode: a runner lives at the root of the facet it builds, a test helper in the `_setup/` of the lowest folder its tests share, a fixture under `specs/_shared/_fixtures/`.

### The two names the estate shares

Two suites carry names the whole estate shares, because two repositories inventing two names for one idea is the drift a vocabulary exists to stop: a package's own published SURFACE is `surface/`, and a repository's own lint guards are `lint/`. Every other suite is named for what it covers.

```text
specs/
├── surface/                      # what the package publishes
│   └── package/
│       ├── exports.test.ts       # every subpath the manifest resolves
│       └── declarations.test.ts  # a `.d.ts` beside each `.js` it ships
└── lint/                         # the guards the repository's own tree owes
    └── <rule-id>/
        ├── <case>.spec.yaml      # a tree in, the command, the normalised report out
        └── _fixtures/             # the trees its documents lint
```

### The suffix, and the one thing the door does not license

The files there carry `.test.ts` — the UNIT's word — because what they prove is read without assembling anything, and `unit()` is what collects them (`roots`, or `include` outright). A facet helper would put them in a project whose budget and services they never use.

One thing the door does not license: a module test parked under `specs/` to escape `test-beside-its-module`. The question to ask of a file before it goes through is whether any single module could hold its test — if one could, that module is its address.

## Process rules (review-borne)

Three rules cannot be mechanized — they turn on judgement no single channel can settle. They are listed in the catalogue for completeness, but their full rationale lives here.

### The folder follows the assets

The grouping criterion: a test that owns **its own** asset directories (`_fixtures/`, `_expected/`, `_seeds/`, …) gets **its own** domain folder; specs **without local assets** (or sharing the `specs/_shared/_fixtures/` pool) group as sibling `<aspect>.spec.ts` files inside a named **group** folder. Both shapes are legal — the assets decide, and a nascent single-test domain is legitimate. The static rule `specs-at-declared-depth` checks only placement; which of the two shapes is right is the review call.

Placement itself is **declared**, because a spec tree may legitimately have a shape this package cannot know:

```jsonc
"jterrazz/specs-at-declared-depth": ["error", { "depth": "facet-domain" }] // the default
```

| `depth`          | The tree                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'facet-domain'` | the default — `specs/<facet>/<domain>/<aspect>.spec.ts`, `*.specification.ts` at the facet root; an api or cli spec's domain is its subject's standard name, one folder or several (`events/list/`) |
| `'facet'`        | the assets decide the folder — a spec at the facet root (`specs/<facet>/<aspect>.spec.ts`) OR one domain down, never deeper; `*.specification.ts` at the facet root                                 |
| `'mirror'`       | the tree mirrors a structure outside itself (a command tree, a source tree): a spec at any depth ≥ 1, named `<dir>/<dir>.spec.ts`                                                                   |
| `'off'`          | no placement check — for a tree whose shape is guarded by something stronger and project-specific                                                                                                   |

A project states the shape it has — `facet` when asset-less tests sit beside their siblings at the facet root, `mirror` when the tree mirrors something outside itself — and keeps a checked shape, instead of switching the rule off and keeping none.

One clause of the rule is not the project's to declare, and holds in every mode, `off` included: **a folder named `_fixtures/`, `_expected/`, `_requests/` or `_seeds/` is ground, never a facet, domain or suite folder**, so no spec lives inside one — and a domain named with one of the four words is refused. Depth is a shape a tree may choose; the ground/member split is the naming law recapped in [The naming recap](#the-naming-recap).

Ground is not always inert. It may be **code** the specs stand on — the build of the subject under test, a harness the runner spawns — and code carries its unit test as a sibling under [`test-beside-its-module`](#source-code-architecture). So the clause lets exactly one pairing through: `<module>.test.ts` NEXT to the `<module>.ts` it is named after, inside the ground it belongs to. A test with no module beside it, or a `*.specification.ts`, is a spec that wandered in and is still reported — which is why the clause needs no `off`, and why no project has to switch off a rule it cannot switch off.

### `output-asserted-as-a-golden` — the whole result, not a cluster of greps

**Every test compares its whole result.** A response, a json, a table, a tool's output (a linter, a compiler, a product CLI) is asserted as a **full snapshot per scoped use case** — written where the test reads it, ``expect(result.response).toMatch(`…`)``, or in a file when several tests share it — and a precise assertion on one property is allowed only beside it, stating what the case is about (`no-vitest-snapshot` mechanizes it for a response, a json and a table). Each case gets **its own fixture project** (its small valid/invalid files) — the fixture IS the Given, no shared `beforeAll` state — and the assertion is the whole snapshot (``expect(result.stdout).toMatch(`…`)`` + `exitCode`), volatile parts covered by tokens, written by `TEST_UPDATE=1` from an empty `toMatch('')`.

`.grep()` / `toContain` remain the **scalpel** — targeted probes, never the default mode. They are legitimate only for:

- **(a)** assertions of **absence**;
- **(b)** output **cut at an arbitrary instant** (`waitFor`, a long-running process);
- **(c)** **container-log probes**;
- **(d)** asserting **rule ids** in the E2E lint specs (avoiding coupling to a third-party binary's exact format);
- **(e)** probes into **third-party-formatted** output.

Every other use is converted to a full snapshot. A single "kitchen-sink" project + full snapshot serves as the whole-surface regression net (it churns — that is its job). The static channel cannot tell a legitimate grep from a lazy one, hence the process channel. The mechanized boundary for a result (a response, a json or a table read and never compared whole) is `no-vitest-snapshot`, and a lone HTTP-status probe `no-status-only-test`; the negative-fixture guard is `negative-golden-frozen` (wrapped forms) plus a process rule for helper-routed residue.

## One file, one subject

A spec file answers one question about one subject, and both are written in its path: the folder is the SUBJECT, the file name the ASPECT asked of it — `<specs>/api/events/list/pagination.spec.ts` is the pagination of `GET /events`. A reader who knows the route knows where its specs are, and a change to that route opens one folder.

### The subject, and its standard name

The subject is what the file's chains reach, read statically: an api chain's method and route, a job chain's job, a cli chain's command, a website chain's page, a mobile chain's journey. A file reaches ONE (`one-subject-per-spec`); a file reaching several is several files, and `make fix` splits it, each test going with the imports and file-level constants it reads. What two of the new files still read is written once: the split moves it, exported, into `<lowest common folder>/_setup/<aspect>.ts` — the aspect of the file it splits — and each file imports it, never a copy per file; the folder is the one the placement law of [the naming recap](#the-naming-recap) names. A declaration that builds a `file()` or a `directory()` stays in the files that read it, since a module no test is may not build a path (`paths-named-in-the-test`).

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

A GET on one segment lists a plural noun and gets anything else, and a segment is a parameter when the chain writes the route's template (`.get('/market/:symbol/chart', { params: { symbol: 'btc' } })`) or when it is anything but lowercase words (`42`, `AAPL`, a template hole). A filled path whose word sits right after a collection with more path after it — `btc` in `/indicators/btc/chart` — reads two ways, a value or a segment of the route: `spec-in-subject-folder` files no folder from it and asks for the template, or for `{ params: {} }` when the word is the route's own. The plural test cannot know a collection English does not mark: a repository names those in `jterrazz.config.ts`, `test: { collections: ['data', 'people'] }`, and `GET /data` is filed under `data/list/`. Nor can a chain tell a route that takes any method (`app.all('/mcp', …)`) from one that takes the verb it sends: a repository names those there too, `test: { methodless: ['/mcp'] }`, and a POST and a PUT to `/mcp` are then one subject, `ALL /mcp`, filed under `mcp/` — never split by verb. The list cannot drift from the app: the api run holds it to the app's own route table, and fails on a route taken on any method that it misses or a path it names that the app takes otherwise ([10 — The api facet § Route coverage](10-api.md#route-coverage)). A command is its first word, so a positional argument is never read as a subcommand (`exec('spawn shop')` is `spawn/`); a runner whose commands take several words declares them, `specification.cli(bin, { commands: ['db', 'migrate'] })`, and a command is then every leading word the list holds — `exec('db migrate --dry-run')` is `db/migrate/`. A page and a journey have no standard name: the file reaches one, and its folder stays the author's. A test whose own chains reach two subjects cannot be cut — it states what it stands on with a seed rather than a second action.

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

A colocated test is held to the same one `describe`, titled with its SUBJECT rather than an aspect: the symbol of the module beside it that the test is about, read from that module's exports — `locale-note.test.tsx` beside the `LocaleNote` it renders opens `describe('LocaleNote', …)`. Which export answers, in order, is [`one-describe-per-file`'s row](19-linting.md#one-describe-per-file); a test with no module beside it is titled with its base name.

A file holds at most 400 lines (`spec-file-within-line-limit`); past it, the tests usually group by a prefix of their titles, and that is where the file is cut.

A test's body spans at most 60 lines of gestures (`test-body-within-line-limit`), in a module test as in a spec; the value a `toMatch` compares is the claim, not a gesture, and `ground-shared-or-inline` caps it instead. The toolchain's function cap leaves a test file alone, because the file's one `describe` is a function as long as the file; the cap it would have put on each test is this one.

### A specimen's spec

A framework specifies itself against apps it keeps as ground, under `specs/_shared/_fixtures/` — SPECIMENS, not the project's product. A spec that drives a specimen specifies the FRAMEWORK, and the route, the job or the command the specimen answers on is no subject of the project: `one-subject-per-spec` and `spec-in-subject-folder` leave it alone.

A spec drives a specimen when either holds:

- **its runner names the shared fixtures** — the specification module, the one that module builds on, or the spec itself when it builds its runner inline. It names them by:
    - a file inside a specimen's folder — the app module, the binary, the script a command runs;
    - or the folder itself, as the root a `server: { command }` of the runner it feeds runs from, written in the call or in a `const` the call names. A root alone does not count: it is where the services read their ground, and no app.
- **it is an integration spec importing the module of the shared fixtures its chains call.**

Where such a spec is filed is the framework's own to say; this package's answer is [03 — Testing § A specimen's capability folder](03-testing.md#a-specimens-capability-folder). An application's specs keep the route's folder — its routes are its product.

### What a file shares

A file shares only what its tests share. A SETTING every chain of a file repeats — the same `.clock(…)`, the same `.headers(…)`, the same `.env(…)` — is stated once, on a view of the facet: `const events = api.with({ clock: '2026-03-04T09:30:00Z' })`, every chain of `events` starting with it and its own setups merging over it. A seed and a stub are the Given of one test and stay on its chain; `no-repeated-chain-setting` warns on the setting every chain repeats, and `make fix` declares the view. A file-level expectation serves two tests or more, and one a single test reads is written in that test (`expected-constant-shared`). An expectation is never imported from another module of the specs tree (`no-imported-expectation`): a helper the test calls, a stub, the runner are imports; the value a matcher compares is the test's own. The product's own data is the subject's, not an expectation — a spec may compare against `package.json`'s version or a constant the product exports.

## The naming recap

**One folder per verb that reads the disk.** Each verb that takes what a spec stands on has its folder, named for what it holds: `seed()` reads `_seeds/`, `fixture()` reads `_fixtures/`, `intercept()` takes what `_setup/stubs/` declares, `request()` reads `_requests/`, and `toMatch()` reads `_expected/`. The inputs come in several kinds because several mechanisms set them up — a database, a working directory, the network, the request itself. The expectation is one kind, because one verb compares every subject.

One rule decides every folder of a spec tree: **a folder whose name starts with `_` is never a subject, and a subject never starts with `_`.** A subject's folder is derived — from a route, a command, a job — so it may take any word (`GET /requests` files under `api/requests/list/`), and only the marker keeps the folders that are no subject from colliding with one. The `_` names are a closed list (`reserved-folder-in-closed-list`):

- `_setup/` — the TypeScript that prepares specs: a test adapter, a shared value, a helper, a stub facade and its kind folders (`_setup/stubs/`). Never a spec, never data. It is code: linted, formatted and typechecked like any module, and every module of a specs tree that is no spec, test or runner lives in one (`spec-code-in-setup-folder`).
- `_fixtures/`, `_expected/`, `_requests/`, `_seeds/` — the GROUND, material a spec names by its path, spelled in full on the line that reads it (`file('./_seeds/users.sql')`, `directory('../../_shared/_fixtures/shop/')`). The ground names are reserved wherever a test stands on a file, beside a module under `src/` as much as under `specs/`: the toolchain and the vitest preset ignore all four at any depth, and production code may import nothing from them (`no-test-code-in-production`).
- `_shared/` — directly under the specs root, and nowhere else.

A folder with a reserved name but no `_` — `setup/`, `seeds/`, `requests/`, `expected/`, `fixtures/`, `shared/`, and `doubles/` for test adapters — is refused where it holds no spec, the fix naming its `_` spelling; a `shared/` below the root is refused as a `_shared/` there is. Inside a `_setup/` the names are the code's own, and `_setup/` holds code alone: a ground folder or a file that is no module inside it is refused, the fix naming the ground folder of its role beside it. `docker/` sits at the project root, outside any row of specs, and is untouched by the rule.

**The specs root holds its facets and `_shared/`, and nothing else** (`specs-root-holds-facets-and-shared`); a repository suite is a first-level folder too ([the third door](#the-third-door-a-repository-suite)). A facet folder holds its runners at its ROOT — `<name>.specification.ts`, the one place a runner lives, in every `depth` mode (`specs-at-declared-depth`) — then subject folders, specs and reserved `_` folders; any other folder holds subject folders, specs and reserved `_` folders. `_shared/` holds what the facets share, in the reserved folders of its role — `<specs>/_shared/_setup/`, `<specs>/_shared/_fixtures/`, `<specs>/_shared/_seeds/`, `<specs>/_shared/_requests/`, `<specs>/_shared/_expected/`. A role folder at the specs root itself is ground outside `_shared/`, refused as a folder and fixed by `jterrazz-test-check --fix`, which moves it under `_shared/` and rewrites every literal that named it (`no-reach-into-sibling-ground`). A seed the facets share is `<specs>/_shared/_seeds/catalog.sql`, reached as `../../_shared/_seeds/catalog.sql`; parked at `<specs>/_shared/_fixtures/_seeds/` it is file state by its first ground folder, and `verb-reads-its-ground-folder` refuses it naming `<specs>/_shared/_seeds/`.

**A test adapter is named for the port it replaces**: `<port>.adapter.ts` in a `_setup/`, whatever its class is called — `class FixedTickerSource implements TickerSourcePort` is `ticker-source.adapter.ts` (`adapter-named-for-its-port`, which reads a class implementing a type imported from outside the specs tree; a double built another way is review's to name). "Fixture" means input data: a file in `_fixtures/`, or a module test's sibling `<file>.fixtures.ts` under `src/` — under `specs/` a `*.fixtures.ts` is refused, and the module is named for what it holds.

Three further rules decide WHETHER and WHERE shared things live, and they are one question asked from three sides. **The placement law is the same for code and for data: a shared thing sits in the reserved folder of the LOWEST folder every one of its readers shares** — beside them when one leaf reads it, in `events/_seeds/` or `events/_setup/` when `events/list/` and `events/get/` do, and under `<specs>/_shared/` only when its readers span facets. `ground-shared-or-inline` holds data to it, `setup-module-at-lowest-common-folder` holds a `_setup/` module to it, read on the imports: a module one spec alone imports belongs in that spec, as a file one test alone reads does.

**A file exists only if it is shared**: a golden or a request ONE test reads, and no module test names, belongs in that test, written in place — the value `toMatch` compares, the request's text or its body — unless it is a directory tree, a binary file or longer than its role's cap: 30 lines for a request or a body, 150 for an expectation. The caps hold the other way too: a request written in the test past 30 lines, or an expectation past 150, belongs in a file beside the test. A `_fixtures/` entry is file state and stays a file, and so does a seed: SQL is never written in a test, so a seed one test reads lives beside it in `./_seeds/`. Read by several tests, a file sits at the lowest folder they share: an entry kept above it — the shared ground's included — belongs in that folder's ground of the same role — `<specs>/_shared/_seeds/x.sql` read by one leaf becomes `<leaf>/_seeds/x.sql` (`ground-shared-or-inline`, both halves autofixed by `jterrazz-test-check --fix`) — and every reader counts where it stands: a test at its folder, a runner at its facet root, a `_setup/` module at the folder that owns that `_setup/`. Only a reader outside the specs tree — a module test, the member's Makefile or its vitest config — keeps an entry where it is whatever the specs say, by a relative literal, the literal pieces `named-path-exists` reads, or a path spelled from the member root (`specs/…`).

**What several leaves share lives there once**: an entry two leaves hold byte for byte, under the same role, is a copy whatever each is called, and belongs once in the ground of the lowest folder they share — a warning, since two leaves may mean to diverge tomorrow (`no-duplicate-ground`; when the copies share a name, `--fix` moves one up, deletes the others and rewrites every relative literal that named one — copies of several names wait for the author to pick the name).

**A path leaves its leaf only by climbing**: a `file()` or `directory()` whose target is neither under the referring spec's own directory, nor under the ground of a folder that encloses it, nor under one of the four under `<specs>/_shared/`, is an error (`no-reach-into-sibling-ground`) — a leaf reaching into a sibling's ground is one such path. Climbing is how sharing reads: `events/list/` and `events/get/` reach `../_seeds/` of `events/`, and a route's leaf reaches the ground of the route above it (`map/pois/detail/` reads `../_seeds/base.sql` of `map/pois/`).

So write ground and helpers local first: the day a second leaf copies an entry, `no-duplicate-ground` moves it up to the folder they share, and the day only one leaf is left, `ground-shared-or-inline` moves it back down — and the day only one test is left, `ground-shared-or-inline` writes it into that test. Where a shared thing sits says who depends on it: a reader trusts the folder to tell them what a change reaches, and it does only while the thing sits exactly as high as its readers.

Two more hold what each path says. **The verb and the folder agree**: `seed()` reads `_seeds/`, `request()` and a request body read `_requests/`, `fixture()` reads `_fixtures/`, a golden reads `_expected/` (`verb-reads-its-ground-folder`). **What a path names exists**, of the kind its wrapper says — and a path a test resolves from its own directory with literal pieces alone (`resolve(import.meta.dirname, '..', 'fixtures', 'gone')`, one piece only when spelled `./` or `../` — a lone bare piece is as often a folder the test makes) too, a module test's as a spec's (`named-path-exists`, the checker, reported where the path is written; the runtime refuses the same with the path it resolved to). A fixer that moves ground rewrites every whole relative literal that named it, a module test's included; a path built from pieces, or spelled into a command a process runs, is the author's to rewrite, and `named-path-exists` names it once the ground has moved. And a path is **built in the test that stands on it**: it resolves against the spec that starts the chain, so a `file()` built in a shared helper would name a different file for every spec that reaches it — a helper takes the `file()` as a parameter (`paths-named-in-the-test`).

| Thing           | Rule                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specs root      | `specs/` (`api/`, `job/`, `cli/`, `integration/`, `website/`, `mobile/`) — one folder per constructor, beside `_shared/`, what the facets share: `_shared/_setup/`, `_shared/_fixtures/`, `_shared/_seeds/`, `_shared/_requests/`, `_shared/_expected/`, and any repository suite ([the third door](#the-third-door-a-repository-suite)) |
| Specification   | `specs/<facet>/<name>.specification.ts` (at the facet root)                                                                                                                                                                                                                                                                              |
| Instances       | `api`, `job`, `cli`, `integration`, `website`, `mobile` — enforced by the destructuring (`no-runner-alias`)                                                                                                                                                                                                                              |
| Spec file       | `specs/<facet>/<subject>/<aspect>.spec.ts` — the assembled product's word (`file-suffix-matches-place`); the subject's folder derived where the facet has one ([One file, one subject](#one-file-one-subject))                                                                                                                           |
| Spec document   | `<case>.spec.yaml`, beside the spec it belongs to — never under `_expected/` ([20](20-documents.md))                                                                                                                                                                                                                                     |
| Module test     | `<file>.test.ts`, sibling of `<file>.ts` (under `src/`)                                                                                                                                                                                                                                                                                  |
| Component test  | `<file>.test.tsx`, sibling of `<file>.tsx` — or of the `<file>.ts` of a hook or a DOM function ([07](07-component.md))                                                                                                                                                                                                                   |
| Module fixtures | `<file>.fixtures.ts`, sibling of the `.test.ts` under `src/` (typed exports) — outside `specs/`, the one name the tests of a module share code or data through, test material only a test imports (`fixtures-imported-by-tests-only`); never under `specs/`, where a fixture is data in `_fixtures/`                                     |
| Setup           | `_setup/<meaning>.ts`, in the lowest folder its readers share — a test adapter `_setup/<port>.adapter.ts`, named for the port it replaces                                                                                                                                                                                                |
| Stubs           | `_setup/stubs/<name>.stubs.ts` (facade) · `_setup/stubs/<kind>/<name>.ts` (unit, kind ∈ http\|openai\|anthropic — the stub builders the package exports)                                                                                                                                                                                 |
| Stub data       | `_fixtures/<name>.json` (served, imported by its unit) · `_setup/stubs/<kind>/<name>.request.ts` (matched)                                                                                                                                                                                                                               |
| Requests        | what a spec sends: `_requests/<name>.http`, read by `.request(file('./_requests/<name>.http'))`, and a body `_requests/<name>.<ext>`, sent by `.post(path, file('./_requests/<name>.json'))`                                                                                                                                             |
| Seeds           | database state: `_seeds/<name>.sql`, read by `.seed(file('./_seeds/<name>.sql'))` — beside its test, or at the level of the tests that share it; SQL is never written in a test                                                                                                                                                          |
| Fixtures        | `_fixtures/<name>` (file state) — in the lowest folder its readers share; across facets the pool `specs/_shared/_fixtures/`, reached by the path that climbs to it, as `<specs>/_shared/_seeds/` is for seeds                                                                                                                            |
| Goldens         | `_expected/<name>.<ext>` (everything asserted, response `.http` included), read by `.toMatch(file('./_expected/<name>.<ext>'))`; a tree by `.toMatch(directory('./_expected/<name>/'))`                                                                                                                                                  |
| Service keys    | name the service: the report prints the key, and its kebab-case form is the folder its init script sits in                                                                                                                                                                                                                               |
| Framework env   | `TEST_UPDATE`                                                                                                                                                                                                                                                                                                                            |

## Source-code architecture

The `architecture` family governs the source tree rather than the spec tree, and it splits in two.

**The layer map is the project's to declare.** This package cannot know another repository's architecture, so it ships no layer rule: a project states its layers in `jterrazz.config.ts`, under `typescript.architecture`, and `@jterrazz/typescript`'s Architecture pass holds its imports to them. What THIS repository declares, and why each sanctioned edge exists, is [01 — Architecture](01-architecture.md) — a consumer's own map is its own chapter's, written the same way.

**The test-file rules need no declaration.** `test-beside-its-module` (a module's test is its sibling) and `no-module-mock` (no `vi.mock`, `__mocks__/`, `__fixtures__/` or data-asset imports under `src/`) hold in any repository that adopts this preset — they are part of the floor described above, not of the layer map. A module's typed fixtures are a sibling `<file>.fixtures.ts`, as the naming recap says.

## The fork — which kind of test this is

The questions are asked IN ORDER, and the first yes is the kind. The answer fixes the folder, the constructor (or none), and the project. The table is generated from `lint/consumer/catalogue/fork.ts`.

<!-- GENERATED:fork — do not edit by hand; run `npm run docs`. Source: lint/consumer/catalogue/fork.ts -->

| Question                                                               | Kind             | Lives at                                         | Constructor                   | Project       |
| ---------------------------------------------------------------------- | ---------------- | ------------------------------------------------ | ----------------------------- | ------------- |
| Does it render in a browser as a whole served page?                    | website          | `specs/website/<domain>/<aspect>.spec.ts`        | `specification.website()`     | `website`     |
| Does it render as a component (React, a DOM function, a hook)?         | component        | `<file>.test.tsx` beside `<file>.tsx`            | none — the `component` chain  | `component`   |
| Does it render on a simulator?                                         | mobile           | `specs/mobile/<domain>/<aspect>.spec.ts`         | `specification.mobile()`      | `mobile`      |
| Does it answer HTTP?                                                   | api              | `specs/api/<resource>/<action>/<aspect>.spec.ts` | `specification.api()`         | `api`         |
| Is it triggered by name, in-process?                                   | job              | `specs/job/<job>/<aspect>.spec.ts`               | `specification.job()`         | `job`         |
| Is it a binary?                                                        | cli              | `specs/cli/<command>/` (+ `<case>.spec.yaml`)    | `specification.cli(bin)`      | `cli`         |
| Is it a module that needs a real service, or whose oracle is a golden? | integration      | `specs/integration/<domain>/<aspect>.spec.ts`    | `specification.integration()` | `integration` |
| Is it a module alone?                                                  | module           | `<file>.test.ts` beside `<file>.ts`              | none                          | `unit`        |
| Is it the repository itself — a suite over several apps?               | repository suite | `specs/<suite>/<domain>/<aspect>.test.ts`        | none                          | any name      |

<!-- /GENERATED:fork -->

The SUFFIX says the kind, and the checker holds it (rule `file-suffix-matches-place`): `.test.ts(x)`
beside the code for a unit, `.spec.ts` under `specs/<facet>/` for the assembled
product, `<case>.spec.yaml` for a literate document, `<facet>.specification.ts`
for the file that builds a runner. A repository suite is the one tree under
`specs/` that keeps `.test.ts`: its first level is not a facet, it covers a tree
rather than a product, and `specs-at-declared-depth`'s declared depth is what judges its shape.

The fork is the SUBJECT, never the amount of machinery. A rendered component needs a real browser, a Vite pipeline, a network double and golden matching — all of them the framework's — and it is still a unit, so it sits beside its code. A module that needs a real database needs nothing new at all, and it is still an assembled thing, so it sits under `specs/` ([06](06-integration.md)).

The table is total: **a folder under `specs/` is a constructor's name, `_shared/`, or a repository suite, and there is no tenth row**. A probe of an adapter against a real service — a database driver, a cache handle — answers the seventh question, so it is an integration spec like any other; what it cannot reach through the package's public entry it should not be reaching from a spec at all, and that probe is a module test beside its module.

## The doubles ladder

Closed and ordered. An agent takes the FIRST rung that fits, and nothing below rung four is a rung.

1. **The real thing**, in-process — a pure module, a Hono app handed to `server`, a component mounted in a real Chromium.
2. **A declared service** — `sqlite()`, `postgres()`, `redis()`, `process()` ([17](17-services.md)): real, isolated per worker, reset at the start of every chain.
3. **A stub** — `.intercept()` on a chain (api, job, integration, component, website, mobile), `intercept()` in module scope ([16](16-stubs.md)). One queue, three transports ([16 § Three deliveries, one queue](16-stubs.md#three-deliveries-one-queue)), strict from the first stub (rule `network-strict-after-first-stub`); a streamed body is `http.stream` / `http.sse`.
4. **A typed port double** — `mockOf<Port>()` for an injected interface, `vi.fn<Fn>()` for a function-shaped dependency. Asserting a call on one is a boundary observation; asserting ONLY on doubles the test built is not a test of anything. `T` is constrained to `object` and has no default, so a double asked for nothing answers for `object` — TypeScript falls back to the constraint where no inference site says otherwise, and the refusal lands where the double is USED rather than where it was made. State the port. A double a runner hands the app — a class implementing the port, the adapter the spec swaps in — is a test adapter, and sits in `_setup/<port>.adapter.ts` ([The naming recap](#the-naming-recap)).

**Off the ladder**, each with a destination: `vi.stubGlobal('fetch')` → `intercept()`; a raw `msw`/`nock`/`sinon` import → a stub; `vi.useFakeTimers` / `vi.setSystemTime` → `clock`; `toMatchSnapshot` → a golden under `_expected/`; `vi.mock` of an application module → inject the port instead. A native module a consumer genuinely cannot inject is the one allow-listed exception, per specifier, with a reason.

Where a test lives is what makes the rungs mechanizable: a module test may not carry a golden, and a module that needs a real service is an integration spec ([06](06-integration.md)). The reasoning is [ADR-005](decisions/005-the-doubles-ladder-is-closed.md).

## Time — one primitive, two depths

Determinism is structural (rule `no-sampled-value-in-expectation`): a value a test SAMPLES — `Date.now()`, `new Date()`, `Math.random()`, `randomUUID()` — never reaches an oracle. Time is the one of those the framework pins for you, and `clock` is the whole vocabulary. `vi.useFakeTimers()` and `vi.setSystemTime()` are what it replaces: each of them owns a teardown a test will one day forget.

```typescript
import { clock } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('stamps the moment the receipt was issued', () => {
    // Given - the calendar pinned for this scope
    using _ = clock.at('2026-03-04T09:30:00Z');

    // Then - the stamp is the stated instant
    expect(new Date().toISOString()).toBe('2026-03-04T09:30:00.000Z');
});
```

| Form                | Takes                          | For                                                                        |
| ------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `clock.at(iso)`     | the calendar (`Date`)          | a subject that READS the time — a stamp, an expiry, a greeting             |
| `clock.run(iso?)`   | the calendar and the scheduler | a subject whose behaviour IS elapsed time — a debounce, a backoff, a poll  |
| `clock.advance(ms)` | —                              | moving the pinned clock on; under `run()`, firing everything that came due |

Both forms are `Disposable`: `using _ = clock.at(…)` gives the REAL clock back at the end of the scope, however the scope ends. `at()` leaves the scheduler real, so promises, renders and the framework's own loops keep running; `run()` queues them instead, which is what lets a test assert a five-second backoff without the arbitrary sleep `no-sleep` forbids.

One clock per test: a second scope taken inside the first is refused, not nested. Disposing restores the real clock — the only state vitest's fake timers can give back — so a nested scope that ended would silently end the outer one too, and the refusal says which of the two the test meant.

Migrating a `beforeEach`/`afterEach` pair holds the `Disposable` by hand:

```typescript
let pinned: Disposable;
beforeEach(() => {
    pinned = clock.at('2026-03-04T09:30:00Z');
});
afterEach(() => {
    pinned[Symbol.dispose]();
});
```

That form works, and it is the migration shape rather than the destination: `using _ = clock.at(…)` inside the test states the instant where the test that needs it can be read, and cannot be forgotten.

A facet pins the same instant for the chain it is stated on — `.clock(iso)` on api, job, integration, component, and on a website visit (the PAGE's calendar, through the browser). A cli spec is another process: its instant travels through the product's own env (`TZ`) or is absorbed by a `{{iso8601}}` token in the golden.

## The backlog — the criterion written, coded on its first occurrence

A rule is written when its defect class has been SEEN once and its criterion is decidable. A class nobody has seen yet is not a rule: it is a line here, with the criterion it would be written against, so the day it appears the guard is a translation rather than a design. The estate dry run — the whole catalogue run over every repository of the workbench — is what moves a line either way.

| Line                                | The criterion, ready to code                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-intercept-in-a-loop`            | an `.intercept(` call inside a `for`/`while` body, or a `.map(`/`forEach(` callback, in a test file                                                                                                                                                                                                                                                                                                                                                              |
| `no-marker-inside-a-declaration`    | a Given/When/Then marker whose offset falls inside a `VariableDeclaration` with ≥ 2 declarators                                                                                                                                                                                                                                                                                                                                                                  |
| `no-domain-repeated-in-golden-path` | a `toMatch(file(` path whose directory part repeats the leaf's own domain folder                                                                                                                                                                                                                                                                                                                                                                                 |
| `no-ground-under-a-screen-facet`    | a `_seeds/` or `_requests/` under a facet whose specification constructs `website()` or `mobile()` — a screen owns no database                                                                                                                                                                                                                                                                                                                                   |
| `no-unseeded-value-in-golden`       | a uuid, or an iso8601 whose time is NOT midnight UTC, in a file under `_expected/` that appears in no `_seeds/`, `_requests/`, `_fixtures/`, `stubs/` or referring test of the same leaf, nor in the `specs/_shared/_fixtures/` pool. The hour is part of the criterion: a clock read during a run is never exactly midnight, a publication date always is ([ADR-006](decisions/006-the-catalogue-reaches-a-file-by-its-role.md) records what the dry run found) |
| `no-golden-in-module-test`          | a `toMatch(file(…))` in a `module`-role file OUTSIDE every `specs/` tree: a unit test standing on a golden file is an integration spec, and `specs/integration/` is where it belongs (`golden-path-has-extension` holds the same call inside a specs tree)                                                                                                                                                                                                       |
| `no-unreachable-only-negative`      | a test whose stub list is `http.unreachable()` on every feed and whose assertions name `result.error` alone: the case proves the call FAILED, not that it never happened. Waits on the surface — `http.never(request)` is a product line ([TODO.md](../TODO.md) § What the stub vocabulary still cannot say)                                                                                                                                                     |
| `no-empty-golden`                   | a file under `_expected/` whose trimmed content is exactly `{{any}}`                                                                                                                                                                                                                                                                                                                                                                                             |
| `no-duplicate-stub-payload`         | two response payloads with the same content hash under one `stubs/` tree, outside the shared pool                                                                                                                                                                                                                                                                                                                                                                |
| `no-inline-body-beside-requests`    | a request body written inline in a test that also carries a `_requests/` directory                                                                                                                                                                                                                                                                                                                                                                               |
| `no-retry`                          | a `retry:` option on `test(`/`describe(`, or `test.retry(`, or `retry` in a vitest config — react-query's `retry: false` is not one                                                                                                                                                                                                                                                                                                                              |
| `no-namespace-spy`                  | a `vi.spyOn(<namespace import>, …)` — a module's own export spied through its namespace object                                                                                                                                                                                                                                                                                                                                                                   |

**Parked**, for a criterion that is not settled: **`no-negated-golden`** (15 hits on the workbench, every one a `toMatch(/re/)` the criterion must exclude) and **`no-unreachable-stub`** (the criterion has to compare filter arguments, not just methods and urls).

## What stays human, and why

Every convention a machine can settle is a row with a channel. These are the
ones no channel can decide — listed with the reason, and with what the machine
takes of them anyway, so neither side is silently dropped.

| Convention                                                                                                                                                          | Why no channel decides it                                                                                 | What the machine takes                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `folder-follows-assets` grouping — own domain vs sibling aspects                                                                                                    | what the assets will become is a reading of the domain                                                    | `ground-beside-its-only-reader` flags the one-owner half                                                                                                               |
| `output-asserted-as-a-golden` the legitimacy of a probe                                                                                                             | absence, cut output and a third-party format are meanings, not shapes                                     | `result-compared-whole` / `no-status-only-test` / `no-probe-cluster` draw the cluster boundary                                                                         |
| `negative-golden-frozen` residue routed through a helper                                                                                                            | inter-procedural analysis is out of an oxlint JS plugin's reach                                           | `negative-golden-frozen`'s bounded heuristic                                                                                                                           |
| the truth of a Given/Then sentence, or of a title                                                                                                                   | a sentence can be well-formed and false                                                                   | `given-and-then-markers-present`, `when-between-given-and-then`, `marker-on-one-line` and `vitest/valid-title` hold the shape                                          |
| whether an updated golden is RIGHT                                                                                                                                  | correctness is the diff, read at review                                                                   | `no-volatile-literal` holds the volatile literals, in a document and under `_expected/` alike; the pinned-value half of ground waits for `no-unseeded-value-in-golden` |
| whether an allow-listed `vi.mock` has no seam                                                                                                                       | the claim is disputable, and recorded in the config comment                                               | `no-module-mock` holds the list                                                                                                                                        |
| `exact` versus `within` when both disambiguate                                                                                                                      | taste between two user-facing forms                                                                       | `test-id-states-what-is-missing` forces a reason on the escape hatch; `descriptor-matches-one-element` offers both                                                     |
| `expected-named-for-its-content` — an expected file is named for what it HOLDS, not for the parameters that produced it: `limit-one.http` → `single-quiz-page.http` | what a response holds is a reading of its body; a name built from the request is still a well-formed name | —                                                                                                                                                                      |
| one fixture per answer of the system                                                                                                                                | a reading of what the chain proves                                                                        | `document-description-unique` holds unique descriptions                                                                                                                |
| stub realism                                                                                                                                                        | only a recorded exchange could judge it                                                                   | —                                                                                                                                                                      |
| the depth a repository declares                                                                                                                                     | reviewed once, when the tree is born                                                                      | `specs-at-declared-depth` thereafter                                                                                                                                   |

## A message teaches

A finding is the only page of the catalogue most readers ever see, so it carries what the reader needs to act without opening another: **what was found** and where, **why** the convention holds, **the fix for this case** — its paths and names, and `make fix` when a fixer does it — and **where to read** the rule whole. A message that names the fault and stops sends its reader to the chapter for what the line could have said; one that states the rule and not the case sends them back to the code to find out what it saw.

The four parts are the same everywhere a rule speaks — a static rule, a checker pass, a refusal the runtime throws — and none is optional. How each channel prints them is [19 — Linting](19-linting.md#what-a-finding-says)'s. The runtime throws nothing else: an error only the framework can cause — a broken invariant of its own — says so, and that the bug is not the reader's to fix.

## Maintaining the constitution

- A new **mechanizable** rule is added to the **code** (`lint/consumer/catalogue/manifest.ts` + its implementation), not here — then `npm run docs` regenerates the catalogue. The freshness meta-test fails if the committed catalogue is no longer byte-identical.
- A new **principle** or a non-mechanizable criterion is added here, in its family section or as a process rule.
- Never duplicate a mechanized rule in this constitution: the code is its single source of truth.

## Pitfalls

- **Treating these docs as the spec.** They explain and illustrate; this constitution and the generated catalogue ([19 — Linting](19-linting.md)) decide. When you find a discrepancy in the docs, fix the docs in the same change — [02 — Developing](02-developing.md) § What a change owes.
- **Editing the generated catalogue by hand.** The [19 — Linting](19-linting.md) catalogue is GENERATED from `lint/consumer/catalogue/manifest.ts` — a hand edit is overwritten by the next `npm run docs` and fails the freshness meta-test. Change the rule's text in the code; regenerate.
- **Adding a mechanized rule to the constitution.** A machine-checkable rule lives in the code (its `meta.docs` / the manifest), not in this chapter. The constitution holds principles and non-mechanizable criteria only.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [03 — Testing](03-testing.md) · [14 — Assertions](14-assertions.md) · [19 — Linting](19-linting.md) · [06 — Integration specs](06-integration.md)
