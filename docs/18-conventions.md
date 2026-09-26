# 18 — Conventions: the constitution

This chapter is the **constitution**: the principles, the non-mechanizable criteria, and the design rationales behind the conventions. It is hand-maintained and stable.

The **mechanized per-rule catalogue** does not live here — it is **generated from the code** (`lint/catalogue/manifest.ts`, where each rule carries its own normative text): the consumer rules into the [19 — Linting](19-linting.md) catalogue, the package's own into [03 — Testing § The package's own rules](03-testing.md#the-packages-own-rules).

This is the **docs-as-code inversion**: the code is the source of truth for the mechanized rules (a rule and its normative text live together, so they cannot drift), and this constitution is the source of truth for the principles. There is **no duplication** — a machine-checkable rule is written once, in the code. The broader repo-layout doctrine this follows — a written corpus, thin injection layers, a compiler that projects; committed projections against CI-built presentations — is `jterrazz-studio`'s repo-structure chapter, its canonical home for every language.

Guiding aim: **most enforcement is programmatic, not manual review.**

Which CHANNEL holds a given rule — static, checker, runtime, process, and the meta-test and type channels that double them — is not this chapter's: it is [01 — Architecture](01-architecture.md), where the shape of the enforcement machinery is drawn. What follows is what the rules SAY and what a reviewer must judge.

## The rule families

The catalogue is organized by family. Each family's usage is illustrated in the chapters; the generated catalogue in [19 — Linting](19-linting.md) carries the normative sentence and channel of every rule.

| Group | Scope                                                                | Explained in                                                         |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A     | Runner creation (constructors, services, root)                       | [02](02-developing.md), [10](10-api.md), [17](17-services.md)        |
| B     | Spec chains (setups, terminal actions, Given/Then, `job` vocabulary) | [10](10-api.md), [11](11-job.md), [12](12-cli.md)                    |
| C     | Files & folders per feature                                          | [02](02-developing.md), [14](14-assertions.md), [16](16-stubs.md)    |
| D     | Assertions, tokens, snapshots, strict stubs                          | [14](14-assertions.md), [15](15-tokens.md), [16](16-stubs.md)        |
| E     | Environment & runner configuration                                   | [02](02-developing.md), [07](07-component.md)                        |
| F     | Imports (single package root) & production protection                | [02](02-developing.md)                                               |
| W     | Website & mobile specs (scenarios, user-facing elements)             | [08](08-website.md), [09](09-mobile.md)                              |
| G     | Infrastructure                                                       | [12](12-cli.md), [17](17-services.md), [07](07-component.md)         |
| I     | Source-code architecture (declared layers, sibling module tests)     | below · [01](01-architecture.md) for this repo's own layer map       |
| J     | Hygiene (no arbitrary sleeps, honest spec documents)                 | [19](19-linting.md)                                                  |
| K     | Retro-propagation — every defect class grows its own guard           | [03](03-testing.md#the-packages-own-rules), this package's own rules |

## The reach of the conventions

The framework and the conventions do not have the same scope, and confusing the two is the commonest misreading of this constitution. `specification.*` — with its seeds, fixtures, stubs, goldens and containers — is for specifying a **surface** something is served through: an HTTP API, a background job, a CLI, a rendered page, a native screen. A plain unit test of a pure function has no such surface and needs none of it.

A **rendered component** needs no RUNNER — nothing is started, so it has no constructor and no `*.specification.ts` — and it does need a real browser, a Vite pipeline and a network double, every one of which the framework owns. So the fork is the SUBJECT, not the amount of machinery: one unit — a module, a component — sits beside its code and is judged by its suffix (`<file>.test.ts`, `<file>.test.tsx`); the assembled product, reached through an entry, sits under `specs/`. [07 — Component specs](07-component.md) holds the rendered half.

The conventions bind **every test file of the repository**, that plain unit test included, whether or not `@jterrazz/test` is imported in it. A test is a test: it sits beside the module it covers (I2), it narrates its Given then its Then (B4), it keeps its doubles out of `src/` (I4), and it stays honest under the J hygiene floor — no committed `.only`/`.skip`, an assertion in every test, no two literal titles alike in a file, a lowercase title. That floor is oxlint's own `vitest` plugin, which `@jterrazz/typescript` turns on over the test globs in every profile; this package's J family keeps only what the plugin has no counterpart for — the arbitrary-sleep ban (J2), which reaches every test file, since a sleep beside a module waits as blindly as one under `specs/`, and the spec-document mirrors. Every one of these is mechanized, so its normative sentence lives in the catalogue ([19 — Linting](19-linting.md)) and not here.

The reason for the wide reach: a repository has **one** way to write a test, so a reader moving between a sibling module test and a spec of a surface reads the same shape and the tooling has a single target. A rule that applied only to framework tests would leave the majority of test files — the plain ones — unguarded.

## The third door: a repository suite

Two doors carry every test the fork names: a UNIT sits beside the module it covers (`<file>.test.ts`, I2), and the ASSEMBLED product sits under `specs/<facet>/` and reaches the runner that folder promises (`<aspect>.spec.ts`, C12 and C18). A few specifications have neither address, and they are not mistakes.

### What has no address of its own

What they specify is a REPOSITORY's own surface: the subpaths its `package.json` publishes, a `.d.ts` beside every `.js` it ships, the lint guards a tree owes, the files a build is expected to write. There is no one module to sit beside — they resolve every module there is — and no runner to reach, since nothing is started. Put under a facet folder, C18 refuses them ("reaches no runner"); put beside a module under `src/`, I2 refuses them ("no neighbour `exports.ts` found"). Both refusals are right, and a legitimate file shape with no green position is a hole in the conventions, not a defect in the file.

### The door, and the depth it is judged by

**The third door is a FIRST-LEVEL folder under `specs/` that is not a facet name.** It is a repository suite: it covers a TREE rather than a product served through an entry. C12's rename clause does not reach it, C18 and C20 do not reach it, and C1's declared depth is what judges its shape.

**C1 judges a suite exactly as it judges a facet.** The suite folder is the first level and the tests sit one level down, in a folder named for what they cover: at the default depth, `specs/<suite>/<domain>/<aspect>.test.ts`. A test written straight into the suite folder is refused for the same reason one at a facet root is — the level that says what a file covers would be missing. This package's own `specs/lint/` is two levels deep for that reason.

**A suite is a door because it holds tests.** One test is enough: a first-level folder holding a single `.test.ts` is a suite, and legal. A first-level folder that holds none — a `support/` of helpers and mocks — is no suite, no facet and not `shared/`, and C1 refuses each module in it, a runner included, in every mode: a runner lives at the root of the facet it builds, a test helper beside the tests it serves, a fixture under `specs/shared/fixtures/`.

### The two names the estate shares

Two suites carry names the whole estate shares, because two repositories inventing two names for one idea is the drift a vocabulary exists to stop: a package's own published SURFACE is `surface/`, and a repository's own lint guards are `lint/`. Every other suite is named for what it covers.

```
specs/
├── surface/                      # what the package publishes
│   └── package/
│       ├── exports.test.ts       # every subpath the manifest resolves
│       └── declarations.test.ts  # a `.d.ts` beside each `.js` it ships
└── lint/                         # the guards the repository's own tree owes
    └── <rule-id>/
        ├── <case>.spec.yaml      # a tree in, the command, the normalised report out
        └── fixtures/             # the trees its documents lint
```

### The suffix, and the one thing the door does not license

The files there carry `.test.ts` — the UNIT's word — because what they prove is read without assembling anything, and `unit()` is what collects them (`roots`, or `include` outright). A facet helper would put them in a project whose budget and services they never use.

One thing the door does not license: a module test parked under `specs/` to escape I2. The question to ask of a file before it goes through is whether any single module could hold its test — if one could, that module is its address.

## Process rules (review-borne)

Three rules cannot be mechanized — they turn on judgement no single channel can settle. They are listed in the catalogue for completeness, but their full rationale lives here.

### C1 — the folder follows the assets

The grouping criterion: a test that owns **its own** asset directories (`fixtures/`, `expected/`, `seeds/`, …) gets **its own** domain folder; specs **without local assets** (or sharing the `specs/shared/fixtures/` pool) group as sibling `<aspect>.spec.ts` files inside a named **group** folder. Both shapes are legal — the assets decide, and a nascent single-test domain is legitimate. The static rule `c1-domain-structure` checks only placement; which of the two shapes is right is the review call.

Placement itself is **declared**, because a spec tree may legitimately have a shape this package cannot know:

```jsonc
"jterrazz/c1-domain-structure": ["error", { "depth": "facet-domain" }] // the default
```

| `depth`          | The tree                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'facet-domain'` | the default — `specs/<facet>/<domain>/<aspect>.spec.ts`, `*.specification.ts` at the facet root; an api or cli spec's domain is its subject's standard name, one folder or several (`events/list/`) |
| `'facet'`        | the assets decide the folder — a spec at the facet root (`specs/<facet>/<aspect>.spec.ts`) OR one domain down, never deeper; `*.specification.ts` at the facet root                                 |
| `'mirror'`       | the tree mirrors a structure outside itself (a command tree, a source tree): a spec at any depth ≥ 1, named `<dir>/<dir>.spec.ts`                                                                   |
| `'off'`          | no placement check — for a tree whose shape is guarded by something stronger and project-specific                                                                                                   |

A project states the shape it has — `facet` when asset-less tests sit beside their siblings at the facet root, `mirror` when the tree mirrors something outside itself — and keeps a checked shape, instead of switching the rule off and keeping none.

One clause of the rule is not the project's to declare, and holds in every mode, `off` included: **a folder named `fixtures/`, `expected/`, `requests/` or `seeds/` is ground, never a facet, domain or suite folder**, so no spec lives inside one — and a domain named with one of the four words is refused. Depth is a shape a tree may choose; the ground/member split is the naming law recapped in [The naming recap](#the-naming-recap).

Ground is not always inert. It may be **code** the specs stand on — the build of the subject under test, a harness the runner spawns — and code carries its unit test as a sibling under [I2](#i--source-code-architecture). So the clause lets exactly one pairing through: `<module>.test.ts` NEXT to the `<module>.ts` it is named after, inside the ground it belongs to. A test with no module beside it, or a `*.specification.ts`, is a spec that wandered in and is still reported — which is why the clause needs no `off`, and why no project has to switch off a rule it cannot switch off.

### D11 — the whole result, not a cluster of greps

**Every test compares its whole result.** A response, a json, a table, a tool's output (a linter, a compiler, a product CLI) is asserted as a **full snapshot per scoped use case** — written where the test reads it, ``expect(result.response).toMatch(`…`)``, or in a file when several tests share it — and a precise assertion on one property is allowed only beside it, stating what the case is about (D20 mechanizes it for a response, a json and a table). Each case gets **its own fixture project** (its small valid/invalid files) — the fixture IS the Given, no shared `beforeAll` state — and the assertion is the whole snapshot (``expect(result.stdout).toMatch(`…`)`` + `exitCode`), volatile parts covered by tokens, written by `TEST_UPDATE=1` from an empty `toMatch('')`.

`.grep()` / `toContain` remain the **scalpel** — targeted probes, never the default mode. They are legitimate only for:

- **(a)** assertions of **absence**;
- **(b)** output **cut at an arbitrary instant** (`waitFor`, a long-running process);
- **(c)** **container-log probes**;
- **(d)** asserting **rule ids** in the E2E lint specs (avoiding coupling to a third-party binary's exact format);
- **(e)** probes into **third-party-formatted** output.

Every other use is converted to a full snapshot. A single "kitchen-sink" project + full snapshot serves as the whole-surface regression net (it churns — that is its job). The static channel cannot tell a legitimate grep from a lazy one, hence the process channel. The mechanized boundary for a result (a response, a json or a table read and never compared whole) is D20, and a lone HTTP-status probe `d15w`; the negative-fixture guard is `d13w` (wrapped forms) plus a process rule for helper-routed residue.

## One file, one subject

A spec file answers one question about one subject, and both are written in its path: the folder is the SUBJECT, the file name the ASPECT asked of it — `<specs>/api/events/list/pagination.spec.ts` is the pagination of `GET /events`. A reader who knows the route knows where its specs are, and a change to that route opens one folder.

### The subject, and its standard name

The subject is what the file's chains reach, read statically: an api chain's method and route, a job chain's job, a cli chain's command, a website chain's page, a mobile chain's journey. A file reaches ONE (C29); a file reaching several is several files, and `make fix` splits it, each test going with the imports and file-level constants it reads. What two of the new files still read is written once: the split moves it into the fixtures module of the folder they share, `<folder>/<folder>.fixtures.ts`, exported, and each file imports it — the typed module the recap below names, never a copy per file. A declaration that builds a `file()` or a `directory()` stays in the files that read it, since a module no test is may not build a path (C26).

The folder is the subject's STANDARD name, derived and never listed (C30), so two repositories never argue it:

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

A GET on one segment lists a plural noun and gets anything else, and a segment is a parameter when the chain writes the route's template (`.get('/market/:symbol/chart', { params: { symbol: 'btc' } })`) or when it is anything but lowercase words (`42`, `AAPL`, a template hole). A filled path whose word sits right after a collection with more path after it — `btc` in `/indicators/btc/chart` — reads two ways, a value or a segment of the route: C30 files no folder from it and asks for the template, or for `{ params: {} }` when the word is the route's own. The plural test cannot know a collection English does not mark: a repository names those in `jterrazz.config.ts`, `test: { collections: ['data', 'people'] }`, and `GET /data` is filed under `data/list/`. Nor can a chain tell a route that takes any method (`app.all('/mcp', …)`) from one that takes the verb it sends: a repository names those there too, `test: { methodless: ['/mcp'] }`, and a POST and a PUT to `/mcp` are then one subject, `ALL /mcp`, filed under `mcp/` — never split by verb. The list cannot drift from the app: the api run holds it to the app's own route table, and fails on a route taken on any method that it misses or a path it names that the app takes otherwise ([10 — The api facet § Route coverage](10-api.md#route-coverage)). A command is its first word, so a positional argument is never read as a subcommand (`exec('spawn shop')` is `spawn/`); a runner whose commands take several words declares them, `specification.cli(bin, { commands: ['db', 'migrate'] })`, and a command is then every leading word the list holds — `exec('db migrate --dry-run')` is `db/migrate/`. A page and a journey have no standard name: the file reaches one, and its folder stays the author's. A test whose own chains reach two subjects cannot be cut — it states what it stands on with a seed rather than a second action.

### The aspect

The file name is the aspect, and the file's one top-level `describe` is titled with it (C31), so a failure's first word names its file. An aspect is kebab-case and says which question the file asks — never a name for what fit nowhere else (`misc`, `other`, `basic`, `general`, `more`, `edge-cases`, `tests`, `main`; C32). For an api, the vocabulary to reach for first, advised and not enforced:

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

A colocated test is held to the same one `describe`, titled with its SUBJECT rather than an aspect: the symbol of the module beside it that the test is about, read from that module's exports — `locale-note.test.tsx` beside the `LocaleNote` it renders opens `describe('LocaleNote', …)`. Which export answers, in order, is [C31's row](19-linting.md#c31-describe-names-file); a test with no module beside it is titled with its base name.

A file holds at most 400 lines (C33); past it, the tests usually group by a prefix of their titles, and that is where the file is cut.

A test's body spans at most 60 lines of gestures (C34), in a module test as in a spec; the value a `toMatch` compares is the claim, not a gesture, and C28 caps it instead. The toolchain's function cap leaves a test file alone, because the file's one `describe` is a function as long as the file; the cap it would have put on each test is this one.

### A specimen's spec

A framework specifies itself against apps it keeps as ground, under `specs/shared/fixtures/` — SPECIMENS, not the project's product. A spec that drives a specimen specifies the FRAMEWORK, and the route, the job or the command the specimen answers on is no subject of the project: C29 and C30 leave it alone.

A spec drives a specimen when either holds:

- **its runner names the shared fixtures** — the specification module, the one that module builds on, or the spec itself when it builds its runner inline. It names them by:
    - a file inside a specimen's folder — the app module, the binary, the script a command runs;
    - or the folder itself, as the root a `server: { command }` of the runner it feeds runs from, written in the call or in a `const` the call names. A root alone does not count: it is where the services read their ground, and no app.
- **it is an integration spec importing the module of the shared fixtures its chains call.**

Where such a spec is filed is the framework's own to say; this package's answer is [03 — Testing § A specimen's capability folder](03-testing.md#a-specimens-capability-folder). An application's specs keep the route's folder — its routes are its product.

### What a file shares

A file shares only what its tests share. A SETTING every chain of a file repeats — the same `.clock(…)`, the same `.headers(…)`, the same `.env(…)` — is stated once, on a view of the facet: `const events = api.with({ clock: '2026-03-04T09:30:00Z' })`, every chain of `events` starting with it and its own setups merging over it. A seed and a stub are the Given of one test and stay on its chain; B16w warns on the setting every chain repeats, and `make fix` declares the view. A file-level expectation serves two tests or more, and one a single test reads is written in that test (D28). An expectation is never imported from another module of the specs tree (D29): a helper the test calls, a stub, the runner are imports; the value a matcher compares is the test's own. The product's own data is the subject's, not an expectation — a spec may compare against `package.json`'s version or a constant the product exports.

## The naming recap

**One folder per verb that reads the disk.** Each verb that takes what a spec stands on has its folder, named for what it holds: `seed()` reads `seeds/`, `fixture()` reads `fixtures/`, `intercept()` takes what `stubs/` declares, `request()` reads `requests/`, and `toMatch()` reads `expected/`. The inputs come in several kinds because several mechanisms set them up — a database, a working directory, the network, the request itself. The expectation is one kind, because one verb compares every subject.

One rule decides every folder of a spec tree: **what a spec stands on sits in one of four RESERVED folders; a spec's own folder never takes one of their names.** The four are `fixtures/`, `expected/`, `requests/` and `seeds/` — material a spec names by its path, spelled in full on the line that reads it (`file('./seeds/users.sql')`, `directory('../../shared/fixtures/shop/')`). The names are reserved wherever a test stands on a file, beside a module under `src/` as much as under `specs/`: the toolchain and the vitest preset ignore all four at any depth, and production code may import nothing from them (F2). A facet, a domain, and `stubs/` are members of the row, not ground: a stub is TypeScript a spec imports, so it stays bare. `docker/` sits at the project root, outside any row of specs, and is untouched by the rule.

The specs root holds its facets and ONE more folder, `shared/`: the ground several leaves share, in the same four folders — `<specs>/shared/fixtures/`, `<specs>/shared/seeds/`, `<specs>/shared/requests/`, `<specs>/shared/expected/` — each entry in the folder of its role. `shared` is reserved beside the four, directly under the specs root: no facet takes the name (C1), and deeper the word is free — `GET /shared` files under `<specs>/api/shared/get/`. A role folder at the specs root itself is shared ground outside `shared/`, refused as a folder and fixed by `jterrazz-test-check --fix`, which moves it under `shared/` and rewrites every literal that named it (C15). A shared seed is `<specs>/shared/seeds/catalog.sql`, reached as `../../shared/seeds/catalog.sql`; parked at `<specs>/shared/fixtures/seeds/` it is file state by its first ground folder, and C24 refuses it naming `<specs>/shared/seeds/`.

Three further rules decide WHETHER and WHERE ground lives, and they are one question asked from three sides.

**A file exists only if it is shared**: a golden or a request ONE test reads, and no module test names, belongs in that test, written in place — the value `toMatch` compares, the request's text or its body — unless it is a directory tree, a binary file or longer than its role's cap: 30 lines for a request or a body, 150 for an expectation. The caps hold the other way too: a request written in the test past 30 lines, or an expectation past 150, belongs in a file beside the test. A `fixtures/` entry is file state and stays a file, and so does a seed: SQL is never written in a test, so a seed one test reads lives beside it in `./seeds/`. Read by several tests of one leaf, a file sits beside them: an entry of the shared ground that exactly one leaf reaches for belongs in the leaf's folder of the same role — `<specs>/shared/seeds/x.sql` becomes `<leaf>/seeds/x.sql` (C28, both halves autofixed by `jterrazz-test-check --fix`) — unless a module test names it too — by a relative literal or by the literal pieces C8 reads — since a module test reads from outside every leaf and the entry is shared.

**What several leaves share lives there once**: an entry two leaves hold byte for byte, under the same role, is a copy whatever each is called, and belongs in the shared folder of its role — a warning, since two leaves may mean to diverge tomorrow (C27; when the copies share a name, `--fix` moves one up, deletes the others and rewrites every relative literal that named one — copies of several names wait for the author to pick the name).

**A path leaves its leaf only into that ground**: a `file()` or `directory()` whose target is neither under the referring spec's own directory nor under one of the four under `<specs>/shared/` is an error, and the sharing it wants is what those folders declare (C15) — a leaf reaching into a sibling's ground is one such path, so C15 holds that case too. One nesting is no sibling: a route's leaf holds the leaves of the routes under it (`map/pois/detail/` inside `map/pois/`), and ground the two share lives in the route's own folder of its role, which the inner leaf reaches by climbing (`../seeds/base.sql`) — C15 accepts the ground of an enclosing leaf, and C28 moves an entry of the shared ground there when only that route and the routes under it read it.

So write ground local first: the day a second leaf copies an entry, C27 moves it up, and the day only one leaf is left, C28 moves it back down — and the day only one test is left, C28 writes it into that test — an entry of the shared ground announces "other specs depend on me, change me with care", and it is there only while that is true.

Two more hold what each path says. **The verb and the folder agree**: `seed()` reads `seeds/`, `request()` and a request body read `requests/`, `fixture()` reads `fixtures/`, a golden reads `expected/` (C24). **What a path names exists**, of the kind its wrapper says — and a path a test resolves from its own directory with literal pieces alone (`resolve(import.meta.dirname, '..', 'fixtures', 'gone')`, one piece only when spelled `./` or `../` — a lone bare piece is as often a folder the test makes) too, a module test's as a spec's (C8, the checker, reported where the path is written; the runtime refuses the same with the path it resolved to). A fixer that moves ground rewrites every whole relative literal that named it, a module test's included; a path built from pieces, or spelled into a command a process runs, is the author's to rewrite, and C8 names it once the ground has moved. And a path is **built in the test that stands on it**: it resolves against the spec that starts the chain, so a `file()` built in a shared helper would name a different file for every spec that reaches it — a helper takes the `file()` as a parameter (C26).

| Thing           | Rule                                                                                                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specs root      | `specs/` (`api/`, `job/`, `cli/`, `integration/`, `website/`, `mobile/`) — one folder per constructor, beside `shared/`, the ground several leaves share: `shared/fixtures/`, `shared/seeds/`, `shared/requests/`, `shared/expected/`, and any repository suite ([the third door](#the-third-door-a-repository-suite)) |
| Specification   | `specs/<facet>/<name>.specification.ts` (at the facet root)                                                                                                                                                                                                                                                            |
| Instances       | `api`, `job`, `cli`, `integration`, `website`, `mobile` — enforced by the destructuring (A3)                                                                                                                                                                                                                           |
| Spec file       | `specs/<facet>/<subject>/<aspect>.spec.ts` — the assembled product's word (C12); the subject's folder derived where the facet has one ([One file, one subject](#one-file-one-subject))                                                                                                                                 |
| Spec document   | `<case>.spec.yaml`, beside the spec it belongs to — never under `expected/` ([20](20-documents.md))                                                                                                                                                                                                                    |
| Module test     | `<file>.test.ts`, sibling of `<file>.ts` (under `src/`)                                                                                                                                                                                                                                                                |
| Component test  | `<file>.test.tsx`, sibling of `<file>.tsx` — or of the `<file>.ts` of a hook or a DOM function ([07](07-component.md))                                                                                                                                                                                                 |
| Module fixtures | `<file>.fixtures.ts`, sibling of the `.test.ts` (typed exports)                                                                                                                                                                                                                                                        |
| Stubs           | `stubs/<name>.stubs.ts` (facade) · `stubs/<kind>/<name>.ts` (unit, kind ∈ http\|openai\|anthropic — the stub builders the package exports)                                                                                                                                                                             |
| Stub data       | `stubs/<kind>/<name>[.<qualifier>].response.json` (served) · `<name>.request.ts` (matched)                                                                                                                                                                                                                             |
| Requests        | what a spec sends: `requests/<name>.http`, read by `.request(file('./requests/<name>.http'))`, and a body `requests/<name>.<ext>`, sent by `.post(path, file('./requests/<name>.json'))`                                                                                                                               |
| Seeds           | database state: `seeds/<name>.sql`, read by `.seed(file('./seeds/<name>.sql'))` — beside its test, or at the level of the tests that share it; SQL is never written in a test                                                                                                                                          |
| Fixtures        | `fixtures/<name>` (file state) — the leaf's own; the shared pool is `specs/shared/fixtures/`, reached by the path that climbs to it, as `specs/shared/seeds/` is for seeds                                                                                                                                             |
| Goldens         | `expected/<name>.<ext>` (everything asserted, response `.http` included), read by `.toMatch(file('./expected/<name>.<ext>'))`; a tree by `.toMatch(directory('./expected/<name>/'))`                                                                                                                                   |
| Service keys    | name the service: the report prints the key, and its kebab-case form is the folder its init script sits in                                                                                                                                                                                                             |
| Framework env   | `TEST_UPDATE`                                                                                                                                                                                                                                                                                                          |

## I — Source-code architecture

Family I governs the source tree rather than the spec tree, and it splits in two.

**The layer map is the project's to declare.** `i1-layer-boundaries` ships **inert**: this package cannot know another repository's architecture, so the rule enforces nothing until the project states its own layers in `oxlint.config.ts`. What THIS repository declares, and why each sanctioned edge exists, is [01 — Architecture](01-architecture.md) — a consumer's own map is its own chapter's, written the same way.

**The test-file rules need no declaration.** I2 (a module's test is its sibling) and I4 (no `vi.mock`, `__mocks__/`, `__fixtures__/` or data-asset imports under `src/`) hold in any repository that adopts this preset — they are part of the floor described above, not of the layer map. A module's typed fixtures are a sibling `<file>.fixtures.ts`, as the naming recap says.

## The fork — which kind of test this is

The questions are asked IN ORDER, and the first yes is the kind. The answer fixes the folder, the constructor (or none), and the project. The table is generated from `lint/catalogue/fork.ts`.

<!-- GENERATED:fork — do not edit by hand; run `npm run docs`. Source: lint/catalogue/fork.ts -->

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
| Is it the repository itself — a suite over several apps?               | repository suite | `specs/<family>/<aspect>.test.ts`                | none                          | any name      |

<!-- /GENERATED:fork -->

The SUFFIX says the kind, and the checker holds it (rule C12): `.test.ts(x)`
beside the code for a unit, `.spec.ts` under `specs/<facet>/` for the assembled
product, `<case>.spec.yaml` for a literate document, `<facet>.specification.ts`
for the file that builds a runner. A repository suite is the one tree under
`specs/` that keeps `.test.ts`: its first level is not a facet, it covers a tree
rather than a product, and C1's declared depth is what judges its shape.

The fork is the SUBJECT, never the amount of machinery. A rendered component needs a real browser, a Vite pipeline, a network double and a golden engine — all of them the framework's — and it is still a unit, so it sits beside its code. A module that needs a real database needs nothing new at all, and it is still an assembled thing, so it sits under `specs/` ([06](06-integration.md)).

The table is total: **a folder under `specs/` is a constructor's name, `shared/`, or a repository suite, and there is no tenth row**. A probe of an adapter against a real service — a database driver, a cache handle — answers the seventh question, so it is an integration spec like any other; what it cannot reach through the package's public entry it should not be reaching from a spec at all, and that probe is a module test beside its module.

## The doubles ladder

Closed and ordered. An agent takes the FIRST rung that fits, and nothing below rung four is a rung.

1. **The real thing**, in-process — a pure module, a Hono app handed to `server`, a component mounted in a real Chromium.
2. **A declared service** — `sqlite()`, `postgres()`, `redis()`, `process()` ([17](17-services.md)): real, isolated per worker, reset at the start of every chain.
3. **A stub** — `.intercept()` on a chain (api, job, integration, component, website, mobile), `intercept()` in module scope ([16](16-stubs.md)). One queue, three transports ([16 § Three engines, one queue](16-stubs.md#three-engines-one-queue)), strict from the first stub (rule D7); a streamed body is `http.stream` / `http.sse`.
4. **A typed port double** — `mockOf<Port>()` for an injected interface, `vi.fn<Fn>()` for a function-shaped dependency. Asserting a call on one is a boundary observation; asserting ONLY on doubles the test built is not a test of anything. `T` is constrained to `object` and has no default, so a double asked for nothing answers for `object` — TypeScript falls back to the constraint where no inference site says otherwise, and the refusal lands where the double is USED rather than where it was made. State the port.

**Off the ladder**, each with a destination: `vi.stubGlobal('fetch')` → `intercept()`; a raw `msw`/`nock`/`sinon` import → a stub; `vi.useFakeTimers` / `vi.setSystemTime` → `clock`; `toMatchSnapshot` → a golden under `expected/`; `vi.mock` of an application module → inject the port instead. A native module a consumer genuinely cannot inject is the one allow-listed exception, per specifier, with a reason.

Where a test lives is what makes the rungs mechanizable: a module test may not carry a golden, and a module that needs a real service is an integration spec ([06](06-integration.md)). The reasoning is [ADR-005](decisions/005-the-doubles-ladder-is-closed.md).

## Time — one primitive, two depths

Determinism is structural (rule D16): a value a test SAMPLES — `Date.now()`, `new Date()`, `Math.random()`, `randomUUID()` — never reaches an oracle. Time is the one of those the framework pins for you, and `clock` is the whole vocabulary. `vi.useFakeTimers()` and `vi.setSystemTime()` are what it replaces: each of them owns a teardown a test will one day forget.

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

Both forms are `Disposable`: `using _ = clock.at(…)` gives the REAL clock back at the end of the scope, however the scope ends. `at()` leaves the scheduler real, so promises, renders and the framework's own loops keep running; `run()` queues them instead, which is what lets a test assert a five-second backoff without the arbitrary sleep J2 forbids.

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

A rule is written when its defect class has been SEEN once and its criterion is decidable. A class nobody has seen yet is not a rule: it is a line here, with the criterion it would be written against, so the day it appears the guard is a translation rather than a design. The R8 dry run — the whole catalogue run over every repository of the workbench — is what moves a line either way.

| Line                           | The criterion, ready to code                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B13 no intercept in a loop     | an `.intercept(` call inside a `for`/`while` body, or a `.map(`/`forEach(` callback, in a test file                                                                                                                                                                                                                                                                                                                                                        |
| B14 marker between statements  | a Given/When/Then marker whose offset falls inside a `VariableDeclaration` with ≥ 2 declarators — B12 (route coverage) named it first and is retired, so the proposal takes the next free id rather than the id a reader would still find in ADR-006 and iteration 10's history                                                                                                                                                                            |
| B15 pinned path tail           | a `toMatch(file(` path whose directory part repeats the leaf's own domain folder                                                                                                                                                                                                                                                                                                                                                                           |
| C19 ground per facet           | a `seeds/` or `requests/` under a facet whose specification constructs `website()` or `mobile()` — a screen owns no database                                                                                                                                                                                                                                                                                                                               |
| D21w expected pinned value     | a uuid, or an iso8601 whose time is NOT midnight UTC, in a file under `expected/` that appears in no `seeds/`, `requests/`, `fixtures/`, `stubs/` or referring test of the same leaf, nor in the `specs/shared/fixtures/` pool. The hour is part of the criterion: a clock read during a run is never exactly midnight, a publication date always is ([ADR-006](decisions/006-the-catalogue-reaches-a-file-by-its-role.md) records what the dry run found) |
| C22 golden in a module test    | a `toMatch(file(…))` in a `module`-role file OUTSIDE every `specs/` tree: a unit test standing on a golden file is an integration spec, and `specs/integration/` is where it belongs (C6 holds the same call inside a specs tree)                                                                                                                                                                                                                          |
| D27w unreachable as a negative | a test whose stub list is `http.unreachable()` on every feed and whose assertions name `result.error` alone: the case proves the call FAILED, not that it never happened. Waits on the surface — `http.never(request)` is a product line ([TODO.md](../TODO.md) § What the stub vocabulary still cannot say)                                                                                                                                               |
| D22w empty golden              | a file under `expected/` whose trimmed content is exactly `{{any}}`                                                                                                                                                                                                                                                                                                                                                                                        |
| D25 duplicate stub payload     | two response payloads with the same content hash under one `stubs/` tree, outside the shared pool                                                                                                                                                                                                                                                                                                                                                          |
| D26w inline request body       | a request body written inline in a test that also carries a `requests/` directory                                                                                                                                                                                                                                                                                                                                                                          |
| E10 no retry                   | a `retry:` option on `test(`/`describe(`, or `test.retry(`, or `retry` in a vitest config — react-query's `retry: false` is not one                                                                                                                                                                                                                                                                                                                        |
| I5 no namespace spy            | a `vi.spyOn(<namespace import>, …)` — a module's own export spied through its namespace object                                                                                                                                                                                                                                                                                                                                                             |

**Parked**, for a criterion that is not settled: **D23** no negated golden (15 hits on the workbench, every one a `toMatch(/re/)` the criterion must exclude) and **D24** unreachable stub (the criterion has to compare filter arguments, not just methods and urls).

## What stays human, and why

Every convention a machine can settle is a row with a channel. These are the
ones no channel can decide — listed with the reason, and with what the machine
takes of them anyway, so neither side is silently dropped.

| Convention                                        | Why no channel decides it                                             | What the machine takes                                                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| C1 grouping — own domain vs sibling aspects       | what the assets will become is a reading of the domain                | C21w flags the one-owner half                                                                                             |
| D11 the legitimacy of a probe                     | absence, cut output and a third-party format are meanings, not shapes | D20 / d15w / D19w draw the cluster boundary                                                                               |
| D13 residue routed through a helper               | inter-procedural analysis is out of an oxlint JS plugin's reach       | d13w's bounded heuristic                                                                                                  |
| the truth of a Given/Then sentence, or of a title | a sentence can be well-formed and false                               | B4/B10/B11 and `vitest/valid-title` hold the shape                                                                        |
| whether an updated golden is RIGHT                | correctness is the diff, read at review                               | d5 holds the volatile literals, in a document and under `expected/` alike; the pinned-value half of ground waits for D21w |
| whether an allow-listed `vi.mock` has no seam     | the claim is disputable, and recorded in the config comment           | I4 holds the list                                                                                                         |
| `exact` versus `within` when both disambiguate    | taste between two user-facing forms                                   | W2 forces a reason on the escape hatch; W3 offers both                                                                    |
| one fixture per answer of the system              | a reading of what the chain proves                                    | J4 holds unique descriptions                                                                                              |
| stub realism                                      | only a recorded exchange could judge it                               | —                                                                                                                         |
| the depth a repository declares                   | reviewed once, when the tree is born                                  | C1 thereafter                                                                                                             |

## A message teaches

A finding is the only page of the catalogue most readers ever see, so it carries what the reader needs to act without opening another: **what was found** and where, **why** the convention holds, **the fix for this case** — its paths and names, and `make fix` when a fixer does it — and **where to read** the rule whole. A message that names the fault and stops sends its reader to the chapter for what the line could have said; one that states the rule and not the case sends them back to the code to find out what it saw.

The four parts are the same everywhere a rule speaks — a static rule, a checker pass, a refusal the runtime throws — and none is optional. How each channel prints them is [19 — Linting](19-linting.md#what-a-finding-says)'s.

## Maintaining the constitution

- A new **mechanizable** rule is added to the **code** (`lint/catalogue/manifest.ts` + its implementation), not here — then `npm run docs` regenerates the catalogue. The freshness meta-test fails if the committed catalogue is no longer byte-identical.
- A new **principle** or a non-mechanizable criterion is added here, in its family section or as a process rule.
- Never duplicate a mechanized rule in this constitution: the code is its single source of truth.

## Pitfalls

- **Treating these docs as the spec.** They explain and illustrate; this constitution and the generated catalogue ([19 — Linting](19-linting.md)) decide. When you find a discrepancy in the docs, fix the docs in the same change — [02 — Developing](02-developing.md) § What a change owes.
- **Editing the generated catalogue by hand.** The [19 — Linting](19-linting.md) catalogue is GENERATED from `lint/catalogue/manifest.ts` — a hand edit is overwritten by the next `npm run docs` and fails the freshness meta-test. Change the rule's text in the code; regenerate.
- **Adding a mechanized rule to the constitution.** A machine-checkable rule lives in the code (its `meta.docs` / the manifest), not in this chapter. The constitution holds principles and non-mechanizable criteria only.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [03 — Testing](03-testing.md) · [14 — Assertions](14-assertions.md) · [19 — Linting](19-linting.md) · [06 — Integration specs](06-integration.md)
