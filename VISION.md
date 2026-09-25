# Vision 17 — the plan the three `vision/17` branches implement

## Overnight, 2026-09-24 — read this first

**Where things stand.** Three local `vision/17` branches, every gate green: package-test (17.0.0, 2742 tests), package-typescript (11.0.0, 400 tests), signews-api on both (429 tests, `make check` 32 s). Nothing pushed or released.

**What landed overnight** (iterations 20–28, details below in their sections):

- Production never imports test code: every target × form refused by F2 through one production reader, proven case by case; production = every non-test module outside `specs/` and ground; a reasoned `test.production.allow` in `jterrazz.config.ts` for a legitimate case (spwn's gate runs playwright).
- Route templates in tests: `.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })`; route coverage and the subject rules read the template; an ambiguous literal path is reported, never guessed.
- Size and complexity: `max-lines` 300 and `max-lines-per-function` 60 (off in test files), `complexity` 12 `modified`; a test body at most 60 lines of gestures (C34, a `toMatch` value not counted); every tsgolint rule decided by name; empty directories reported and removed by `make fix`.
- Performance: package-test's own lint 8.4 s → 2.5 s (a file's role computed once, cached reach walks, rules skipping what they do not judge); `typescript check` runs oxlint once and renders the human log from its JSON; a project without a config is handed the default one (no parent-folder walk).
- Upgrades: oxlint 1.85, tsgolint 7.0.2002, oxfmt 0.70, knip 6.38, tsdown 0.23, better-sqlite3 13 (prebuilt binding), perfectionist, dependency-cruiser, prettier, @types/*; research in the session notes; not taken: oxfmt for Astro (unsupported), tsgo declarations (output differs), the React Compiler transform (experimental), Rust replacements for the Markdown/secret passes (immature).
- Defects fixed along the way: the `toMatch(file())` false green on a string; table order; route tables; C4; seeds shared by nested routes; `make fix` order (checker first, formatter last); hooks copied by the split; the `prefer-spread` / `no-misused-spread` fix loop; wrong code frame after an in-place update.

**Waiting for you:** nothing — the four questions the night left (ADR-009 and ADR-010, fix mode's nested configs, C28 vs C34, the route template) were answered on 2026-09-24; see "Iteration 29 — the owner's answers" at the end.

**Decided overnight by the orchestrator (reversible):** every call listed in iterations 21–28 below; the route template (your default was asked, none came).

A working document for the owner and the orchestrator to iterate on. It lives
on the `vision/17` branch of package-test only, and is deleted once its
content has moved into the chapters. Nothing here is published: the branches
stay local until the owner and the orchestrator agree, then the packages are
refactored for real, released ONCE (`@jterrazz/test` 17.0,
`@jterrazz/typescript` 11.0), and the estate migrates in one wave.

The three branches:

| Clone                                                | What it shows                                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `home/jterrazz/work/repositories/package-test`       | the test API, the manual, the lint rules' home and spec form, the package's own specs migrated       |
| `home/jterrazz/work/repositories/package-typescript` | the toolchain: the naming rule, the repository spine, the end of generated reference, its own layout |
| `home/signews/work/repositories/signews-api`         | the effect on a real application (api, jobs, integration, seeds, requests, goldens)                  |

## The goal in one sentence

A test reads without knowing any hidden convention: everything it touches is
visible on the line that touches it, and every documented fact lives in one
place.

## 1. A file is named by a path, and its verb says so

Today a bare string is sometimes a value and sometimes a file name resolved
against a hidden folder:

```ts
expect(result.stdout).toMatch('scaffolded.txt'); // looks like a value, is _expected/scaffolded.txt
await jobs.seed('subscribers.sql'); // hides _seeds/, hides local vs shared
await cli.fixture('$FIXTURES/shop/'); // a magic prefix for the pool
```

In 17 every verb that reads the disk ends in `File` or `Directory`, and its
argument is a path relative to the spec file, spelled in full. The type
refuses anything that is not a path:

```ts
type RelativePath<Extension extends string = string> =
    | `./${string}${Extension}`
    | `../${string}${Extension}`;

seedFile(path: RelativePath<'.sql'>, options?: { database: string })
requestFile(path: RelativePath<'.http'>)
fixtureFile(path: RelativePath)
fixtureDirectory(path: RelativePath<'/'>)
toMatchFile(path: RelativePath)
toMatchDirectory(path: RelativePath<'/'>)
```

```ts
expect(result.stdout).toMatchFile('./expected/scaffolded.txt');
await jobs.seedFile('./seeds/subscribers.sql').trigger('digest');
await cli.fixtureDirectory('../../fixtures/shop/').exec('build'); // the shared pool, visible in the path
```

- `seed()`, `request()`, `fixture()` and the file form of `toMatch(name)` are
  removed. `toMatch`, `toBe`, `toContain` keep their Vitest meaning: a string
  is a value.
- `$FIXTURES/` is removed. The shared pool is `<specs>/fixtures/`, reached by a
  relative path. A path may leave its leaf only to reach the pool (C15
  restated); anything else is an error.
- The `.spec.yaml` documents follow the same law: `fixture: ./fixtures/shop/`.
- `{{any}}`-style tokens and `TEST_UPDATE=1` keep working on every `…File`
  and `…Directory` matcher.
- The checker's mover rewrites every call and document mechanically.

## 2. Ground folders are bare, reserved names

| 16                             | 17                  | Holds                                          |
| ------------------------------ | ------------------- | ---------------------------------------------- |
| `_fixtures/`                   | `fixtures/`         | input files and file-system state              |
| `_seeds/`                      | `seeds/`            | database state, `.sql`                         |
| `_requests/`                   | `requests/`         | input requests, `.http`                        |
| `_expected/`                   | `expected/`         | everything asserted, response `.http` included |
| `_fixtures/` at the specs root | `<specs>/fixtures/` | the shared pool                                |

- The four names are reserved under `specs/`: C1 refuses a facet, domain or
  suite folder that takes one of them.
- Every tool ignore that said `**/_fixtures/**` says
  `specs/**/{fixtures,expected,seeds,requests}/**`.
- `contracts/` stays: it is TypeScript a spec imports, not ground.

## 3. Names say what a thing is in the domain

A file is never named after a language construct. Refused basenames, in
`src/`, `lint/` and `specs/` alike:

```
types  type  interfaces  constants  utils  util  helpers  helper
common  shared  misc  setup  lib   and any  *.types.ts  suffix
```

`index.ts` stays (a barrel is a structural role, not a category). The rule
lives in `@jterrazz/typescript`'s Names pass, so it judges every repository,
not only tests. Existing sites go on the ratchet and are renamed by domain.

## 4. The repository spine

Every repository root has the same shape, written once and checked by the
toolchain:

```
src/     the product's code, and nothing else
lint/    the lint rules the package ships — one folder per rule
specs/   the specifications, one folder per facet (+ repository suites)
docs/    the manual, published in the tarball
skills/  one short SKILL.md per skill, nothing else
```

Beside `.test.ts` tests (inside `src/` and `lint/`) stay: a module is tested
beside itself, the assembled product under `specs/` — Rust's split exactly.

A lint rule's specification is a `.spec.yaml` document on the cli facet: a
tree in, the command, the normalised report out (one line per diagnostic,
`file:line:column  plugin(rule)`), so the golden proves the position and not
only the presence:

```
specs/lint/i2-sibling-test-naming/
  rejects-orphan-test.spec.yaml
  accepts-sibling.spec.yaml
  fixtures/orphan/…
  fixtures/sibling/…
```

The runner states oxlint's format (`--format=unix`, or `agent`): without it
oxlint picks graphical frames outside an agent's shell, CI included, and
`lintReport` refuses them rather than read them as a clean run.

```yaml
description: a module test with no neighbour module is refused
fixture: ./fixtures/orphan/
runs:
    - command: .
      exit: 1
      stdout: |
          src/orphan.test.ts:1:1  jterrazz(i2-sibling-test-naming)
```

## 5. Knowledge has one owner each

- The API is the types. `docs/reference/`, typedoc, `typescript docs` and the
  Docs (sync) pass are deleted from both packages.
- The manual is `docs/`, read from the install.
- A skill is one hand-written `SKILL.md`, capped, holding what is decided
  before writing (which facet, the pitfalls, the chapter to read next).
  `skills/*/references/` is deleted; no generated projection of any kind.
- A check fails when a skill names a symbol the types do not export or a
  chapter that does not exist.

## 6. Also in 17

- Element names are exact: the substring window of 16.x is removed.

## What the branches show, and what they defer

| Area             | package-test                                                                                                                                                                                                                                                                                                                                                                                                                                                    | package-typescript                                                             | signews-api         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------- |
| §1 verbs + types | shown (iteration 1, variant A): `file()`/`directory()` branded, the simple verbs take them, `toMatch` vitest's plus the golden half, type and runtime refusals; own specs, lint fixtures and chapters migrated by the mover                                                                                                                                                                                                                                     | own documents and chains on the File/Directory verbs (the mover, then by hand) | migrated            |
| §2 folders       | shown: renamed everywhere, C1 refuses a reserved domain, C13 flipped with the 16→17 mover as its `--fix`, C15 restated, the bare-ground bridge deleted                                                                                                                                                                                                                                                                                                          | ignore globs; own specs on the bare ground, its underscore bridge deleted      | renamed             |
| §3 names         | shown: the three `types` sites renamed (`oxlint-api`, `exchange`, `component.shape`)                                                                                                                                                                                                                                                                                                                                                                            | the rule, tested                                                               | ratchet delta shown |
| §4 spine         | shown: `src/lint` → `lint/`, I1 reads the spine; 4 rules as `.spec.yaml`. Deferred: 81 rule specs, `lint/` one folder per rule                                                                                                                                                                                                                                                                                                                                  | the spine check (`bin/`, `lib/`, `presets/` reported); `rules/` → `lint/`      | follows             |
| §5 knowledge     | shown: reference, typedoc, skill references and cards deleted; SKILL.md 106 lines, held by a meta-test                                                                                                                                                                                                                                                                                                                                                          | `docs` command, typedoc, Docs (sync) deleted                                   | —                   |
| §6 exact names   | shown: the window removed from the three adapters, with its commands and its name reading                                                                                                                                                                                                                                                                                                                                                                       | —                                                                              | —                   |
| guards (iter. 1) | shown: role C24 (static), locality C15/C14 over the wrappers, existence C8 (checker pass; the oxlint C8 retired), F2 refusing ground imports, C25 refusing golden synonyms                                                                                                                                                                                                                                                                                      | ignores the four names at any depth                                            | —                   |
| iteration 2      | shown: `.text` the comparable text and `.raw` the capture, `toContain` vitest's and refused on a stream by the types, D8w restated on `.raw` (`d8w-raw-bypass`), the mover's stream gesture; C8 over module tests (member pass); C24 through a `const`; C26 `file()` built in the test only; `schema/` under `jterrazz.typescript.roots`                                                                                                                        | `--oxlint-report` handed over; `jterrazz.typescript.roots` read                | —                   |
| iteration 3      | shown: the mover gated on C13 (a tree with no 16 folder left byte for byte) and walking every member's module tests, C13 beside a module test; a directive naming `d8w-text-bypass` renamed, its line read as `.raw`; `toBeEmpty` a table's matcher alone (types, both runtimes, the mover); every rule reading a path below its package root; the green ratchet run one line                                                                                   | —                                                                              | —                   |
| iteration 4      | shown: the mover gated per file (a 17 file beside a 16 one left byte for byte, a 16 pool reaching only the files naming `$FIXTURES/`); the directive rename on every `--fix`, read in a comment only; a file outside every package read below its repository root; the Makefile's six targets, `fix` the two fixers                                                                                                                                             | —                                                                              | —                   |
| ratchet, report  | shown: `test.baseline.json` recorded by `jterrazz-test-check baseline` and judged by the checker; the checker's report line; `lintReport` published, refusing oxlint's graphical frames; iteration 2: `--oxlint-report <file>` read, the judging run prints every finding it counts and every plugin diagnostic                                                                                                                                                 | `typescript.baseline.json`, jterrazz keys refused                              | —                   |
| iteration 9      | shown: 62 — a green run keeping no `test` section prints `jterrazz.baseline.json › test: nothing held`, a deferring run names the judging file relative to the project; 63 — a stream handed a value `toMatch` past the compiler is refused naming `.text`, in both builds                                                                                                                                                                                      | —                                                                              | —                   |
| iteration 10     | shown: `kind: api` and `kind: jobs` documents — the grammar, the schema, the runner (`api.run`, `jobs.run`, the plugin by kind, the `api()`/`jobs()` door), steps and captures, every path key under C24/C15/C8/C9; B12 route coverage from a declared OpenAPI source; this package's pure-data api and jobs specs migrated; chapter 20 owns the format                                                                                                         | —                                                                              | —                   |
| iteration 14     | shown: variant B — `toMatch` compares a whole result to a value in place or to `file()`/`directory()` (`toMatchRows` retired), `sql` seeds, `TEST_UPDATE=1` writing the value into the test source, C28 (a file exists only if shared; C14 folded in), D20 (every test compares its whole result; D12w folded in), route coverage measured at run time (B12 retired); iteration 10's api/jobs documents retired and this package's specs migrated to TypeScript | —                                                                              | —                   |
| iteration 18     | shown: `sql` removed (export, types, runtime, docs), `seed()` a `.sql` `file()` alone; C28's seed branch (a seed one test reads lives beside it) and per-role caps both ways (requests 30, expected 150); the fixer writes inline `sql` to `./seeds/<name>.sql` and a value past its cap to a file; this package's specs migrated                                                                                                                               | —                                                                              | —                   |
| iteration 19     | shown: 97 `specification.cli(bin, { commands })` read by the subject reader, first word by default; 98 `test: { collections }` read from `jterrazz.config.ts`; 100 the C29 split moves a helper several new files read into `<folder>/<folder>.fixtures.ts`                                                                                                                                                                                                     | —                                                                              | —                   |

Each branch keeps one commit per unit, so the owner can read the vision
commit by commit.

The two package clones consume each other: each declares the other as a
`file:../<clone>` devDependency, installed as a packed copy (`install-links`
in its `.npmrc`), so the toolchain judges package-test and package-test runs
package-typescript's specs. Each clone carries it in one `build(vision)`
commit, prototype plumbing that never reaches the release.

### Deferred in package-test

- **The toolchain's checker floor.** `CHECKER_FLOOR` in `@jterrazz/typescript`
  stays `15.3.0` for the prototype, and becomes `17.0.0` at the release: the
  `--oxlint-report` flag and the judging run's log are 17's.

- **`lint/` one folder per rule.** The rules moved to the root as they were,
  `lint/rules/<facet>/<rule>.ts` beside its test.
- **The lint rule specs still to convert in the refactor** — the checker's,
  `specs/lint/checker/<pass>.test.ts` over the twins in
  `specs/lint/checker/fixtures/lint-violations/`, each to become
  `specs/lint/<pass-id>/<case>.spec.yaml`: a7, b5, c8-spec, c9, c12, c16,
  c18, c20, c21w, c23, d4 ×2, d4b ×4, d5, d5w, d10w, d11w, j3w, j4, j5, j9,
  member-pass, checker-cli, kitchen-sink; and the k4 reach meta-test. Every
  static rule is converted (the spec-coverage pass converted the last 51,
  c13's tree clause included), and a meta-test holds each to a golden naming
  the line and column it fires on.

## Open questions for the iteration

1. package-typescript's own root carries `bin/`, `lib/`, `presets/` beside
   `src/`: under the spine they are product code. Move them under `src/`, or
   does the spine allow a package to declare extra roots?
2. The spine names `lint/` for a package that SHIPS rules. A repository that
   ships none has no `lint/`; its own lint config stays `oxlint.config.ts` at
   the root.
3. Does `requestFile` stay beside the inline `.post(path, body)`, or does a
   request body get its own `…File` form (`.post('/orders', bodyFile('./requests/order.json'))`)?
4. Reserved folder names: should `snapshots/` or `golden/` be refused as
   synonyms of `expected/` so no repository invents a second word?
5. `cli.run('<case>.spec.yaml')` reads the disk and keeps its name: it runs a
   document, it does not load ground. Does §1's law ("every verb that reads the
   disk ends in `File` or `Directory`") make it `runFile('./<case>.spec.yaml')`,
   with the same `RelativePath` type?
6. `toMatch` keeps a runtime override on a STREAM accessor only, so
   `expect(result.stdout).toMatch(/built/)` reads the comparable text (ANSI
   stripped) where vitest's own would refuse an object. On a json, response or
   tree subject it is refused, naming the file matchers. Keep the override, or
   let `toMatch` be vitest's with no exception and write `result.stdout.text`?
7. The chain splits `fixtureFile` / `fixtureDirectory` (a directory always
   spreads; copying one under its own name is no longer a chain gesture), but a
   document's `fixture:` is one key with the rsync rule (a trailing `/`
   spreads, none copies under the name). Split the document key the same way,
   or keep one key because a path's trailing `/` already says it?
8. The reserved names are reserved "under `specs/`", but a module test's ground
   lives under `src/` too (`src/model/result/expected/`,
   `src/runner/fixtures/`). Are the four names reserved everywhere a test
   stands on a file, and do the ignore globs become
   `**/{fixtures,expected}/**` rather than `specs/**/…`? Until it is
   answered, package-test's oxlint config states
   `src/**/{fixtures,expected}/**` itself: the toolchain's globs stop at
   `specs/`, and e2-preset-config would judge the fixture project's
   `vitest.config.ts`.
9. The toolchain's tree sweep also treats `_stubs/` and `_binary/` as ground.
   17 has four names and only four: this branch moved its `_binary/` code
   ground under `fixtures/binary/`. Do `_stubs`/`_binary` retire from the
   toolchain's list, or does 17 need a fifth name for code a spec runs?
10. The report normalisation of §4 is the report runner's `transform`, local to
    `specs/lint/report.specification.ts`. package-typescript's rule specs will
    want the same: publish it (`lintReport` from `@jterrazz/test`, or a
    `report: 'oxlint'` runner option), or keep one copy per repository?
11. A checker line has no column and no rule name
    (`[error] specs/x.spec.ts:7: … (C15 — see …)`), so the normalised report
    passes it through whole. Should the checker print
    `file:line:column  jterrazz-check(<id>)` too, so both channels golden alike
    and the message moves no golden?
12. The 16→17 mover is C13's `--fix`. After the migration wave, doctrine says
    no legacy: does C13 and its mover retire in 17.1, or stay as long as a
    16.x tree can still arrive?

### Raised by the package-typescript branch

13. The spine check (`names-root-foreign`, a warning) fires on every root
    folder outside the spine. Framework-imposed roots (`public/`, `app/`,
    `ios/`, `android/`) and `scripts/` would warn in every Next, Astro and
    Expo repository: allow them by name, or let a repository declare its
    extra roots?
14. `setup` is refused by §3, and `vitest.setup.ts` / `setup.ts` exist across
    the estate: keep `setup` refused (a setup file is named for what it
    prepares), or exempt a runner's setup file?
15. The rulebook's shared plugins could not stay in `rules/core/` (`core` is a
    refused grab-bag name) and became `language/` under package-typescript's
    `lint/`. `lint/` in package-typescript holds decision files per plugin,
    not one folder per rule: is "one folder per rule" the law for rule
    SHIPPERS only?
16. With the docs pipeline gone, the `library` lint profile is identical to
    `node`: fold the two profiles into one?
17. The ignore globs are `**/specs/**/<name>/**` (four globs, no braces), so a
    workspace root's config also reaches `apps/<member>/specs/…`.
18. A Names finding is now recorded on the ratchet as `names/<rule>`: the
    ratchet has three reporters (oxlint, the test checker, Names).

### Raised by the package-test branch, iteration 1

19. The checker runs oxlint a second time to count the `jterrazz(*)`
    diagnostics `typescript check` already produced and set aside. Should
    `typescript check` hand its JSON report over (`--oxlint-report <path>`,
    known to the checker's parser) instead?
20. The installed toolchain reads a declared root from `jterrazz.roots`; the
    settings section above writes `jterrazz.typescript.roots`. This branch
    declares `schema/` where the toolchain reads today.
21. A stream compared as a value reads `result.stdout.text`, which is RAW (ANSI
    kept, `transform` not applied) while the golden compares the comparable
    text. Is `.text` the value a reader means, or should `.text` become the
    comparable text? And `toContain` still reads an accessor's comparable text
    through the framework's override: keep, or make it vitest's too?
22. The root member's run exits on the whole project's counts but prints only
    its own findings; a tree finding above its entry is printed by the
    per-root run (which exits 0) and failed by the member run. Accept, or have
    `typescript check` run the checker path-less once?
23. Existence (C8) walks `specs/` trees only: a module test's
    `file('./expected/…')` under `src/` is not checked statically (the runtime
    still refuses it). Extend the member pass to module tests?
24. C24 judges a literal path handed straight to a verb; a `file()` bound to a
    variable first escapes the role guard (C8 still resolves it).
25. A `file()` built in a helper module shared by several specs resolves per
    caller, against the spec that starts the chain. Capture the caller at
    `file()` instead, at the cost of the page's golden commands?

## Iteration 1 — the owner's answers (2026-09-22)

| #          | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| baseline   | The ratchet splits by owner: `typescript.baseline.json` (oxlint's own rules, Names) and `test.baseline.json` (every `jterrazz(*)` static rule and every checker finding). Each package's command writes its own file.                                                                                                                                                                                                                             |
| 1, 13      | A repository may carry roots beyond the spine, but only CODIFIED ones: the toolchain knows the ecosystem-imposed roots by name (npm `bin/`, framework roots like `public/`, `app/`, `ios/`, `android/`, `prisma/`), and a repository declares any other in its config, each with a reason. Code the package ships goes under `src/` (package-typescript's `lib/` and `presets/` move there). The composable base packages keep a permissive list. |
| 2          | Confirmed: no `lint/` in a repository that ships no rules.                                                                                                                                                                                                                                                                                                                                                                                        |
| 3, 5, 7    | Wait for the §1 variant choice (below). `runFile` is refused as a name.                                                                                                                                                                                                                                                                                                                                                                           |
| 4          | `snapshots/`, `golden/`, `goldens/`, `__snapshots__/` are refused: only `expected/`.                                                                                                                                                                                                                                                                                                                                                              |
| 6          | `toMatch` is Vitest's, with no override: a stream is compared as `result.stdout.text`.                                                                                                                                                                                                                                                                                                                                                            |
| 8          | The four ground names are reserved everywhere a test stands on a file, not only under `specs/`. A rule makes production code unable to import test material: a non-test module importing a `*.test.ts`, a `*.fixtures.ts` or anything under a ground folder is an error.                                                                                                                                                                          |
| 9          | Only what sets a spec's world up is codified. `_binary/` and `_stubs/` retire: a program a spec runs is a fixture. No fifth name.                                                                                                                                                                                                                                                                                                                 |
| 10         | Polish the report normalisation and publish it once (the rule specs of both packages use it).                                                                                                                                                                                                                                                                                                                                                     |
| 11         | The checker prints the same line as oxlint (proposal below); no legacy format kept.                                                                                                                                                                                                                                                                                                                                                               |
| 12         | No legacy: the 16→17 mover retires in 17.1.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 14         | `setup` is allowed.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 15         | `core` is allowed.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 16, 17, 18 | Accepted as proposed.                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Proposed report line (question 11)

Both channels print the compiler convention every editor's problem matcher
parses, and a golden keeps only the part that proves the finding:

```
report  specs/api/orders/create.spec.ts:7:5: error jterrazz-check(c15): a path may leave its leaf only into specs/fixtures/
report  src/orphan.test.ts:1:1: error jterrazz(i2-sibling-test-naming): a module test has a sibling module
golden  specs/api/orders/create.spec.ts:7:5  jterrazz-check(c15)
golden  src/orphan.test.ts:1:1  jterrazz(i2-sibling-test-naming)
```

## Iteration 1 — §1 decided: variant A

A string is a value; `file()` and `directory()` are the disk. Verbs keep
simple names and take either:

```ts
.seed(file('./seeds/subscribers.sql'))
.post('/orders', file('./requests/order.json'))
.request(file('./requests/create-user.http'))
expect(result.response).toMatch(file('./expected/created.http'))
expect(result.stdout.text).toMatch(/built/)            // Vitest's own
await expect(result.directory('out')).toMatch(directory('./expected/scaffold/'))
cli.run(file('./build.spec.yaml'))
cli.fixture(file('./fixtures/config.json'))            // copied under its name
cli.fixture(directory('../../fixtures/shop/'))          // spread into the workdir
```

`seedFile`, `requestFile`, `fixtureFile`, `fixtureDirectory`, `toMatchFile`,
`toMatchDirectory` and `runFile` do not exist. A document's `fixture:` key
takes the same two forms (`{ file: ./… }` / `{ directory: ./… }`, or the
trailing `/` if the grammar stays one key — the branch decides and says so).

The guards, one per level:

| Level     | Guard                                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type      | `file()`/`directory()` accept `RelativePath` only; each verb accepts only their branded return (or a value where a value makes sense)                                                           |
| role      | static rule: the verb and the ground folder agree — `seed` → `seeds/*.sql`, `request`/body → `requests/`, `toMatch` → `expected/`, `fixture` → `fixtures/`                                      |
| locality  | a path stays in its leaf or reaches `<specs>/fixtures/`, nothing else (C15); a pool entry one leaf uses moves beside it (C14, autofix); a leaf's ground reached from a sibling is refused (C17) |
| existence | the checker verifies statically that every `file()`/`directory()` target exists; at runtime a missing target fails with its resolved path                                                       |

### What the package-test branch decided (iteration 1)

- **The document's `fixture:` stays ONE key with the trailing-`/` rule**, and
  now means exactly what the chain means: `./x/` is a directory spread,
  `./x` one file copied under its name. A path whose `/` disagrees with the
  disk is refused in both doors, and so is a path that names nothing. Copying
  a directory under its own name is no longer expressible anywhere. The
  grammar also refuses a `fixture:` path that reaches no `fixtures/` folder —
  the role guard for documents, one parser for the checker and the runner.
- **`toMatch` is vitest's, untouched, for a value.** The golden half is
  registered under an unreachable name, and `chai.util.overwriteMethod`
  routes only a `file()`/`directory()` argument to it; everything else calls
  vitest's own matcher. The types add the golden half by subject.
- **A `file()` resolves against the spec file that started the chain** (or the
  accessor's test directory), exactly as the path strings did.
- **Role (C24) is a static rule over literal paths handed to a verb**; `run()`
  accepts a document beside the test or under `fixtures/` (an input a negative
  spec runs, which no glob may collect).
- **C17 is not a rule of its own**: a leaf's ground reached from a sibling is a
  path leaving its leaf, which C15 reports. Chapter 18 drops the C17 line.
- **Existence is the checker's C8 pass**, as the table asks; the oxlint
  `c8-referenced-fixture-exists` retires with it, one finding in one channel.
- **Answer 8's rule is F2, extended** (production importing a ground folder),
  not a second rule saying two thirds of the same sentence.
- **C25 refuses a synonym folder a test would stand on**: under `specs/`
  always, elsewhere when it holds no module of code — `src/model/goldens/` is
  matcher source and stays. This repository's integration domain `golden/`
  became `table/`.
- **`lintReport` is an export**, not a runner option:
  `specification.cli(bin, { transform: lintReport })`.
- **The ratchet run is the whole-project run**, and `--member <root>` is one:
  `typescript check` never runs the checker path-less, so the root member's
  run prints that member's findings and judges the project's counts; every
  other run under a cwd keeping `test.baseline.json` reports and exits 0. The
  checker gets the plugin's diagnostics by running the project's own oxlint
  (`<root>/node_modules/.bin/oxlint`, JSON, no `--type-aware`).

## Iteration 1 — per-repository settings

A repository's human decisions for the family live in `package.json` under
`jterrazz`, one sub-property per package, each package reading only its own:

```json
{
    "jterrazz": {
        "typescript": { "roots": { "scripts": "the release scripts CI runs" } },
        "test": {}
    }
}
```

The ratchets stay out of it: `typescript.baseline.json` and
`test.baseline.json` at the root are measurements a tool rewrites on every
`chore(lint)`, `package.json` ships in the tarball and churns with every
dependency bump, and a decision (rare, reasoned) is not a measurement.

## Iteration 2 — the orchestrator's calls on questions 19–25 (2026-09-23)

| #   | Decision                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | `typescript check` hands its oxlint JSON report to the checker with a known flag, `--oxlint-report <path>`; a checker run without it (standalone, a member run) runs oxlint itself. One oxlint run per `check`.                          |
| 20  | The toolchain reads `jterrazz.typescript.roots`, and only that (no legacy `jterrazz.roots`).                                                                                                                                             |
| 21  | `result.stdout.text` is the COMPARABLE text — colour codes stripped, `transform` applied — the same text a golden compares; the raw stream is `result.stdout.raw`. No matcher override remains on streams (`toContain` is Vitest's too). |
| 22  | The run that judges the ratchet prints the findings it judges: a verdict and its evidence are always in one log.                                                                                                                         |
| 23  | C8 (existence) walks every tree a test stands on — `src/` and `lint/` module tests included.                                                                                                                                             |
| 24  | C24 follows a `file()`/`directory()` bound to a `const` in the same file to the verb it reaches.                                                                                                                                         |
| 25  | `file()`/`directory()` may be called only in a test or spec file: a shared helper module takes a `file()` as a parameter, it never builds one (its resolution would depend on the caller).                                               |

### What the package-test branch decided (iteration 2)

- **19** — `--oxlint-report <file>` is one of the parser's three valued flags,
  so its value is never read as the project root; a path naming no file is
  refused (exit 1), a report holding no JSON throws naming it. Every run
  accepts the flag; only a run that judges plugin diagnostics reads it.
- **21** — `toString()`/`valueOf()` give `.text` too. `.grep()` cuts the raw
  capture and the accessor it returns applies the same normalisation. Vitest's
  `toContain` handed a stream reads it as an EMPTY LIST (`Array.from`), so
  `.not.toContain` passed on anything: the types refuse a stream there
  (`toContain: never`, keyed on the structural `raw` + `streamName`). D8w's
  hazard moved one accessor over, so it is restated rather than retired:
  `d8w-raw-bypass`, a substring check on `.raw`. `toBeEmpty` on a stream stays
  — it is the framework's matcher, not an override of vitest's. The mover
  moves `expect(<stream>).toContain|toMatch(<value>)` to `.text` for the text
  members of every facet (`stdout`, `stderr`, `content`, `tree`, `html`,
  `console`, `errors`, `error`, `title`, a `.grep(…)` after them); `body` and
  `value` stay, json as often as text.
- **22** — with a file, the judging run prints every finding it counts,
  whichever tree or member holds it, and every plugin diagnostic on the
  checker's report line; `--member <root>` and the path-less run print the
  same log. Without a file it judges and prints its own findings and the
  plugin's. `--format json` keeps its contract: the checker's own findings.
- **23** — C8 is one per-file check shared by the tree pass (`specs/` trees)
  and the member pass (every other test of the member, never ground, never a
  nested package). A `file()` written inside a string literal is text and is
  not read — without that, every RuleTester case would be a finding.
- **24** — the nearest `const` declaration whose block encloses the call, as
  the language resolves it; reported at the argument handed over. A `let`, a
  parameter and a computed path stay out of reach.
- **25** — C26 `c26-disk-named-in-the-test`, static, reach `all`: a
  `file`/`directory` imported from the framework's entry and called in a file
  that is not a test (a specification and a contract included; a type test
  `.test-d.ts` is a test) is an error at the call. No runtime refusal: `file()`
  would have to read the stack at every call to tell a helper from a test.
- **20** — `schema/` is declared under `jterrazz.typescript.roots`.
- **lintReport** — the runner states oxlint's format; a graphical frame
  makes `lintReport` throw instead of normalising to the empty text.

### Raised by the package-test branch, iteration 2

26. The checker's `--fix` runs the 16→17 mover on every run, over a tree
    already on 17: `npm run lint:fix` on this repository rewrote a deliberate
    negative spec (`cli.fixture('cli-app/' as never)`, the 16 spelling the
    runtime must refuse) into a `directory()` naming nothing, which C8 then
    failed. Should the mover run only on a tree that still carries a 16 folder
    (a C13 finding), or be its own gesture (`jterrazz-test-check migrate`)?
27. The mover walks `specs/` trees only, so a module test's
    `expect(result.stdout).toContain(…)` under `src/` is left for the compiler
    to name. Extend its walk to the member's module tests, as 23 did for C8?
28. The judging run now prints every plugin diagnostic the file holds: this
    repository's `npm run lint` prints 106 held lines on every green run.
    Print held findings only on a failing verdict, or always (the decision
    as read)?
29. Renaming `d8w-text-bypass` turns every consumer suppression of it into a
    directive naming no rule (9 across the estate, ADR 006's count). The
    toolchain's suppression gate names them; is that the migration, or does
    the mover rewrite the directive (most become unnecessary, since `.text`
    is now the compliant form)?
30. The role reader (`roleOf`) calls any unsuffixed file ground when ANY
    segment of its absolute path is one of the four names — a checkout under
    a folder named `fixtures/` would make every module ground. The rules
    reading it are safe today only because the toolchain ignores ground
    folders; read the segments below the package root instead?
31. `toBeEmpty` on a stream is the last framework matcher a stream subject
    offers besides the golden. Keep it, or let an empty stream be
    `expect(result.stderr.text).toBe('')`, with no framework matcher on a
    stream but the golden?

## Iteration 3 — the orchestrator's calls on questions 26–31 (2026-09-23)

| #            | Decision                                                                                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26           | The mover is idempotent: it runs only on what C13 finds still 16.x-shaped, never on a 17 tree.                                                                                                                   |
| 27           | The mover walks every tree a test stands on (`src/` and `lint/` module tests too).                                                                                                                               |
| 28           | A green run prints one summary line per reporter (`test.baseline.json: 106 held across N rules`); the full list prints only when the verdict fails. Q22 holds: a failing verdict and its evidence share one log. |
| 29           | No legacy: the mover rewrites a directive naming a renamed rule (`d8w-text-bypass` → `d8w-raw-bypass`), and a directive naming a retired rule is dead (the Suppressions pass reports it).                        |
| 30           | Every rule reads paths relative to the project root, never absolute segments.                                                                                                                                    |
| 31           | `toBeEmpty` on a stream retires: `expect(result.stdout.text).toBe('')` is Vitest's own.                                                                                                                          |
| oxlint twice | `typescript check` still runs oxlint twice (human log + JSON). Building the log from the JSON makes it one run: to decide by the owner.                                                                          |

### What the package-test branch decided (iteration 3)

- **26** — the gate is per TREE, on the tree's own 16 folders (the four
  names C13 reads): a `specs/` tree, or a member's module tests. A 16 tree
  migrates whole in one run, specs with no ground beside them included; a 16
  tree holding no ground folder at all is not moved — nothing in it tells a 16
  string from a 17 value — and chapter 04 lists it among what the reader
  finishes by hand. The ungated run had rewritten the mover's own unit test
  (its Given already read `.text`, so it proved nothing); it is restored.
- **27** — `migrateModuleTestsTo17(member)` walks what C8's member pass walks
  (every test outside `specs/`, never ground, never a nested package). The
  path-less run and a named project root apply it to every member; a named
  specs tree moves that tree alone. C13 now reaches every test (reach
  `tests`): a 16 folder beside a module test is refused, the old pool probed
  only under a specs root. The migration's command becomes the path-less
  `jterrazz-test-check --fix`.
- **29** — the renamed-rule table has one row, `d8w-text-bypass` →
  `d8w-raw-bypass`: `c13-underscored-ground` enforced the opposite law, and
  `b2`/the oxlint `c8` retired, so none is a rename. The line a `-next-line`
  or `-line` directive covers moves its read from `.text` to `.raw`: 16's
  `.text` WAS the raw capture, and renaming the directive alone would leave
  it covering nothing while the test silently compared another text. A range
  directive is renamed only. The gesture runs under question 26's gate.
- **30** — "the project root" is read as the NEAREST package root (the
  directory holding the file's `package.json`), so a workspace member's file
  is read below the member, as `specsAnchor` already was. A path no package
  holds is read whole — the rule tests' `/repo/…` cases. Sites moved:
  `roleOf` (ground, contract, the retired roots), I1's layer path, C4's
  `contracts` index, I4's banned folders, C25's "under `specs/`", and the
  CLI's "is this a specs tree".
- **31** — the types refuse a stream; the node matcher refuses one naming
  `expect(<stream>.text).toBe('')`; the page, which holds no table, registers
  `toBeEmpty` only to refuse, as a rejection like the node one. D2 keeps
  `toBeEmpty` as an IO matcher (a table's is a query). The mover's gesture
  drops the `await` with the promise.
- **28** — green: `test.baseline.json: <n> held across <k> rules`, then what
  ran (the passes, as the clean line names them). `--format json` prints the
  findings whatever the verdict, and the runs that defer to the file (one
  specs root, another member) still print what they found — they judge
  nothing.

### Raised by the package-test branch, iteration 3

32. Question 26's gate is per tree, so a tree with ONE 16 folder left
    anywhere re-runs every gesture over every file, a 17 negative spec
    beside it included. Gate per file instead (the test files C13 flags), at
    the cost of leaving a 16 spec with no ground beside it unmoved?
33. A tree already moved by an ungated mover (signews-api, migrating now from
    a snapshot of this package) has no 16 folder left, so the gated mover
    never renames its `d8w-text-bypass` directives: the Suppressions pass
    names them and they are fixed by hand. Accept, or let the unambiguous
    gestures (a directive rename) run on every tree?
34. `projectSegments` reads a path whole when no `package.json` holds it: a
    loose file outside every package still reads absolute segments. Accept
    as the rule tests' escape, or refuse to judge such a file?
35. "One summary line per reporter" is met by the checker alone:
    `typescript.baseline.json`'s line is package-typescript's to align.
36. The mover now spells a renamed rule's old id, and chapter 04 must name it
    on the line that says it "no longer exists" — the k2 meta-test skips only
    such lines. A migration table read by k2 would replace the phrase
    convention.
37. The brief names `make fix`; this repository's Makefile has no `fix`
    target (`npm run lint:fix` is the gesture). Add the target, or change
    the brief?

## Iteration 3 — the owner's answers and the calls on questions 32–37 (2026-09-23)

| #                    | Decision                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| variant A repetition | Accepted by the owner: `file()` stays on every verb, `seed` and `request` included.                                                                                                                                                                                                                     |
| tracked files        | Owner: every tree gate judges TRACKED files only (`git ls-files --cached`), so a baseline is the same on a clean checkout and locally; `config/` joins the ecosystem roots.                                                                                                                             |
| 32                   | The mover's gate is per FILE: a file already 17-shaped is never rewritten, whatever the rest of its tree holds.                                                                                                                                                                                         |
| 33                   | Renaming a retired directive id is idempotent, so that gesture runs on every `--fix`, outside the 16.x gate.                                                                                                                                                                                            |
| 34                   | A file outside every package is read relative to the git root, never by absolute segments.                                                                                                                                                                                                              |
| 35                   | `typescript check` prints the same one summary line per ratchet file on a green run.                                                                                                                                                                                                                    |
| 36                   | Accepted as is.                                                                                                                                                                                                                                                                                         |
| 37                   | The spine grows a Makefile contract: every repository answers `make install`, `build`, `lint`, `fix`, `test` and `check`, the toolchain checks the targets exist, and the flows speak only these six.                                                                                                   |
| coverage             | Every decision of this file and every rule has a spec that FAILS when the behaviour is broken; an audit per package maps decision → spec, an adversarial pass tries to break a "covered" row, makers fill the gaps. Locked by the catalogue meta-tests, the capability matrix and the coverage ratchet. |

### What the package-test branch decided (iteration 4)

- **32** — a file is 16.x-shaped when a 16 folder it stands on is still
  there: one beside it (C13's sibling probe), or the 16 pool when the file
  names it by `$FIXTURES/`. C13's pool clause flags every spec under a 16
  pool; the gate narrows it to the files that name the pool, or a 16 pool
  would re-open the per-tree gate. Which directories held a 16 folder is
  read before the renames erase it. Left for the reader: a 16 file with no
  16 folder beside it and no `$FIXTURES/`, and a path spelled in full
  against a 16 folder elsewhere in the tree.
- **33** — the rename keeps its covered-line move (`.text` → `.raw`): an
  ungated mover left that line on `.text` too. A renamed directive no longer
  matches, so a second run is a no-op. `Migration` gains `directives` (the
  files whose directives alone moved), printed on their own line. Found by
  running `make fix` here: the ungated rename rewrote the mover's own unit
  test, whose Given spells directives in string literals — a directive is
  now read in a comment only (`//` or `/*` outside every string the line
  opens).
- **34** — the NEAREST of a `package.json` and a `.git` (a directory or a
  worktree's file) is the project root, so a manifest-less clone inside a
  directory that has one reads below its own `.git`. `projectSegments`,
  `specsAnchor`'s ceiling, the retired `tests/` clause, I1's spine base and
  the CLI's "is this a specs tree" read it. A path neither holds — a rule
  case's `/repo/…`, a string with nothing on disk — is still read whole.
- **37** — `fix` depends on `build` (the checker it runs is this package's
  own `dist/checker.js`), runs `npx typescript fix` then the checker's
  `--fix`, and stops. `docs` and `coverage` left the Makefile (`npm run
docs`/`coverage` stay), and `lint:fix` left package.json. A meta-test,
  `lint/makefile.test.ts`, holds the six and `fix`'s recipe.

### Raised by the package-test branch, iteration 4

38. The toolchain's Suppressions pass reads a directive spelled inside a
    string literal: `make fix` failed on the mover's unit test (a
    `-line` directive in a string, no `-- reason`). Align it with the
    mover's comment-only reading?
39. A path no package and no repository holds is still read whole — the
    rule tests' virtual `/repo/…` paths live there. Move the rule tests onto
    a real checkout (as `checkoutUnder` does) and refuse to judge such a
    path, or accept the escape?
40. This repository's `fix` builds first because its checker is its own
    `dist/`. A consumer's `fix` runs the installed checker and needs no
    build: does the contract say anything about a target's prerequisites,
    or only that the six exist?

## Iteration 4 — the calls on questions 39 and 40 (2026-09-23)

| #   | Decision                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 39  | The whole-path fallback stays: a path no package and no repository holds is read whole, which is where the rule tests' made-up `/repo/…` paths live.          |
| 40  | The Makefile contract names the six targets and only them; what a target needs before it runs — `fix` building first here — is the repository's own to state. |

### What the package-test branch decided (the spec-coverage pass)

The owner's criterion — every decision and every rule has a spec that
FAILS when the behaviour is broken — was applied to the audit of this
branch, each new or strengthened spec shown red on a deliberately broken
implementation (the commits say what was broken).

- **Position.** Every static rule is specified by documents
  (`specs/lint/<rule-id>/<case>.spec.yaml`) whose golden names the line and
  column it fires on; two meta-tests hold every plugin rule to documents
  and to one position line, and every checker pass to an E2E spec (the
  member pass's E3, E5b and F8 gained documents). `lintReport` now orders
  the diagnostics by file, line and column: oxlint prints files in the
  order its threads finish, and two converted goldens flaked on it.
- **Types.** A stream refuses a value `toMatch` (the refusal sits on
  `this`, since the augmented member must stay assignable to vitest's),
  and every retired verb name is a type row. Every row ends on the words of
  the error it is written for, and `lint/type-channel.test.ts` compiles the
  file with its markers removed and fails a row refused for another reason.
- **`--summary`.** A green ratchet run prints exactly
  `test.baseline.json: <n> held across <k> rules` with it — the line
  `typescript check` can show beside its own ratchet's (question 35). The
  whole-project line names each pass once.
- **The matrix.** No cell is excused as owed any more: the last owed
  surface of website, component, jobs, api, integration and cli has specs,
  a meta-test fails an exemption on a filled cell, and `toMatchRows()`
  left the component column (a page holds no table). A cell counts a call
  only where code writes it, never inside a string, and comments are
  stripped by a scan that a glob in a string no longer fools.
- **Found and fixed on the way.** Redis never isolated the app: a worker's
  index is now in the connection string it is handed (G2). The website
  tree and title now read through the runner's `transform`, like every
  other accessor (Q21). D8w reads `.not.toContain` on `.raw`. K4 states and
  proves what it does — every reach, by one rule at least; K8 is a
  catalogue row; K2 proves it catches a false citation.

### Raised by the package-test branch, the spec-coverage pass

41. Variant A sends a body from the disk —
    `.post('/orders', file('./requests/order.json'))` — and C24 holds a
    body to `requests/`; C2 still refuses any file in `requests/` that is
    not a `.http`, and its fix sends it to `fixtures/`, which C24 then
    refuses. No body file can satisfy both. The body specs
    (the api facet's `sending/` folder, since filed by subject) carry a C2 suppression until it is decided: does
    `requests/` hold the body files a verb names (C2 relaxed to what a
    chain sends), or does a body file live elsewhere (C24's row moved)?
42. Tracked files (iteration 3, owner): the conventions checker still
    walks the disk — about twenty-five `readdirSync` walks across
    `lint/checker-*.ts` — so an untracked file counts on a workstation and
    not on a clean checkout. Implement the `git ls-files` reading in the
    checker (a walk outside a work tree — every E2E fixture — keeping the
    disk), or is the decision the toolchain's sweep alone?
43. The component facet's role locator does not find an HTML `<search>`
    element that the page's own tree calls `search` (the website facet was
    shown only on `role="search"`). Map the element in the adapter, or
    document `role="search"` as the form to write?
44. `result.errors` on a website visit holds the console's `error`
    messages and not an uncaught exception of the page. Is an uncaught
    exception an error the result should carry?

## Iteration 5 — the calls on questions 42 to 44 (2026-09-23)

| #   | Decision                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 42  | The conventions checker reads tracked files only, like every tree gate of the toolchain; a directory git places in no work tree keeps the disk walk. |
| 43  | The role locator finds an HTML `<search>` element as the `search` landmark on every surface.                                                         |
| 44  | An uncaught page exception lands in `result.errors`, on the website and on the component facet.                                                      |

### What the package-test branch decided (iteration 5)

- **Tracked files.** Every walk of `lint/checker*.ts` lists through
  lint/tracked.ts (now `src/seams/git/tree.ts`): inside a work tree, one `git ls-files --cached` from
  its top level, kept for the run, answers each directory with its tracked
  children still on disk. A directory is placed in a work tree by
  `git rev-parse --show-cdup` succeeding there — not by a `.git` probe,
  which the rule tests fake with an empty folder — and one where it fails
  is walked on disk: every copied E2E fixture and scratch tree. A `git mv`
  of the fixers drops the listing. lint/tracked.test.ts (since split between `src/seams/git/tree.test.ts` and `lint/checker.test.ts`) proves an
  untracked C12 document is never reported and a tracked one is.
- **`<search>`.** Playwright 1.63 maps the element itself, so the website
  needed only its spec. Browser Mode's role engine gives the element no
  role, so the component adapter locates `search()` as the role or
  `css=search:not([role])`, registered through `locators.extend`; a name
  keeps the elements whose label is that name.
- **Uncaught exceptions.** The website adapter records `pageerror` as an
  `error` line spelled `Uncaught <name>: <message>`, the browser's own
  `ErrorEvent` spelling, which the component facet already carried
  through its `error` listener — now named by a spec.

### Raised by the package-test branch, iteration 5

45. A component's uncaught exception reaches `result.errors` TWICE —
    `Error: Uncaught Error: …` through `console.error`, then
    `Uncaught Error: …` from the facet's listener — while the website
    carries it once. HYPOTHESIS (2026-09-23): vitest's browser client logs
    a page error through `console.error`, instead of failing the run as
    unhandled, when the page holds its own `error` listener; read
    `@vitest/browser`'s window-error catcher to settle it. Carry one line
    per exception on the component (and which one), or accept the pair?
46. C14's fixer moves a tracked pool fixture with a plain rename, so after
    `--fix` the moved file is untracked and invisible to the checks that
    run next, until the author stages it. Move it through `git mv`, as
    C12 and C13 already do?
47. The listing covers the checker's WALKS. The oxlint plugin's
    disk-anchored rules (`lint/fs-cache.ts`: A9w, C2, C6, C7, I2) and the
    checker's single-path probes (C8's target exists) still read the disk,
    so an untracked sibling still answers them. Hold them to the listing
    too, or is a probe of a path the test names out of the law's reach?
48. The W3 refusal's evidence names a candidate's landmark from
    `nav, header, footer, main, aside, section, form, [role]` in both
    adapters, so a candidate inside a `<search>` element is reported with
    no landmark and its scope is never suggested. Add `search` there?

## Iteration 6 — the calls on questions 45 to 48 (2026-09-23)

| #   | Decision                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45  | A component's uncaught exception appears ONCE in `result.errors`, worded like the website's (`Uncaught <name>: <message>`), deduped at the facet. |
| 46  | C14's fixer moves with `git mv` in a git checkout, and with a plain rename otherwise.                                                             |
| 47  | The plugin's disk-reading rules and the checker's C8 probe read the tracked listing; outside git, the disk.                                       |
| 48  | W3's ambiguity evidence names the `search` landmark, and the selector is checked against every landmark of the vocabulary.                        |

### What the package-test branch decided (iteration 6)

- **One uncaught line.** The double source is vitest's own
  `@vitest/browser/dist/client/error-catcher.js`: it wraps
  `window.addEventListener`, and while the page holds an `error` listener
  of its own it stops reporting the event as unhandled and logs it as
  `console.error(new Error(e.message))` instead — the HYPOTHESIS of 45,
  now read. Its listener runs first, so the relay is the entry the
  facet's recorder pushed just before its own listener fires; the listener
  drops that entry when it logged one `Error` carrying the event's
  message. Both `console` and `errors` carry one line.
- **`moveKeepingHistory`.** The history-keeping move lives in
  lint/tracked.ts (now `src/seams/git/tree.ts`), beside the listing it invalidates, and C12, C13 and
  C14 all call it; the C14 line no longer asks the author to stage.
- **The listing answers single paths.** `trackedKind(path)` in
  lint/tracked.ts (now `src/seams/git/tree.ts`) gives the disk's kind, or nothing when the path is
  off disk or not in its parent's tracked names. `lint/fs-cache.ts`
  answers `listDirectory`, `isFile`, `isDirectory` and `readFileCached`
  through it, so EVERY rule importing the cache follows — C1, C4, C11,
  C13, D9w, E7w, E8, I1 as well as the five the question named — and the
  role and config anchors with them. `.git` is the one path read on disk
  (`isOnDisk`): git never lists it. C6 never read the disk; the old
  header's list was stale. C8 tells an untracked target from a missing
  one in its message.
- **`LANDMARK_SELECTOR`.** One owner in `src/model/elements/ambiguity.ts`,
  derived from a `Record<LandmarkKind, string>`, so a landmark added to
  the union fails the typecheck until it names its element. `search` was
  the only one of the eight missing.

### Raised by the package-test branch, iteration 6

49. The plugin runs in the editor, where the file being written is
    usually untracked. Now that an untracked file satisfies nothing, a
    new module and its new test both unstaged draw I2's "no neighbour",
    and E8 refuses a new `*.specification.ts` door, until `git add`.
    Accept that cost, or exempt the neighbour of the file oxlint is
    visiting (the evidence the author is typing)?
50. A9w passes the tracked `isFile` to `findRoot`, the runtime's own
    walk-up, whose comment says the two MUST be one function. The runtime
    still reads the disk, so an untracked root anchor makes them disagree.
    Keep A9w on the listing, or give it the disk walk the runtime uses?
51. The checker's other single-path probes still read the disk: C9 and
    C14's `isDir` of a pool entry (`checker-crossfile.ts`), C13's golden
    and specification `existsSync` (`checker-migration.ts`), the member
    pass's `package.json` and workspace anchors (`checker-member.ts`),
    `checker-placement.ts`'s package stop and `checker-spec.ts`'s
    `statSync`. Hold them to the listing too, or were only C8's probes
    meant?
52. `CONTEXT_LANDMARKS` maps no `section` or `region`, so a candidate in
    a named `<section>` shows `in <section>` and `region()` is never
    offered as a rewrite. Offer `region()` — named, since several regions
    are the norm — or leave the section as evidence only?
53. `make check` failed once on `src/model/chain/process.test.ts` (the
    served environment answered `{"error":"not found"}`) and
    `src/seams/process/serve.adapter.test.ts` (a dying command's port
    answered), both passing alone and on the rerun — another server
    holding the port they picked. A port-picking flake to chase, or known?

## Iteration 6 — the owner's answers and the calls on 41, 49–53 (2026-09-23)

| #                      | Decision                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41                     | Owner: `requests/` holds everything a spec SENDS — a whole request `.http` and a body file (`.json`, `.txt`, …). C2 accepts both; C24 keeps a body in `requests/`.                                                                                                                                                                                    |
| 49 (tree law, revised) | Owner: every tree gate and every rule judges what git does NOT ignore — tracked files plus untracked, non-ignored files (`git ls-files --cached --others --exclude-standard`). Only `.gitignore`d paths are out. A local data folder belongs in `.gitignore`. One law for the CLI, CI, the baseline and the editor; outside a git checkout, the disk. |
| 50                     | The lint's root lookup and the runtime's agree by reading the same thing — the non-ignored tree under the law above.                                                                                                                                                                                                                                  |
| 51                     | Every single-path check (C9/C14 `isDir`, C13 `existsSync`, the member pass's anchors, checker-placement, checker-spec) reads through the same listing.                                                                                                                                                                                                |
| 52                     | `region()`/`section` joins the context landmarks, so an ambiguity error can suggest it.                                                                                                                                                                                                                                                               |
| 53                     | A spec server or process binds port 0 and reads the port it got; no spec picks a port.                                                                                                                                                                                                                                                                |

### What the package-test branch decided (iteration 6, the owner's answers)

- **The tree law (49).** The listing is `src/seams/git/tree.ts` — one
  `git ls-files --cached --others --exclude-standard` per work tree, a
  deleted file the index still holds left out, the disk outside git — and
  its API says what it lists: `treeEntries`, `treeNames`, `treeKind`,
  `forgetTree`. It left `lint/` because the runtime reads it too (50); git
  is its dependency, so it is a seam folder of its own, with no npm
  package. Every move drops it, a plain rename included: an untracked
  file is in the listing now. Every reader follows — the checker walks,
  `lint/fs-cache.ts`, C8 (whose message says `is ignored by git`), the
  moves, and the siblings meta-test (K7), which walked the disk.
- **One root (50).** `discoverRoot` hands `findRoot` the same probe A9w
  does: a `.gitignore`d `package.json` marks no root for either, a new one
  does.
- **Every single path (51).** C9 and C14's `isDir`, C13's golden,
  specification and nested-package probes, the member pass's manifest,
  pnpm workspace and vitest config probes, the placement walk's package
  stop and D5's `fixture:` read all go through `treeKind`. Left on disk on
  purpose: `.git`, the fixers' collision guards before a move, and the
  CLI's checks of paths an operator passes (`--oxlint-report` sits under
  the ignored `.artifacts/`).
- **Requests (41).** C2 is renamed `c2-request-extension`, and the mover
  renames a directive naming its old id. It accepts a `.http` and any body
  file, and refuses a file under `requests/` with no extension — the
  extension is how the builder sends a body (`.json` parsed, anything else
  verbatim), the ground C6 stands on for a golden; a folder there is not
  judged. The `sending/` suppression is gone.
- **`region()` (52).** `ElementMatch.contextName` carries the landmark's
  accessible name (`aria-label`, else what `aria-labelledby` points at),
  read by both adapters; a named `<section>` is offered as
  `within(region("<name>"), …)`, an unnamed one stays evidence.
- **Port 0 (53).** Every server a spec starts binds port 0 and prints
  `listening on port <n>`, read through a `ready` banner; meta-test K9
  (`lint/port-readers.ts`) fails a spec file or a module test reading
  `process.env.PORT`/`$PORT`, a folder holding a `Dockerfile` excepted.
  The stop spec asks whether the server's pid is gone, not whether its
  port answers.

### Raised by the package-test branch, iteration 6 (the owner's answers)

54. C2's residual refusal — a file under `requests/` with no extension —
    is the maker's call, not the owner's (41 said only "accepts both").
    Keep it, refuse something else (a golden-shaped `.http` whose first
    line is a status line is D4b's already), or retire C2?
55. The listing is kept per process until a move. In the editor the
    plugin may live across lint runs, so a file created after the first
    listing would be invisible to it until the host restarts —
    HYPOTHESIS (2026-09-23): oxlint's language server keeps the JS plugin
    module loaded between runs; running it on a file, creating a sibling,
    and linting again settles it. Key the listing on something that moves
    (the index's mtime), or accept the restart?
56. With every spec server on a banner, the framework's PORT form (pick,
    release, inject, poll `ready` as a path) — the one chapter 08 shows
    first and the appium server uses — is proven by no spec of this
    package, and its window is inherent. Prove it on one spec and accept
    the rare flake, prove it without binding, or make the banner the form
    the chapter shows first?
57. The root walk is stated twice, in chapter 10 (`root`) and chapter 17
    (services); the tree clause landed in 17 only. Which chapter owns it?

## Iteration 7 — one config, one baseline (2026-09-23)

| Decision     | Owner (2026-09-23)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One config   | Family settings live in `jterrazz.config.ts` at the root, not package.json. `@jterrazz/typescript` owns it and exports `defineConfig` and the `JterrazzConfig` interface from `@jterrazz/typescript/config`; `@jterrazz/test` adds its `test` section by declaration merging. No `jterrazz.*` key in package.json any more. A workspace member may carry its own file beside its package.json.                                                |
| One baseline | The ratchet files merge into ONE generated `jterrazz.baseline.json`, a section per package: `{ "typescript": {...}, "test": {...} }`. The checker reads, judges and writes ONLY `test` and keeps `typescript` byte for byte; `--summary` prints `jterrazz.baseline.json › test: <n> held across <k> rules`. No legacy reading of `test.baseline.json`; only `@jterrazz/typescript` flags a leftover per-package file (its `baseline-legacy`). |

### What the package-test branch decided (iteration 7)

- **The `test` section of the ratchet.** `lint/ratchet.ts` reads and
  judges `test` alone and splices it into the file's text on a recording
  — replacing its value where it stood, or closing the object with it —
  so every other section keeps its bytes; it refuses to record over a
  file that holds no JSON object rather than lose them. Every line a
  reader sees names `jterrazz.baseline.json › test`. The checker raised
  its own refusal of a leftover `test.baseline.json` first; it was
  withdrawn once the toolchain's `baseline-legacy` landed, and the old
  file is now only proven never read.
- **This repository's files.** `test.baseline.json` and
  `typescript.baseline.json` are gone; both sections were recorded by
  their owners' `baseline` commands, the `typescript` one by the
  toolchain installed from package-typescript `abd364e`.
- **`TestSettings`.** `src/settings.ts` merges `test?: TestSettings`
  into `JterrazzConfig` and `src/index.ts` exports the type, so the merge
  ships in `dist/index.d.ts`. The section holds nothing yet, so it is
  `Record<string, never>`: `{}` compiles, an unread key does not.
  `src/settings.test-d.ts` is the proof. The merge is an `interface`
  under a reasoned `consistent-type-definitions` suppression — kept in a
  `.ts`, since the build carries a `.ts` module's merge into the
  published types — and the file imports the module it augments with an
  empty type import (two more reasoned suppressions): the augmentation
  alone failed with TS2664 in the docs-typecheck scratch project, which
  imports nothing else of `@jterrazz/typescript`.
- **`jterrazz.config.ts`** holds the `schema/` root under
  `typescript.roots`; package.json lost its `jterrazz` key.

### Raised by the package-test branch, iteration 7

58. `dist/index.d.ts` now names `@jterrazz/typescript/config`, which is
    only a devDependency. A consumer that installs `@jterrazz/test`
    without the toolchain and typechecks without `skipLibCheck` gets
    TS2664 from the merge. Declare `@jterrazz/typescript` an optional
    peer, or accept it for an estate where every repository has both?
59. Nothing reads the `test` section yet, and a member's own
    `jterrazz.config.ts` is read per unit by the toolchain. When the
    first setting moves in, does the checker load the file the way the
    toolchain does (Node's type stripping, per unit), or through an
    export of `@jterrazz/typescript/config` so the two loaders are one?

## Iteration 8 — the calls on questions 55 to 58 (2026-09-23)

| #   | Decision                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 55  | The tree listing is never cached across runs of the editor's host: one lint run at most. Invalidate on the run boundary the plugin has; with none, key the listing on the mtime of git's index plus the listed directory's mtime.                               |
| 56  | A spec covers the framework's PORT form.                                                                                                                                                                                                                        |
| 57  | The tree clause of the root walk has one owner, chapter 17; chapter 10 links to it.                                                                                                                                                                             |
| 58  | `@jterrazz/typescript` is a peer of `@jterrazz/test` — every consumer has the toolchain, and the published types name `@jterrazz/typescript/config`. The range is the toolchain's upcoming major, `^11.0.0`; the `file:` devDependency stays for the prototype. |

### What the package-test branch decided (iteration 8)

- **A dependency reads the disk (a regression, before 55).** F1 told
  package-typescript that `/vitest` and `/oxlint` were internal
  subpaths: the exemption reads this package's own manifest, which went
  through the tree listing, and in an install that manifest sits under a
  `node_modules/` every consumer's `.gitignore` names. The tracked
  listing before it hid the same file; it surfaced once package-typescript
  installed this package as a copy (`install-links=true`). The law: the
  listing judges the project's OWN files. `package-exports.ts` reads its
  manifest from the disk, and the seam answers from the disk for any
  path inside a `node_modules/`. The audit of every reader moved to the
  listing found no other dependency read through it.
- **One run (55).** oxlint gives a plugin no run boundary (`before` and
  `after` are per file), so the listing takes the fallback: a work tree
  records its index file and when its listing began, and is listed again
  when the index, or the directory a question reads, changed after that.
  `lint/fs-cache.ts` keeps no listing of its own any more, and a file's
  text only while its mtime holds.
- **The PORT form (56),** proven without a child binding what it is
  handed, so 53 holds: a child prints the port it got and the adapter's
  timeout names the URL it polled, on that port at the ready path; and
  a port the test holds, stated as `port`, is handed as `PORT` and
  polled at the path. K9 names that one module test out of its reach.
- **One owner (57).** Chapter 10 keeps what `root` overrides and links
  to 17 § Root auto-discovery; 17 names `a9w-redundant-root` where both
  said "future lint warning".
- **The peer (58)** is required, not optional. A spec holds it: every
  package a published declaration augments is a dependency or a
  required peer. With the toolchain still at 10.3.2, `npm install`
  exited 0 in both repositories and warned of nothing (why npm lets
  package-typescript's root stand for a `^11` peer is a HYPOTHESIS: the
  peer names the root project itself).

### Raised by the package-test branch, iteration 8

60. An in-place edit of a `.gitignore` moves neither the index nor the
    directory a question reads, so the editor sees a new ignore line only
    at the next index write or directory change (an editor's atomic save
    does move the directory). Add every `.gitignore`'s mtime to the key,
    or accept it?
61. When `@jterrazz/typescript` 11 ships, `^11.0.0` is the peer this
    package's release must be cut against; until then an install from the
    registry cannot satisfy it. Does 17 wait for the toolchain's major,
    or ship with `^10.3.0 || ^11.0.0`?

## Iteration 8 — the calls on 60 and 61 (2026-09-23)

| #   | Decision                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 60  | The listing's cache key also holds the mtime of the root `.gitignore` and of `.git/info/exclude`; a nested `.gitignore` edited in place is seen on the next index or directory change (accepted). |
| 61  | Release order: `@jterrazz/typescript` 11.0 ships first, then `@jterrazz/test` 17.0 with the peer `^11.0.0` only — no `^10 \|\| ^11` range (no legacy).                                            |

## Iteration 9 — three defects from the signews-api migration (2026-09-23)

### What the package-test branch decided (iteration 9)

- **`make fix` runs every fixer.** A recipe line that fails stops make,
  so on a 16.x repository `typescript fix` (no baseline) kept the
  mover from running. `fix` runs both fixers in one shell and exits on
  their combined verdict; `lint/makefile.test.ts` runs it over stubbed
  fixers. The contract and the recipe consumers copy are
  package-typescript's chapter 06, "The six gestures", proven there by
  its repository suite running that recipe; `typescript fix` rewrites
  before it reports a missing baseline, pinned by a `fix` document.
- **One held line (28, 35).** A green ratchet run — check, the root
  member, `--fix` — prints exactly `jterrazz.baseline.json › test: <n>
held across <k> rules`. The path and the pass list moved to
  `--verbose`, which replaces `--summary`.
- **D14 on every subject.** A value `toMatch` on a response, json, tree,
  table or container does not compile (`SubjectIsNoValue`), and past the
  compiler the node build refuses it naming what the subject takes.

### Raised by the package-test branch, iteration 9

62. A green run of a project with NO `test` section still prints
    `conventions checker: all passes clean <path> (<passes>)`, and a
    deferred run names the judging file by its absolute path. Does the
    one-line law reach them (and with which line), or only the runs that
    hold a count?
63. A stream handed a value `toMatch` past the compiler still gets
    vitest's own message at run time (the D14 test pins it). Give it the
    refusal the other accessors now get?
64. `typescript check` still passes `--summary`, which a 17 checker
    ignores; it stays for the 16.x releases that print the long line
    without it. Drop it when 16.x leaves the floor?

## Iteration 9 — the calls on 62–64 (2026-09-23), to implement with the owner's review round

| #   | Decision                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 62  | A green run with no `test` section prints one line too: `jterrazz.baseline.json › test: nothing held`; a deferring run names the root's file relative to the project, never absolutely. |
| 63  | A stream given a value `toMatch` at run time gets the framework's message naming `.text` (the D14 test that pins vitest's message changes with it).                                     |
| 64  | No legacy: `check.sh` stops passing `--summary`, and `CHECKER_FLOOR` becomes 17.0.0 in the release.                                                                                     |

## Iteration 10 — documents for the api and jobs facets (owner, 2026-09-23)

- **A golden of the whole result is the default** (approval testing): `toMatch(file('./expected/x.http'))` or a document's `response:`. A precise assertion stays for the case where one property IS the subject; D12w keeps warning on multi-field probes.
- **An api or jobs case is a `.spec.yaml` document**, the same grammar as the cli's: `seed`, `request`, `response` (file paths or inline, tokens allowed), `intercept`, `clock`; run by `run(file('./case.spec.yaml'))` / `literate()`, validated by the published JSON schema.
- **One file = one test.** No `cases:` list: a document is one test.
- **Composable by lists, visibly**: every given key (`seed`, `fixture`, `intercept`, headers) takes one path or a list applied in order — the pool's base and the leaf's delta both readable. No `extends:` (a hidden given).
- **Steps with named captures** inside one test for a journey: `steps: [{ request, capture: { orderId: $.id }, response }, { request: GET /orders/{{orderId}}, … }]`.
- **Route coverage**: a check lists the routes the app declares and names every route no document or spec reaches — the functional coverage the owner asked for, beside line coverage.
- TypeScript specs stay for logic (loops, computed values, cross-call reasoning).

### What the package-test branch decided (iteration 10, and 62–63)

- **62** — a green run of a project keeping no `test` section prints exactly
  `jterrazz.baseline.json › test: nothing held` (`--verbose` adds where it
  stood and what ran, as on the held line); a run deferring to the ratchet
  names `jterrazz.baseline.json › test`, relative to the project.
- **63** — `streamValueRefusal` lives beside the golden route both builds
  lay: a value `toMatch` on a stream, past the compiler, is refused naming
  `expect(<stream>.text).toMatch(…)` in node and in a page.
- **The kinds.** `kind:` is stated — `api`, `jobs`, or `cli` by default — and
  names the export a document runs through, in the plugin door and the
  bridge (`api.run(file(…))`, `jobs.run(file(…))`). Each kind reads a closed
  key set; a key of another kind is refused naming it. The folder does not
  imply the kind: that would be a hidden convention.
- **`fixture:` is refused on api and jobs.** The plan listed it among the
  keys, but it lays files into a working directory, and neither chain has
  one: a document key means what a chain gesture means, and no api or jobs
  gesture means this. The refusal says so (question 66).
- **The keys.** `seed:` a path or `{ file, database }`, or a list, applied in
  order (A7 as the chain has it); `intercept:` paths to modules under
  `contracts/` whose default export is a contract, a list or a composite;
  `clock:` an ISO instant; `headers:` a mapping (top-level for every request,
  per step over it); `request:` a `./requests/*.http` path or an inline
  `METHOD /path` with `body:` a value or a path under `requests/`;
  `response:` a `./expected/*.http` path or inline `{ status, headers,
body }`, token-aware, an absent part not asserted; `tables:` table →
  `{ database?, columns, rows }`, `rows: []` for empty; jobs `trigger:`,
  `error:` (absent asserts success) and `tables:`. `cases:` and `extends:` do
  not exist: they are unknown keys, refused as any other.
- **Steps.** `steps:` is a journey in one test, one `executeSetup`, one
  `CaptureScope` for the whole of it (a `#ref` bound by one response holds
  in the next). `capture: { name: $.path }` reads the RESPONSE BODY with a
  JSONPath subset (`.key`, `[n]`, `['key']`); a later step sends `{{name}}`
  in its request line, headers or body — a whole-string reference sends the
  value typed. A name sent before a capture, or a token in an input, is a
  grammar refusal on the line that sends it.
- **The guards.** Role is the grammar's (the `d4b-spec-shape` finding, and
  the runner's refusal, name C24); C15, C8, C9 and C14 read every path key
  through `documentPaths`, where they read `fixture:` alone; at run time a
  missing path is refused with what it resolved to.
- **The runner is the chain's.** A document's `seed:`, `intercept:` and
  `clock:` are `.seed()`, `.intercept()` and `.clock()` on the chain that
  runs it, so a setup chained before `.run()` lays underneath. The facet
  factories now hand back a facet VIEW after each setup (memoised per
  chain), so `api.seed(…).run(…)` is the api's run, not the cli's.
- **Update.** `TEST_UPDATE=1` rewrites an inline response in the YAML
  (`updateSpecResponses`) and a file-form one through its golden; tables and
  a job's `error:` are stated by hand.
- **The doors.** `literate()` binds by kind; `cli()`, `api()` and `jobs()`
  share `documentProject`, collecting `specs/<facet>/**/*.spec.yaml` bound to
  `specs/<facet>/<facet>.specification.ts` unless `literate` says otherwise.
- **Route coverage is a checker pass, B12, over a DECLARED source**:
  `test: { routes: './openapi.yaml' }` in `jterrazz.config.ts` (OpenAPI,
  JSON or YAML). Not `app.routes`: the pass runs in the lint, before any
  test, and Hono's table exists only once the factory is handed started
  services; a table from a previous run would judge a stale tree. Reach is
  static (a document's request lines and the `.http` files it sends, a
  spec's literal `.get/.post/.put/.delete/.request(file())`), a parameter
  taking one segment and a capture or a template hole filling one. The
  config is loaded as the toolchain loads its own section — question 59
  answered for the checker. Findings are `jterrazz-check(b12)`, ratcheted.
  On this repository it found GET /users/{id}, which no case reached; a
  document now does.
- **Migration.** The pure-data api and jobs tests left TypeScript for
  documents (sending, seeding, the api and jobs clocks, the job outcomes);
  what stays is `.headers()` layering, refusals, the one-chain clock
  release, the reset, the static jobs array, the strict network. The
  capability matrix counts a document by the key it writes, or the jobs
  `.clock()` cell would have fallen to 0 with the capability as exercised as
  before. `literate` became a shared domain.
- **Found and fixed on the way.** The YAML rewrite read a document's step
  from its indented keys only: an api document whose one list holds flow
  entries (`- { file: …, database: db }`) was rewritten at two spaces by
  `--fix`, and the format check refused it. A flow entry states the step
  too.
- **One owner.** Chapter 20 — Spec documents owns the format for the three
  kinds; 12 keeps the words `env:`/`serve:` are registered by, 10 and 11
  show their document form and link.

### Raised by the package-test branch, iteration 10

65. A shared seed cannot live in the pool: C24 judges the FIRST ground
    folder a path passes through, so `../../fixtures/seeds/base.sql` is a
    `fixtures/` path for `seed(file())` and `seed:` alike. The vision's "the
    pool's base and the leaf's delta" composes `fixture:` only. Judge the
    folder below the pool, or keep the pool file-state only?
66. `fixture:` on api and jobs is refused (no working directory). Confirm,
    or give it a meaning — files an in-process app reads from its root?
67. B12's source is declared. Making the declared file provably equal to the
    served app's `app.routes` needs the runtime to read `jterrazz.config.ts`
    (question 59 is answered for the checker only). Should the api
    constructor compare the two at run time, and fail a stale source?
68. The runner `import()`s an `intercept:` module from the framework's own
    code. Here the framework is vite-transformed, so a contract importing
    `./http/x.js` resolves to `.ts`; in a consumer `@jterrazz/test` is
    externalised and Node loads the module itself. HYPOTHESIS (2026-09-23):
    such a module fails to load in a consumer — settled by running a
    document with `intercept:` in signews-api. If so: have the plugin's
    generated module import the contracts (vite resolves them) and hand them
    to `run`, or have the preset inline the package?
69. The schema's per-kind `if`/`then` is proven equal to the parser's key
    sets, but no document is validated against it: there is no JSON Schema
    validator in the dev dependencies. Add one, and validate every document
    of the tree?
70. A capture reads the response body only: a `Location` header cannot be
    captured. Root the JSONPath at `{ status, headers, body }`?
71. Captures serve inputs; cross-step equality of outputs is the `#ref`
    token. Two mechanisms for one idea, or the right split (a request sends
    values, a golden matches shapes)?
72. Update mode writes the WHOLE inline response: a document stating only
    `status:` gets its body written on the next `TEST_UPDATE=1`. Keep
    (approval testing), or rewrite only the parts stated?
73. D12w, D15w and the other static probes read TypeScript only: an inline
    response asserting one field of a large body is not warned. Give the
    document channel the same warnings?
74. d5w's carve-out compares the golden's literal with the document's
    `clock:` verbatim, so `clock: 2026-03-04T09:30:00Z` does not fix
    `2026-03-04T09:30:00.000Z`; the documents here write the clock in the
    app's own spelling. Compare instants, not strings?

## Iteration 11 — the calls on 65 and 69 (orchestrator, 2026-09-23)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 65  | The shared pool is not one `fixtures/` folder but the SPECS ROOT's own ground — `<specs>/fixtures/`, `<specs>/seeds/`, `<specs>/requests/`, `<specs>/expected/`, the four roles one level up. A path leaves its leaf only into one of those (C15); C24 judges the role folder the path lands in, so a shared seed is `<specs>/seeds/`; C14's move applies to all four; the mover and the chapters follow. |
| 69  | ajv joins the dev dependencies, and a meta-test validates every `.spec.yaml` of this repository against the published schema — the deliberately invalid fixtures excluded — with a negative case per document kind.                                                                                                                                                                                       |

### What the package-test branch did (iteration 11)

- **65.** C24 kept its reading, the first ground folder, which now lands
  `../../seeds/x.sql` in `<specs>/seeds/`; its refusal — the oxlint rule and
  the document grammar alike — names where the file goes, so
  `../../fixtures/seeds/x.sql` is refused naming `<specs>/seeds/`. C15 admits
  the four root folders. C14 reads the four pools, a file entry as a
  directory, and moves a root seed one leaf reaches for to `<leaf>/seeds/`;
  it now counts every literal `file()`/`directory()` reference, not only
  `.fixture(…)`, or a root seed reached by a document in one leaf and a
  `.seed(file())` in another would have been moved. C9's dead-entry scan
  reads the four. This repository keeps one shared seed,
  `<specs>/seeds/two-users.sql`: an api document lays it under its leaf's
  delta, a jobs document seeds it.
- **69.** `lint/schema-documents.test.ts` walks the 237 documents git keeps.
  "Deliberately invalid" is the parser's verdict, not a hand list: every
  document the parser reads, the schema validates; every one it refuses sits
  under `fixtures/`, and the schema refuses it too — but for a name sent
  before the step that captures it, an order across steps no keyword
  compares, listed with that reason. The validator lives in the test: the
  `lint/` layer ships and imports no package.
- **Found and fixed on the way.** The schema's path patterns read "passes
  through `seeds/`", so `../../fixtures/seeds/x.sql` validated as a seed the
  parser refuses — the exact path 65 turns on. They now read the first
  ground folder, as C24 does.

### Raised by the package-test branch, iteration 11

75. The schema is laxer than the parser on one more shape no fixture holds:
    an api step with neither `response:` nor `tables:` validates, and the
    parser refuses it ("a step asserts what came back"). The meta-test only
    sees the documents that exist. State it in the schema (`anyOf` on the
    step and the one-step document), or keep the schema a key-set contract?
76. `fixture:` is judged by "names a `fixtures/` segment anywhere"
    (`spec-document.ts`, `readFixtures`), not by the first ground folder the
    other path keys and C24 read: `./seeds/fixtures/x/` passes. Align it?
77. Nothing pushes ground UP: this tree still keeps six identical
    `two-users.sql` and five identical `one-user.sql` across leaves. C14 only
    demotes a lonely pool entry. A warning for byte-identical ground in two
    leaves, the D25 of seeds, or leave promotion to review?
78. C9's pool scan counts an entry referenced when any literal of the tree
    CONTAINS its name, so a leaf's `./seeds/two-users.sql` vouches for
    `<specs>/seeds/two-users.sql`. Seeds share names far more than fixture
    trees did. Resolve each literal from its file, as C14 does?
79. The pool law is stated twice: `docs/12-cli.md` § Where a fixture lives
    and `docs/18-conventions.md` § The naming recap. With seeds, requests and
    goldens in it, the law is no longer the cli's. One owner, 18, and 12
    links?
80. Environment: `npm install` / `npm ci` on npm 12 here runs with
    `install-links=true` and blocked install scripts — `file:../package-typescript`
    is copied, not linked, and better-sqlite3 has no binding until
    `npx prebuild-install`. A `make install` on a fresh clone fails the sqlite
    suites the same way. HYPOTHESIS (2026-09-23): CI is unaffected, settled
    by its install log.

## Iteration 12 — the calls on 75 to 79 (orchestrator, 2026-09-23)

| #   | Decision                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 75  | The schema refuses what the parser refuses: an api step with neither `response:` nor `tables:`, and the same principle for every kind — the schema's required-ness is derived from the parser's rules, and the Q69 meta-test proves the two agree both ways.           |
| 76  | `fixture:` is judged by the FIRST ground folder, like every other path key.                                                                                                                                                                                            |
| 77  | Identical copies of a ground file in two leaves or more are a finding — a warning, ratchet-recordable — whose `--fix` moves one copy to the matching specs-root folder and rewrites every reference; the six `two-users.sql` and five `one-user.sql` copies here move. |
| 78  | C9 matches references by RESOLVED path, never by entry name.                                                                                                                                                                                                           |
| 79  | The pool rule has one owner, `docs/18-conventions.md`; `docs/12-cli.md` links to it.                                                                                                                                                                                   |

### What the package-test branch did (iteration 12)

- **75.** The presence laws are one table, `PRESENCE` in
  `spec-document.ts` — per shape (a document of any kind, each kind, a
  step, a run, a table, a seed entry, an inline response, a `files:`
  assertion), `each` / `some` / `apart`. The parser refuses through it with
  the sentences it already gave; the schema states each law as `required`,
  an `anyOf` or a `not`, and the hand-written ones are gone. Stating the
  table surfaced three more gaps than the one asked: a step's key beside
  `steps:`, `waitFor:` beside `stdin:`, and a `body:` beside a request file
  (not a presence law — a value condition, held by `stepLaws()`). A one-step
  api document carries its step's laws through `dependentSchemas` on
  `request`. The meta-test breaks every law of the table from well-formed
  instances of its shape, for both readers.
- **76.** `fixture:` goes through the same `readPath` as the other keys;
  its schema pattern is `pathIn(fixtures)`, the one role a path may end on
  (`./fixtures/` spreads the folder whole).
- **77.** `c27w-duplicate-ground` (C27): a copy is a leaf ground entry — a
  file by its bytes, a tree file by file — another leaf holds under the
  same role AND name; one warning per copy. `--fix` runs before C14's,
  rewrites every path that resolved to a copy, `git mv`s the first to
  `<specs>/<role>/<name>`, deletes the others and removes an emptied leaf
  ground folder; a specs root holding the name with other bytes moves
  nothing. Run here, it moved four entries, not two: `two-events.sql` and
  `one-event.sql` were copied across two api leaves as well.
- **78.** A reference is an absolute path: a document's keys and a
  `file()`/`directory()` argument from the file; each word of the other
  literals from the file AND the project root — the website services run
  `node <specs>/fixtures/api-app/server.mjs` from the root, the one live
  reference no file-relative reading reaches; a template table from the
  folders before its hole. The `file()` arguments get their own pattern:
  the literal scan desyncs after a template with a hole, and four live
  goldens read as dead until it did.
- **79.** 12 keeps one paragraph and the link; the "why" 12 alone said —
  an entry of the specs root must earn its caution, write ground local
  first — moved into 18's recap, now true both ways (C27 up, C14 down).

### Raised by the package-test branch, iteration 12

81. The schema still accepts values the parser refuses, none of which a
    document of this tree holds: a `body:` path outside `requests/` (the
    schema leaves `body` unconstrained), a `clock:` that is no ISO instant,
    a table row whose cell count is not its columns', `waitFor:` on a run
    that is not the last. The first two are patterns; the last two compare
    across values, like the capture order already listed as beyond a
    schema. State the patterns, and list the rest beside the capture?
82. C27 finds copies by name AND bytes. The same bytes under two names —
    `one-user.sql` here, `alice.sql` there — are not found, and a fix could
    not pick the name. Leave them to review, or warn without a fix?
83. C9 resolves a literal's words from the file and from the project root.
    A path a process service runs with its own `cwd:` resolves from neither
    and would read dead. None does here; HYPOTHESIS: none does in the
    workbench, settled by an R8 dry run.
84. C14's `--fix` leaves the pool folder it emptied behind; C27's removes
    the leaf folder it empties. Align C14?
85. `make check` failed four times in eleven runs this iteration, each
    time green on the rerun of the same tree: twice the
    `component (chromium)` project ("needs vitest-browser-react …
    SyntaxError: Illegal return statement" / "Unexpected token '}'", 6–7
    tests), twice the testcontainers log-capture test (30 s timeout). Each
    passed alone. HYPOTHESIS: Vite's dependency optimiser, and Docker,
    starved under the full parallel load.

## Iteration 13 — the calls on 81 to 85, and the signews-api defects (2026-09-23)

| #   | Decision                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 81  | The schema also refuses the VALUES the parser refuses where JSON Schema can express it — the clock format, the body path pattern, a row's width by its `columns` if expressible, the `waitFor` position — and the Q69 meta-test proves it both ways. |
| 82  | C27 finds copies by BYTES whatever the name; its `--fix` moves only when the names agree, and reports differently-named copies without fixing.                                                                                                       |
| 83  | Accepted, no change.                                                                                                                                                                                                                                 |
| 84  | C14's fix removes the folder it empties, like C27's.                                                                                                                                                                                                 |
| 85  | Pre-bundle the browser dependencies (`optimizeDeps.include`) so Vite never re-optimises mid-run; the testcontainers log-capture test gets the timeout its container start needs. Proven by three consecutive green `make check` runs.                |

The owner decided mid-iteration that the `.spec.yaml` documents of the api
and jobs facets are retired — variant B: TypeScript specs with the full
result inline, a new `toMatchInline`, are the form; cli and lint-rule
documents stay. The next round implements B and removes the api/jobs
document grammar, so what served only api/jobs documents was dropped here.

### What the package-test branch did (iteration 13)

- **Defect 2, the document half only.** `runJobs` handed the engine the bare
  `job.execute`, so a job whose `execute` reads `this` failed from a
  document; it now calls through the handle. `.trigger()` never had the bug
  — it calls `job.execute()` — so the fix goes with the jobs grammar next
  round. It was committed before the owner's decision.
- **Defect 4.** Update mode records a golden that is missing or holds only
  whitespace, for the text, JSON and `.http` kinds alike, through one
  reader; a document run that records stands without the `response:` files
  it is about to write. The matcher half serves the inline matcher B brings.
- **Defect 3.** C4 reads no types — it is an oxlint JS rule — so a facade's
  default export is judged by where its builder comes from: a name imported
  from a sibling `*.contracts` module, or a call to one, or a call to a
  builder the file declares with the return type `Contracts`. A builder
  from anywhere else, or declared otherwise, is still refused.
- **82.** Copies are grouped by role and bytes, found in two leaves or more;
  `--fix` moves only a group of one name. This tree holds no copy under two
  names; the checker's kitchen-sink fixture did, and its golden gained the
  two warnings.
- **84.** C14 removes the pool folder its move emptied.
- **81, for the documents that stay.** The one cli value the schema accepted
  and the parser refused is `waitFor:` on a run that is not the last. No
  JSON Schema keyword addresses the last item of a list, so the schema
  states the part it can — at most one run waits (`contains` +
  `maxContains: 1`) — and "one run waits before another" is listed beside
  the capture order as what no keyword compares; a test pins that the
  parser refuses it and the schema cannot.
- **85.** The component project's dependency cache held two entries the
  seam never declared: `vitest-mock-extended`, which the package's browser
  entry imports through its doubles, and the app's `react-router`.
  `component()` now pre-bundles the first, adopts the app pipeline's
  `optimizeDeps` and joins its `include` to the seam's; this repository
  declares `react-router`. The log-capture test and its stop hook get 120 s.
  Three consecutive `make check` runs, the first on an emptied dependency
  cache, exited 0.

### Dropped by the owner's decision (api/jobs documents retired)

- **Defect 1 (Q68 confirmed).** Reproduced before the drop: a consumer
  fixture whose `@jterrazz/test` is the built `dist/`, externalised by
  vitest, failed both doors — the collected document and a `.spec.ts`
  calling `jobs.run(file(…))` — with `Cannot find module …/http/geocoder.js
imported from …/geocoder.contracts.ts`. The fix (loading the module
  through vitest's module graph, `vi.importActual`, instead of a native
  `import()`) and its fixture were not committed.
- **Defect 2's document half** stays committed, as above, and leaves with
  the grammar.
- **Defect 5.** No list of document-referenced files is exposed, so no
  contract is written for `@jterrazz/typescript`'s knip preset: with the
  api/jobs documents gone, no contract facade is named only by a document.
- **81's api/jobs values.** A `body:` path outside `requests/`, the
  `clock:` format and a table row's width by its `columns` are not stated.

### Raised by the package-test branch, iteration 13

86. The `response:` half of defect 4 (a document run that records stands
    without its missing `response:` golden) lives in the api document
    engine and goes with it. `toMatchInline` will need the same answer for
    its own "nothing recorded yet" state: a missing inline value, recorded
    by update mode, rather than refused.
87. HYPOTHESIS (2026-09-23): the component flake of 85 was a mid-run
    re-optimisation. Not reproduced: on an emptied cache the component
    project alone logged "the scanner found every used dependency", and the
    three runs above passed. The read that settles it: a `make check` loop
    with `DEBUG=vite:deps` until a failure, reading whether "new
    dependencies optimized" precedes it.

## Iteration 14 — variant B: TypeScript with the whole result inline (owner, 2026-09-23)

The api/jobs documents turned into indexes of links (a 6-line document pointing at 5 files), the opposite of "everything a test touches is visible on its line". Decided:

- **The form is TypeScript with the whole result inline.** A test's own state is ``.seed(sql`…`)``; shared state alone is `.seed(file('../../seeds/x.sql'))`. ``expect(result.response).toMatch(`HTTP/1.1 200 OK …`)`` compares the whole response to the text written in place, tokens (`{{uuid}}`, `{{iso8601}}`…) allowed; `toMatch(file(...))` holds when the expectation is a shared or 150+-line file; `await expect(result.table('X')).toMatch([[...]])` compares a table (`toMatchRows` retires). ONE verb compares a whole result (response, json, table, tree), and its argument says where the expectation lives: a value written in place (the default) or `file()`/`directory()`. On a plain string (`result.stdout.text`) `toMatch` stays Vitest's own. Contracts are calls (`.intercept(pipeline({ composition: 'perspectives' }))`), never a module written only to be pointed at.
- **The api and jobs `.spec.yaml` documents are retired** (grammar, runner, schema kinds, chapter sections). The cli and lint-rule documents stay: they are self-contained (their output is inline, their fixtures are real trees).
- **Rule — a file exists only if it is shared.** The checker counts the tests that reference each ground file: referenced by ONE test → it must be inline (error), unless it is a directory tree, binary, or longer than **150 lines** (owner's cap); referenced by 2+ tests of one leaf → beside them (`./seeds/`, `./expected/`…); by tests of 2+ leaves → the specs-root pool. `make fix` inlines a single-use file (deleting it) and moves a shared one to its level.
- **Rule — every test compares its whole result.** A test that reads a response, a json or a table holds one whole-result comparison (`toMatch(<value>)` or `toMatch(file())`); a precise assertion (`expect(result.json.value.total).toBe(1)`) is allowed only IN ADDITION to it. Multi-field probes alone are an error.
- **Update mode writes the expectation into the test.** `TEST_UPDATE=1` rewrites a `toMatch(<value>)` argument in place, and a `toMatch(file())` file, like Vitest's `toMatchInlineSnapshot`, keeping tokens where the old expectation had them.
- **Route coverage** is computed at run time from the app's own route table (no OpenAPI required): at the end of the api project, every declared route no test reached is reported (ratchet-recordable in the `test` section); a declared OpenAPI file stays an optional source.

## The exit plan — no legacy, a perfect end state (owner, 2026-09-23)

1. The real refactor starts from `main` in clean commits (never replaying vision/17's history): every tried-then-dropped form is absent — `…File` verbs, api/jobs documents, `--summary`, `toMatchRows`, transitional forms; the prototype plumbing (file: links, install-links .npmrc) never lands; VISION.md becomes chapters + ADRs then is deleted; VISION-signews-api.md deleted. Releases: @jterrazz/typescript 11.0, then @jterrazz/test 17.0.
2. The wave keeps, temporarily, only what moves a repository from 16 to 17: the mover (C13 --fix), the rule-rename maps, the leftover-baseline finding.
3. Right after the wave: @jterrazz/test 17.1 and @jterrazz/typescript 11.1 delete the mover, C13, the rename maps, the leftover-file detection, CHECKER_FLOOR, and every rule whose only job was to recognise the old world. Then a closing audit: no code, chapter, spec, estate wiki page or session memory names a retired form.

## Iteration 15 — the calls on 88–93 (2026-09-23)

| #        | Decision                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 88       | A lint-rule document goldens its report (`stdout`), never `exit:` alone; a rule refuses a document with an exit and no output. |
| 89       | Accepted: a deliberately wrong expectation passed to a helper is marked `{ frozen: true }`.                                    |
| 90       | `dedent` moves to a pure module both `src/` and `lint/` may import, so C28's fixer uses the runtime's own.                     |
| 91       | Accepted.                                                                                                                      |
| 92       | A failure raised in a browser page shows the test's own line first: the router's frames are cut from the stack.                |
| 93       | Watched: the `DEBUG=vite:deps` loop runs during the real refactor.                                                             |
| id clash | The proposed "marker between statements" rule takes a free id; B12 stays retired.                                              |

## Iteration 16 — six defects from the signews-api conversion (2026-09-23)

### What the package-test branch did (iteration 16)

1. **A table compares as a multiset of rows** (`8977180`). Rows pair by
   best match, captures settling across rows; `{ ordered: true }` keeps
   the positional claim, in the first column's order. Update mode keeps
   the stated order. The five skipped signews-api pipeline tests are
   what this unblocks.
2. **An unknown route table fails the run** (`dfda8d4`), naming both ways
   out: hand `server` the Hono app, or declare an OpenAPI document. The
   package's own intercepts app exposes its table now; `GET /cancel` is
   held at `routes/unreached: 1` (its only spec is the skipped msw
   acceptance test).
3. **`app.all()` routes are judged** (`a62b57f`): only an entry whose
   handler takes `next` is a middleware — Hono's own `isMiddleware`.
4. **C4 no longer requires a default export** (`dab6657`): a facade
   exports its builders and sets by name; a default, when present, is
   still judged a composition.
5. **The mover rewrites oxlint configs** (`fc5bbb1`): an override of a
   renamed rule takes the 17 id, one of a retired static rule leaves with
   its comments.
6. **The shifted code frame was real** (`2287b87`): update mode now
   writes the test file after the report, through a global setup the
   preset registers; a run outside the preset still writes at once.

### Raised by the package-test branch, iteration 16

94. Watch mode applies update mode's rewrites only when the watcher
    exits: the setup's teardown is the only moment after the report.
    Vitest's own inline snapshots shift a later frame the same way.
95. A consumer config not built on `defineSpecConfig` keeps the
    immediate write, and the shifted frame with it.
96. `98fa39d` (the K10 commit) swept in chapter 19's sentence about the
    mover's oxlint-config gesture before the code that makes it true
    (`fc5bbb1`): two sessions shared one checkout.

## Iteration 17 — one subject per file, standard names, messages that teach (owner, 2026-09-23)

**Every rule's message teaches** (lint and checker alike), in four parts — `found:` the finding located, `why:` the convention in one sentence, `fix:` the concrete gesture for THIS case (target paths/names included, `make fix` when it can), `read:` the chapter anchor. A meta-test (K11) refuses a catalogue rule whose message lacks a part; every existing message is rewritten to the form.

**One file, one subject.** S1 `one-subject`: every action of a spec file reaches one subject, read statically — api: method + path template; jobs: the triggered job; cli: the command; website: the page; mobile: the journey. `make fix` splits by subject. S2 `subject-folder`: the file's folder is its subject's standard name; `make fix` moves. S3 `describe-names-file`: one top-level `describe`, titled with the file's aspect (`pagination.spec.ts` → `describe('pagination')`); `make fix` renames.

**Standard names, derived, never listed.** A subject's folder is computed from the route: `GET /events` → `events/list/`, `GET /events/:id` → `events/get/`, `POST /events` → `events/create/`, `PUT|PATCH /events/:id` → `events/update/`, `DELETE /events/:id` → `events/delete/`, `GET /events/:id/timeline` → `events/timeline/`, singletons `GET /health` → `health/get/`, `GET /market/:symbol/chart` → `market/chart/`, a method-less route (`ALL /mcp`) → its path segments (`mcp/`); a job → `specs/jobs/<job>/`; a cli command → its command path. Aspect names stay free: S4 `aspect-name` wants kebab-case and refuses generic names (`misc`, `other`, `basic`, `general`, `more`, `edge-cases`, `tests`, `main`); the chapter recommends an api vocabulary (`pagination`, `filters`, `sorting`, `language`, `validation`, `not-found`, `auth`, `shape`), advised, not enforced.

**Size and sharing within a file.** S5 `file-size`: at most 400 lines (ratchet-recordable; the message groups the tests by title prefix to suggest the cut). S6 `shared-expectation`: a file-level expectation constant serves 2+ tests, else it is inlined (autofix). S7 `no-foreign-expectation`: a spec imports no expectation from another spec file (contract builders and typed helpers allowed). S8 `file-context`: a setting repeated on every chain of a file (the same `.clock(…)`) is declared once for the file — `const events = api.with({ clock: '…' })` (new API) — warn, autofix.

### What the package-test branch did (iteration 17)

The eight S-rules took these ids, all free in the catalogue: S1 `c29-one-subject`, S2 `c30-subject-folder`, S3 `c31-describe-names-file`, S4 `c32-aspect-name`, S5 `c33-file-size`, S6 `d28-shared-expectation`, S7 `d29-no-foreign-expectation`, S8 `b16w-file-context`; the message meta-test is K11 `k11-messages-teach`.

1. **Every message teaches** (`b1f1ff1`, `da00f1b`). A diagnostic is ONE line, parts joined by `·` — probed on oxlint 1.83: the `unix` reporter prints the rule tag after a multi-line message's last line, so a line break would cut the rule from every problem matcher and from `lintReport`; `agent` folds breaks into spaces anyway; the graphical reporter wraps a long line. The checker keeps `file:line:column: severity jterrazz-check(<id>): …`. A thrown refusal is a block, a part per line (an ambiguity's candidates take several). `why` and `read` are never typed: `lessons()` builds a rule's messages from its `{ found, fix }` and the row; a checker finding carries `found`/`fix` and a full pass name (`CheckerPassId`, closed); the six refusing runtime rows open on a sentence `REFUSAL_WHY` owns (`src/model/lesson/refusal.ts`), which the manifest builds the row from. The generated `(ID — docs/…)` tail is gone; K3 is restated on the `read:` part. K11 holds every plugin message, one rendered finding per pass, every checker line a spec goldens, and every runtime refusal row.
2. **The subject reader** (`4da14ec`, `c390955`): `lint/subject.ts`, the derived-folder table pinned row by row. Two readings the table left open are decided there: a GET on one segment lists a plural noun and gets anything else (`status`, `address` are singletons); a segment is a parameter when it is a hole or anything but lowercase words. A cli sequence is one session, its subject the command it opens on.
3. **The rules** (`f2011e0`, `ee04764`, `b8cb6f1`, `87a8fb1`). Static where one file is enough (C31–C33, D28, D29, B16w — the first rows of the `spec` reach, proven by K4); checker passes where the fix writes other files (C29, C30). C29/C30's fix (before C27/C28's) splits by the subject each test OPENS on, keeps each test's imports, constants and helpers (pruned to a fixpoint, strings and other import clauses no read), merges the file's describes into one titled with the aspect, rebases every relative path that names something (a missing file and a call spelled in a string stay as written), and lifts the old leaf's ground another leaf reads to the specs root, where C28 moves it down. A journey test goes with its opening subject and C29 keeps naming it. C1 lets an api/cli spec sit as deep as its subject's name; C21w no longer judges api, cli and jobs (`b9fb811`), where a leaf IS its subject and its advice ("a domain folder of its own") contradicted C30.
4. **`with()`** (`22a92a9`): `api.with({ clock, headers })`, `jobs.with({ clock })`, `integration.with({ clock })`, `cli.with({ env })`, `website.with({ clock, headers })` — settings only (`ChainContext`), a chain's own setup merging over them. B16w's fix writes it.
5. **This package's specs** (`f2e49de`, `a912353`): migrated by `make fix`, finished by hand — five journeys carry a reasoned `checker-disable-next-line c29`, the literate spec was cut along its describes, raw env writes moved onto `vi.stubEnv` (E9w 39 → 10). The domain vocabulary covers integration and website only. Chapter 18 owns the laws ("A message teaches", "One file, one subject"), 19 the rows; the skill and the examples follow.

Other rules' input trees stand in folders that ARE their rule's case: 34 fixture specs carry a reasoned `checker-disable-line c30`/`c29` on the line the finding would point at, so no golden moved.

### Raised by the package-test branch, iteration 17

97. A cli command's words are read up to the first word that is not lowercase: `exec('spawn shop')` files under `cli/spawn/shop/`, a positional argument read as a subcommand. Declare a runner's command list (`specification.cli(bin, { commands })`), read the first word only, or accept?
98. The singleton/collection split is an English plural test. A repository whose collections are not plural nouns (`/data`, `/news` reads as a collection, `/series` too) files them under `get/`. Accept, or let the app's route table decide at the api project's end, where route coverage already reads it?
99. A page and a journey have no standard name: C29 splits a website file by page but leaves the folders the author's (`streams-noisy.spec.ts` beside `streams.spec.ts`). Derive a page's folder too (`/articles/:id` → `articles/get/`), or keep website trees authored?
100.    The split copies every helper a test reads into each file (`inUpdateMode`, `documentAt`): the typescript ratchet's `no-unsafe-type-assertion` sites multiply with them. A helper module per leaf would dedupe them, but C26 forbids a helper building `file()`. Accept the copies, or let a leaf hold a `*.fixtures.ts` the split writes the helpers into?
101.    C29 counts a test's subjects by the chains it opens; a `beforeAll` chain, or one in a helper outside every test, reaches the file but no test, and the split leaves it in every file. None does here; HYPOTHESIS (2026-09-24): none does in signews-api either, settled by running `jterrazz-test-check --fix` there.
102.    `make fix` cannot be run before a commit that leaves the specs unmigrated: it migrates them. Every rule commit here ran it, then set the specs tree back before `make check`; the migration landed alone. Worth a `--no-move` for such staging, or is the sequence the answer?

## Iteration 18 (owner, 2026-09-23)

- SQL is NEVER inline: the `sql` tagged template is removed from the package (no legacy), `seed()` takes `file()` only. A seed file used by one test lives beside it in `./seeds/`; shared ones at the leaf or the specs-root pool as before (C28's "file only if shared" does not apply to seeds). The mover/fixer turns every inline `sql` into `./seeds/<name>.sql`, named from its first SQL comment when it has one.
- C28's other size exceptions stay per role: an inline request body past 30 lines, an inline expectation past 150 lines goes to a file even when unshared. Messages in the four-part form.
- Open question: typed seed builders (factory-style) — judged by the owner after seeing the seeds as files.

## Iteration 19 — the calls on 97–102 (2026-09-24)

| #   | Decision                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 97  | A cli runner may declare its command list (`specification.cli(bin, { commands: ['spawn', 'build'] })`); with a list, a command's words stop at the first word not in it; without one, only the first word is the subject.                                  |
| 98  | The English-plural reading stays the default; a repository names its irregular collections in `jterrazz.config.ts` (`test: { collections: ['news', 'series'] }`).                                                                                          |
| 99  | Website and mobile trees stay authored: a page is not a CRUD action. C29 still splits a file by page.                                                                                                                                                      |
| 100 | No copies: when a split leaves a helper read by several of the new files, it moves it once into the leaf's `<leaf>.fixtures.ts` (the convention's typed-fixture module, domain-named) and imports it; a helper that builds `file()` stays forbidden (C26). |
| 101 | Settled by running the fixer on signews-api (next round).                                                                                                                                                                                                  |
| 102 | The sequence is the answer; no `--no-move`.                                                                                                                                                                                                                |

### What the package-test branch did (iteration 18)

- **`sql` is gone** (`fe3388e`). The module, its test, the export, the
  text branch of the seed queue and every chapter's form: `SeedSource` is
  `DiskFile<'.sql'>`, so a string or a template is a type error (a
  type-channel row), and past the compiler the B2 refusal names
  `seed(file('./seeds/rows.sql'))` (a builder row).
- **C28's seed branch.** `seeds/` is no inline role: a seed one test reads
  lives beside it and is never an error for being unshared; the pool-down
  move is unchanged. SQL still tagged `sql` in a spec — imported from the
  framework's entry — is refused where the tag stands, and `--fix` writes
  it to `./seeds/<name>.sql` beside the spec, named by its first `--`
  comment, else its test's title, else `seed`, a taken name suffixed `-2`
  and one holding the same bytes reused. That gesture lives alone in
  `lint/checker-sql-seeds.ts`: no release shipped the tag, so it serves
  the vision trees and leaves with the prototype.
- **Per-role caps, both ways.** `requests/` 30 lines (a whole request or a
  body), `expected/` 150 (`INLINE_CAPS`), a JSON file counted as the value
  it becomes, so a file inlined and a value extracted measure the same
  quantity and never oscillate. A single-use file past its cap stays a
  file; a value written in a test past it is a finding, and `--fix` writes
  it beside the test named from the test's title — `.json` for an object,
  `.http` for a request or a response, `.txt` otherwise. A value the fixer
  cannot read as a literal (a hole, an asymmetric matcher, a table) is
  reported with a by-hand fix. Messages in the four-part form; `why` is the
  row's first sentence, shortened so it stays one idea.
- **This package's specs** were migrated by `make fix`, then by hand: the
  six seeds renamed by domain (the two identical Alice seeds went to the
  pool through C27), the titles that said "written in the test" retitled,
  and the one cli test that existed only for the tag deleted.
- **Red on a broken implementation:** seeds re-admitted as an inline role
  (5 C28 documents failed), the requests cap at 150 (3), the expected cap
  at 151 (2), the comment name ignored (1), `SeedSource` widened to
  `string` (the type channel's B2 row).

### What the package-test branch did (iteration 19)

- **97** (`c946c7f`). `CliSpecificationOptions.commands`, read by the
  checker alone. The subject reader takes the literal list from the
  `specification.cli(…)` of the module the spec imports its `cli` from:
  with it, every leading word the list holds; without it, the first word.
  This package's `cli/spawn/shop/` spec moved to `cli/spawn/`; the db-cli
  runner declares its two commands, which the capability matrix counts.
- **98.** `TestSettings.collections`; the checker loads `jterrazz.config.ts`
  with a synchronous `require()` of the ES module (types stripped by Node),
  every pass being synchronous; a file that does not load is no settings,
  since the toolchain reports it. `lint/` imports nothing of `src/`, so the
  loader states the key it reads (`CheckerSettings`).
- **100, reconciled.** A declaration two new files of a split read — with
  every declaration it reads in turn — moves once into the fixtures module
  of the folder its readers share, `<folder>/<folder>.fixtures.ts` (for
  `api/orders/{list,create}/`, `api/orders/orders.fixtures.ts`): the
  naming recap's typed-fixture module, domain-named by its folder, so §3
  holds; F5 lets a spec import it; I2 does not judge it, being no test.
  One that builds a `file()`/`directory()`, or reads one that does, stays
  copied (C26); a module already at that path is the author's and the
  copies stay. The document lints the result with oxlint and the checker:
  both clean. Found on the way: a function whose return type is an object
  literal was cut at that type's closing brace; the body is now the brace
  that closes its line.
- **99, 102** need no code; **101** waits for the signews-api run.
- **Red on a broken implementation:** the declared list ignored (6 tests),
  the old every-lowercase-word default (4), declared collections ignored
  (4), helpers left copied (2), a `file()`-building helper moved (1).

### Raised by the package-test branch, iterations 18 and 19

103. A spec importing `cli` from two runners (`specs/cli/env/env.spec.ts`
     imports `cli` and `cli as dbCli`) reads every chain with the FIRST
     door's command list. Read the list per handle, or accept — one
     binary per file is the norm?
104. The list is read only when written as a literal in the door;
     `commands: COMMANDS` reads as no list, so the first-word default
     applies. Follow a `const` in the door, or require the literal?
105. C30's move leaves the subject folder it emptied behind (the spawn
     spec's old `shop/` folder stayed, empty, on disk). C14 and C27 remove
     theirs: align C29/C30?
106. The split moves `const`/`let`/`function` declarations only. A type
     alias a moved helper reads stays in the spec files, and the fixtures
     module would not compile. None here. Carry types along?
107. A seed named from its test's title is long
     (`seeds-apply-in-the-order-listed-each-to-the-database-it-names.sql`);
     all six here were renamed by hand. Cap the name at a few words, or
     warn on a seed file with no leading `--` comment?
108. The cap scan skips a `toMatch` whose subject ends in `.text)` or
     `.raw)`, vitest's own. A long template compared to a plain string
     variable would be reported, and the fix would write a `.txt` golden
     a string subject cannot take (D14). HYPOTHESIS (2026-09-24): no
     such site in the estate; settled by running the checker on
     signews-api.
109. Coverage fell from 84.65 % to 84.11 % of statements across the two
     iterations (8540/10088 → 8734/10383; the floor held). The coverage
     report says where: `lint/checker-sql-seeds.ts` is 22.8 % covered and
     `lint/checker-sharing.ts` 36.6 %, because the documents that prove
     them run `dist/checker.js` in a child process coverage never sees.
     Give those passes in-process unit tests, or count the documents'
     child runs?

## Iteration 20 (owner, 2026-09-24) — production never imports test code

Audit F2 (and whatever else guards it) against every way production code can reach test material, each form with a spec red when the guard is removed:

- targets: `*.test.ts(x)`, `*.spec.ts`, `*.specification.ts`, `*.fixtures.ts`, anything under a ground folder (fixtures/, seeds/, requests/, expected/) or under `specs/`, contract modules (`contracts/`), and the test packages themselves — `@jterrazz/test`, `vitest`, `@vitest/*`, `msw`, testing-library, playwright — from a production module;
- forms: static import, `import type` (still refused: prod must not depend on test shapes), `export … from` / `export * from` re-exports, dynamic `import()`, `require()`, `new URL('./x', import.meta.url)` / `fs.read*` of a ground path, a tsconfig `paths` alias or package `imports` (`#…`) that resolves to test material, and a production barrel (`index.ts`) that re-exports test material (transitive reach);
- a build-level guard beside the lint one: the package's publish/build check fails when `dist/` (or the bundle) contains a module compiled from test material.
  "Production module" = a non-test module under src/ or lint/ (and an app's src/): define it once, in one reader, shared by every guard.

## Iteration 21 — the calls on 103–109 (2026-09-24)

| #   | Decision                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 103 | Each chain is read with the command list of the runner its handle came from.                                             |
| 104 | A `commands` list bound to a `const` in the runner file is followed.                                                     |
| 105 | C30's move removes the folder it empties, like C14 and C27.                                                              |
| 106 | The split moves type aliases and interfaces a moved helper reads, with it.                                               |
| 107 | A seed named from a test title keeps its first four meaningful words, kebab-cased.                                       |
| 108 | Settled on signews-api (next round).                                                                                     |
| 109 | Coverage collects the checker's child processes too (`NODE_V8_COVERAGE`), so documents that run `dist/checker.js` count. |

### What the package-test branch did (iteration 20)

**The audit.** Targets against forms, per guard, at `5f0381e` and after
`73408ac`. `P` proves (a spec case, red when the guard goes), `W` catches
with no spec, `—` nothing, `n/a` the form cannot name the target. A
package is never read by path, so the path and alias columns are `n/a` for
the six packages.

Before:

| Target                                               | static      | `import type` | `export {…} from` | `export *`  | `import()`  | `require()` | URL / fs path | `paths` / `#…` | through a non-prod module |
| ---------------------------------------------------- | ----------- | ------------- | ----------------- | ----------- | ----------- | ----------- | ------------- | -------------- | ------------------------- |
| `*.test.ts(x)`                                       | F2 P        | F2 W          | F2 W              | F2 W        | F2 W        | —           | —             | —              | —                         |
| `*.spec.ts`                                          | —           | —             | —                 | —           | —           | —           | —             | —              | —                         |
| `*.specification.ts`                                 | —           | —             | —                 | —           | —           | —           | —             | —              | —                         |
| `*.fixtures.ts`                                      | F2 P · F5 P | F2 W · F5 W   | F2 W · F5 W       | F2 W · F5 W | F2 W · F5 W | —           | —             | —              | —                         |
| ground (`fixtures/` `expected/`)                     | F2 P        | F2 W          | F2 W              | F2 W        | F2 W        | —           | —             | —              | —                         |
| ground (`requests/` `seeds/`)                        | F2 W        | F2 W          | F2 W              | F2 W        | F2 W        | —           | —             | —              | —                         |
| `specs/`                                             | —           | —             | —                 | —           | —           | —           | —             | —              | —                         |
| `contracts/`                                         | —           | —             | —                 | —           | —           | —           | —             | —              | —                         |
| `@jterrazz/test`, `vitest`                           | F2 P        | F2 W          | F2 W              | F2 W        | F2 W        | —           | n/a           | n/a            | —                         |
| `@vitest/*`, `msw`, `@testing-library/*`, playwright | I1 W        | I1 W          | I1 W              | I1 W        | I1 W        | —           | n/a           | n/a            | —                         |
| a `dist/` compiled from any of them                  | —           | —             | —                 | —           | —           | —           | —             | —              | —                         |

I1 is `W` for the four packages because it holds only where a project
declares a layer map, and only for a layer that does not list them. F4, F6
and I4 guard tests, not production: nothing. F2 read as production every
file that was not a test, a config or under `specs/` — `scripts/` and a
root `index.ts` included — and a `.test-d.ts` as production (this
package's own type channel disabled F2 to import `expect`).

After, every cell of the first ten rows is `P` but the `n/a` ones, for
F2; F5 and I1 read every form too. The proof factors: every form yields a
specifier through ONE visitor (`moduleReferenceVisitor`) and every
specifier is judged by ONE reader (`reachOf`), so the F2 spec proves each
form once (on `*.fixtures.ts`, `vitest` for `require.resolve`) and each
target once (static), and a guard removed from either half turns it red.
The path form is proven on ground and `specs/` (`new URL`, a directory
`new URL`, `join(import.meta.dirname, …)`, a module-scope binding of
`import.meta.url`, a `${__dirname}` template, `readFileSync('./…')`); the
aliases on `<specs>/fixtures/`; the reach through a non-production module on
a package and on a `specs/` file. The `dist/` row stays `—`: it is the
toolchain's (below).

**One reader, `lint/production.ts`.** A production module is a source
module under a `src/` or a `lint/` folder, below the project root that
holds it, that is no test material. Test material: the suffixes
`.test` `.spec` `.test-d` `.spec-d` `.specification` `.fixtures`; ground
and `specs/` anywhere in the path; a `*.contracts.ts` facade and the
`contracts/` folder that holds one (so this package's `src/model/contracts/`,
which holds none, stays production); the packages `@jterrazz/test` (but
`/oxlint`), `vitest`, `@vitest/*`, `vitest-browser-*`,
`vitest-mock-extended`, `msw`, `@testing-library/*`, `playwright`,
`playwright-core`, `@playwright/test` — the last four beyond the
iteration's list, as the same runtimes' other names. F2, F5 and I1 read
it.

A specifier resolves relatively (a `.js` to its `.ts`), through the
nearest `tsconfig.json`'s `paths` (JSONC read, `baseUrl` honoured) or the
package's `imports` (every condition's target).

A local module that is
neither production nor material is walked in turn (its specifiers read by
text, comments blanked, cycles cut); a production module on the way ends
the walk, since it is judged for its own references — so a barrel is
reported where the chain leaves production, and an override that exempts
a module (this package's runner seams) is not re-judged at every importer.

**This package's own production is test tooling.** `seams/msw/` and
`seams/playwright/` join the F2 overrides, and so do `src/index.ts` and
`src/facets/specification.ts`: they re-export the facet constructors,
which the layout names `<facet>.specification.ts` — the suffix F2 now reads
as test material (question 110).

**Red on a broken implementation, the targets** (the F2 spec, 59 cases,
unless named): the package list emptied but `@jterrazz/test` (6), the
`@vitest/` and `@testing-library/` prefixes (3), the suffixes cut to
`test|fixtures` (5, with I1), `specs/` not read (2), ground not read (9,
with I1), a facade not read (1), a `contracts/` folder taken without its
facade (1), no contracts folder (1), `lint/` not production (1),
production = everything non-material (3), the `/oxlint` entry refused (1),
I1 back on its own regex (2, the I1 spec).

**Red on a broken implementation, the forms:** no `paths` (1), no
`imports` (1), no transitive walk (2), a walk that does not stop at
production (1), no `require()` (3, with F5 and I1),
no `require.resolve`/`import.meta.resolve` (2), no type `import('…')` (1),
no `import x = require()` (1), no `export *` (3), no `export {…} from` (2),
no `import()` (1), `import type` skipped (2), no `new URL` (2), no anchored
path (2), no template path (1), no module-scope anchor (1), no fs literal
(1).

**Measured on the estate** (the rule alone over each clone,
`oxlint -c f2only.json .`, 2026-09-24): jterrazz-design 59 — 56
`@testing-library/react-native` imports in `packages/native/src/**/*.render.tsx`,
3 `./atlas.fixtures` imports (question 112); package-manifest 2, the
`src/testing/` entry importing `@jterrazz/test` it already had; every other
clone 0 (hoverfly-lsp's one finding of ADR-006's census is gone with the
narrower definition, question 111).

#### The contract the toolchain's Publish pass needs

The build guard is `@jterrazz/typescript`'s: its Publish pass fails when a
shipped file is compiled from test material. What it needs, and what this
package owes it:

- **Where.** On the files the tarball ships (`npm pack --dry-run --json`),
  after the build, for every package the pass already judges.
- **Evidence of origin.** For each shipped `.js`, the source modules
  compiled into it. The module graph is the one that needs no change to
  what ships: the pass builds with a plugin of its own on the tsdown /
  rolldown config, whose `generateBundle(_, bundle)` hook lists each
  chunk's `moduleIds` by `fileName` — bundled `node_modules` modules
  included. Source maps are the other way (`sources` of each `.map`); this
  package now writes them (call 109) but keeps them out of the tarball, and
  a package that writes none would need a second build.
- **The judgement, one owner.** A module id is test material by THIS
  package's reader: `materialAt(path)` for a local id,
  `testPackageOf(name)` for an id under `node_modules/<name>/`. An import
  left external in a shipped file (`import 'vitest'` in `dist/index.js`) is
  judged by `testPackageOf` too, unless the package declares that package
  in `dependencies` or `peerDependencies` — a test tool ships its runtime on
  purpose. For one owner, `@jterrazz/test` has to publish the reader: the
  two functions, zero-runtime, on the `./oxlint` entry the toolchain
  already resolves by name. Not done here — it widens the published surface
  (owner's call); until then the toolchain would copy the definition.
- **The finding**, four parts: found `dist/index.js is compiled from
src/domain/user.fixtures.ts, a test file`; why `A published build never
carries test material.`; fix `cut the production edge F2 names, or take
the module out of the entry`; read the F2 row.
- **Proof.** A fixture package whose entry imports a `*.fixtures.ts` with
  F2 turned off: the pass fails; the same package without the import:
  green; the check removed: the first case goes green.
- **Known collision.** On this package the pass would read `dist/index.js`
  as compiled from `src/facets/*/<facet>.specification.ts` — question 110
  again.

### What the package-test branch did (iteration 21)

- **103, 104** (`737df9b`). `SubjectReading.commands` is a record by
  handle: `doorsOf` maps each local name a spec holds a cli runner by to
  its module, a `.with()` view under its runner's, and each chain reads its
  own handle's list. `declaredCommands` follows `commands: NAME` and
  `{ commands }` to a `const` of the runner's file. `doorOf` is gone.
- **105** (`663ee64`). `fixSubjects` removes the leaf a move emptied and
  each parent that empties in turn, up to the specs root.
- **106** (`cfde5fb`). `type X` and `interface X` are declarations: they
  follow a moved helper into the fixtures module and never seed a move;
  a file reading only types imports them with `import type`, one reading
  values too marks each type inline. Unread types are pruned from split
  files like any declaration.
- **107** (`9a491a0`). A seed with no leading comment takes the first four
  words of its test's title that are not filler, kebab-cased
  (`seeds-apply-order-listed`).
- **109** (`8f2b4a4`). This repository's vitest config turns on
  `autoAttachSubprocess`, reads `dist/` and judges after the remap
  (`excludeAfterRemap`); every build group writes source maps, left out of
  the tarball. `checker-sql-seeds.ts` 22.8 → 95.4 %, `checker-sharing.ts`
  36.6 → 91.8 %, the run 84.41 → 92.96 % of statements over 12 607 instead
  of 10 383. The maps had a runtime cost found by the website specs: vitest
  applies them to the stacks of specs importing the package's own `dist/`,
  a bundle frame read as `src/…`, and caller detection took the framework
  for its caller (`spawn /bin/sh ENOENT`). A build's framework trees are now
  the bundle and the `src/` its maps point to (`frameworkTreesOf`).
- **Red on a broken implementation:** every chain read with the first list
  (1), views not mapped (1), the const not followed (2), the shorthand not
  read (1); the emptied folder kept (1), the emptied parent kept (1); types
  not declarations (1), a type two tests read moved (1), types imported as
  values (1), no `import type` (1); the whole title (3), filler kept (4);
  subprocesses not attached, `dist/**` excluded before the remap, maps
  off, maps shipped (1 each); the map-aware caller removed (the two website
  `services` specs).

### Raised by the package-test branch, iterations 20 and 21

110. This package names its production facet constructors
     `<facet>.specification.ts`, the suffix F2 reads as test material; the
     two barrels re-exporting them are exempted by path, and the dist guard
     would trip on `dist/index.js`. Rename them (`<facet>.constructor.ts`,
     the layer map and chapter 01 with them), or keep the exemption?
111. Production is `src/` and `lint/` now, as the iteration defined it;
     F2 used to judge every non-test file, so `scripts/`, `bin/`, a root
     `index.ts` or an app with no `src/` are no longer held. Read a
     package's `main`/`exports`/`bin` targets as production too?
112. jterrazz-design's native render tests are `*.render.tsx` under
     `src/` (jest runs them, F8's React Native exception): F2 reads them as
     production and reports 59. Rename them to the `.test.tsx` suffix, or
     is `.render.tsx` a suffix the reader should know?
113. The walk through a non-production module reads its specifiers as
     text; a path it builds (`new URL`, fs) is not seen there. Parse those
     modules, or accept?
114. `paths` is read from the nearest `tsconfig.json` alone: an `extends`
     carrying `paths` is not followed. Follow it?
115. The coverage floor records 76.90 % of statements; the suite reads
     92.96 % since 109. Re-record it (`npm run coverage`)?

## Iteration 22 — no empty directory (owner, 2026-09-24)

- git never tracks an empty directory, so one exists only on a machine: the toolchain's tree gate reports every empty directory that git does not ignore (walked on disk, `.git/` and ignored paths excluded; a directory holding only empty directories counts as empty), and `make fix` deletes them. Four-part message. CI never sees one — the rule is for the working copy (a fixer or a move that emptied a folder, an abandoned scaffold).
- Every fixer that moves files (C14, C27, C28, C29/C30, the mover) already removes what it empties; this rule catches the rest.

## Iteration 23 — size (owner, 2026-09-24):, complexity, explicit type-aware rules, the upgrade pass

- `max-lines` 300 per file in src/ (specs keep C33 400) and `max-lines-per-function` 60 ON (the "covered by complexity" reason was false: complexity counts paths, not size); `complexity` stays 12 with `variant: 'modified'`. Debt on the ratchet.
- Every tsgolint (type-aware) rule is decided BY NAME in the rulebook like every other rule; a spec fails when the installed tsgolint ships a rule the rulebook does not decide.
- Verify the pinned oxlint carries the React-Compiler-backed rules of the 2026-08-18 release (bump if not). The React Compiler TRANSFORM (oxc-transform-react, experimental) is NOT adopted in the wave: an experiment on one Vite app later.
- Route subjects: a test writes the route template with its params (`.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })`) — the orchestrator's default, reversible by the owner.
- The upgrade pass: research online the state of the art (oxc/oxlint/oxfmt/tsgolint/tsgo/rolldown/tsdown/vitest/knip and alternatives), find JS-plugin rules of ours that oxlint now implements natively in Rust, faster or better plugins, and update every dependency of both packages to its latest; adopt what is stable, record what is not. Any forgotten business behaviour noticed on the way gets its spec.

## Iteration 24 — the calls on 110–115 and the signews-api defects (orchestrator, 2026-09-24)

| #               | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 110             | This package's facet constructors are renamed `<facet>.handle.ts` (each constructor returns a handle); no path exemption in F2.                                                                                                                                                                                                                                                                                                                                           |
| 111             | Production is every non-test module outside `specs/` and the ground folders — `bin/`, `scripts/` and root modules included.                                                                                                                                                                                                                                                                                                                                               |
| 112             | jterrazz-design's `*.render.tsx` jest tests become `.test.tsx` in its wave row; recorded for the migration, not a package change.                                                                                                                                                                                                                                                                                                                                         |
| 113             | The walk parses a non-production module (AST), so a `new URL`/`fs` path inside it is seen.                                                                                                                                                                                                                                                                                                                                                                                |
| 114             | `paths` aliases follow the tsconfig `extends` chain.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 115             | The coverage floor is re-recorded from CI during the real refactor.                                                                                                                                                                                                                                                                                                                                                                                                       |
| route params    | A test writes the route template: `.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })`; the subject reader reads the template.                                                                                                                                                                                                                                                                                                                              |
| signews defects | (1) `toMatch(file())` on a plain string is refused (types + runtime) and C28 never extracts a string comparison to a file; (2) a seed shared by a route and its sub-route goes to their common level the route can reach; (3) the checker's fixes are formatted in the same `make fix`; (4) `with()` views are named `<subject>` consistently by the fixer; (5) seed names capped (done, 107); (6) the split copies a hook only into files whose tests read what it sets. |

### What the package-test branch did (iteration 24)

- **110** (`c18ed82`). The seven constructors are `src/facets/<facet>/<facet>.handle.ts`;
  the F2 override for the two barrels is gone. F2 then judged the api
  constructor for the first time and found its `import('vitest')` of the
  route ledger, which moved to `src/runner/provided.ts`. A meta-test reads
  every bundle's source map and fails on a module that is test material
  (`materialAt`), the local half of the Publish contract of iteration 20.
- **111** (`074dd4c`). Production is every source module that is no test
  material, but a tool's config (`*.config.*`) and a module under a retired
  test root (`__tests__/`, a root `test/`/`tests/`, I2's). F2 alone over the
  estate, new findings: package-typescript 3 (fixture projects under
  `specs/` with their own `package.json`) and spwn 3
  (spwn's web fixture app, in a `specs/` package, and
  the gate's browser service entry, a service that drives playwright at run
  time — question 116).
- **113** (`77d98c6`). The walk parses the relay module with `oxc-parser`
  (a new runtime dependency, behind `src/seams/oxc-parser/`) and runs F2's
  own visitors over it; the regex reader is gone.
- **114** (`48ec2f6`). `paths` is folded through the `extends` chain the
  compiler's way (string or array, relative or a package's config, `baseUrl`
  read where stated).
- **Route params** (`ef64b32`, `a79cbf7`). `get`/`delete(template, { params })`,
  `post`/`put(template, body, { params })`; the params are inferred from the
  template and required exactly when it holds one; `{ params: {} }` states a
  literal path is the route. New row B12 (type + runtime). The server port's
  fourth argument is `{ headers, template }`; route coverage matches a
  templated request by its template. The subject reader reads the template;
  the rule for a filled path: a lowercase word right after a collection,
  with more path after it, reads two ways — C30 reports it at its chain,
  naming the template to write (or `{ params: {} }`), and never moves it. The
  last segment keeps the literal reading.
- **Defects.** (1) `532e041`: a `file()`/`directory()` carries a
  `Symbol.match` that refuses, so no string matches it runner or none (the
  false green was vitest reading the path object as the pattern
  `[object Object]`); C28 never writes a plain subject's value to a file and
  names `text()`. (2) `246c610`: C15 accepts an enclosing leaf's ground, C28
  moves a pool entry only a route and the routes under it read into the
  route's ground. (3) `62ebef8`: `make fix` runs the checker, then the
  toolchain. (4) `94771b8`: B16w names the view for the subject. (6)
  `6130bb3`: the split keeps a hook only where the tests read what it sets.

### Raised by the package-test branch, iteration 24

116. spwn's gate browser service (`gate/browser/index.js`) requires `playwright` at run time:
     a service whose product IS a browser. F2 reads playwright as a test
     package. Allow it for a package that declares it in `dependencies`
     (the rule iteration 20 set for the dist guard), or suppress there?
117. The consumer Makefiles still run `typescript fix` before the checker
     (signews-api `c50effa3`). Carry the new order into each repository's
     wave row, or have the toolchain own the `fix` recipe?
118. C28 reads a plain subject by its spelling (`expect(name)` or a string
     literal): an accessor held in a variable (`const out = result.stdout;
expect(out).toMatch(…)`) is now left in place with the `text()`
     advice. Accept, or resolve the binding?

## Iterations 25 and 26 — the upgrade pass, and the calls on 116 to 118 (orchestrator, 2026-09-24)

- **Lint performance.** A file's role is read once per file for every
  rule; every rule moves from `create` to `createOnce`, with a `before()`
  that returns `false` for a file it does not judge; oxlint's plugin types
  come from `@oxlint/plugins`. Measured with `oxlint --debug=timings`
  before and after; no rule's verdict moves.
- **D2** hands `toBeEmpty`/`toBeRunning` to `vitest/valid-expect`'s
  `asyncMatchers` where that removes a JS check.
- **Upgrades.** tsdown 0.23 (check `dist/oxlint.d.cts`); declarations from
  the `tsgo` generator if the output is identical; better-sqlite3 13 with
  @types 9, the peer widened to `^12.11.1 || ^13` if green; every safe
  patch and minor bump.
- **Flakes.** A `--repeats` gesture for the known flaky tests (the
  chromium component import, the container log capture, the type
  channel's compiler run); the cause fixed if the repeats reproduce it.
  `fsModuleCache` on the unit project, kept only if faster and green.
- **116.** A production module that legitimately runs a test package
  declares it in `jterrazz.config.ts` — `test: { production: { allow: {
playwright: 'the gate drives a browser in production' } } }` — and F2
  honours it; no other exemption.
- **117.** Consumers copy the `make fix` recipe from the chapter: the
  checker first, the formatter last. **118** is accepted as a
  HYPOTHESIS, revisited if a consumer trips it.

### What the package-test branch did (iterations 25 and 26)

- **The toolchain** (`02b7c2d`) is package-typescript's `c87e969`: oxlint
  1.85, oxlint-tsgolint 7.0.2002, oxfmt 0.70, knip 6.38. Its ratchet
  delta: the size caps (`max-lines` 43, `max-lines-per-function` 125,
  recorded), `unicorn/consistent-function-scoping` 12 (six paid, six
  recorded — Given steps and a test-local type), `prefer-optional-chain`
  4 and one unused `oxlint-disable` (paid); nine counts fell and were
  re-recorded. Its empty-directory gate then found the cli matcher specs
  leaving `expected/` folders empty (`4882559`): a transient golden now
  takes its emptied folder with it.
- **Lint performance** (`094de28`, `7127fbb`, `e089f27`).
  `oxlint --type-aware --debug=timings`, this repository, two runs each:

    |                                             | JS runtime       | rule callbacks   | wall        |
    | ------------------------------------------- | ---------------- | ---------------- | ----------- |
    | before (607 files)                          | 7,321 / 7,162 ms | 7,059 / 6,900 ms | 8.4 / 8.3 s |
    | a file's identity once per lint (609 files) | 1,922 / 1,903 ms | 1,697 / 1,682 ms | 3.1 / 2.9 s |
    | every rule `createOnce` (610 files)         | 1,990 / 1,969 ms | 1,762 / 1,745 ms | 3.2 / 3.0 s |

    The memo (lint/linted-file.ts, keyed on `context.sourceCode`, which
    oxlint's `WeakMap` forgets when a file's lint ends) is the whole gain;
    `createOnce` is flat, oxlint 1.85 not yet skipping JS on
    `before() → false`. The jterrazz diagnostics are the same, rule by rule,
    before and after. `createOnce` opened a failure class RuleTester cannot
    see (it builds a fresh rule per case: C24 with its reset removed passed
    every test): lint/rule-shape.test.ts holds every rule to no unreset
    `let`, and to the same verdicts from each E2E fixture alone and after
    its corpus through one visitor. `@oxlint/plugins` is a dependency: the
    published declarations import its types. Typed by them, three report
    sites (B8, B16w, D28) failed to compile and were narrowed.

- **D2** is unchanged — see question 119.
- **Upgrades.** tsdown 0.23 (`d54aaf0`): the declarations are the same
  surface, written as inline `export declare`; `dist/oxlint.d.cts`
  included. The `tsgo` generator was tried and not taken (question 120).
  better-sqlite3 13 and @types 9 (`5510727`): 13 ships its binding
  prebuilt, so `npm ci` needs no rebuild; the peer takes
  `^12.11.1 || ^13`. The development floors (`f571126`). redis's
  deprecated `disconnect()` gives way to `destroy()` (`682e243`),
  `typescript/no-deprecated` leaving the ratchet. oxc-parser 0.151 (a 0.x
  minor of a runtime dependency) is left for its own change.
- **Flakes** (`2beaacf`). `npm run test:repeat -- <files>`. None of the
  three reproduced: type-channel ×10 and the log capture ×10 alone, the
  whole suite ×2 under full load, three full `--coverage` runs on an
  emptied component dependency cache. The repeats found a test that could
  not run twice (the sqlite template guard, fixed) and that a RuleTester
  file refuses its own second pass. `fsModuleCache` on the unit project:
  25.27 / 25.26 s off, 25.36 / 25.44 s on a warm cache — not kept.
- **116** (`3e879ec`). `test.production.allow` in the settings type; the
  checker's reader keeps the list only when every entry has a reason; F2
  reads an allowed package as reaching nothing, directly or through a
  module that is not production.
- **117** (`256a622`). Chapter 19 states the order, with the recipe.
- **Red on a broken implementation:** the shared-answer memo recomputed
  (1), the memo keyed without the filename (1); C24's per-file reset
  removed (the reset test), E2's gate inverted (5); the sqlite guard
  before its fix under `--repeats 3` (1); F2's allow check removed (1),
  the settings reader keeping a reasonless entry (1).

### Raised by the package-test branch, iterations 25 and 26

119. `vitest/valid-expect` with `asyncMatchers: ['toBeEmpty',
'toBeRunning']` flags the negative-spec form D2 sanctions,
     `await expect(expect(x).toBeEmpty()).rejects.toThrow(…)` (four sites
     here), and an assigned-then-awaited matcher. The two matchers are
     typed `Promise<void>`, so the type-aware `no-floating-promises`, on
     in every profile, already refuses the bare statement and accepts
     both forms. Hand them to it and keep D2's JS for the
     argument-dependent `toMatch`, or keep D2 whole?
120. The `tsgo` declaration generator writes the same declarations but
     two string-literal types in `index.d.ts`, single-quoted (`'any'`
     for `"any"`), builds in 1.7 s against 2.8 s, warns that TypeScript 7
     has no stable API, and needs the platform binary's path (TypeScript
     7 is not the `typescript` package here). Take it with that diff, or
     wait for 7.1?
121. With the memo in, the JS plugin's cost is F2 (~500 ms, a reach walk
     per import), B9w (~250 ms: two walks of every file, no role gate)
     and A1 (110–175 ms). Gate B9w by role, which would narrow its reach?
122. The toolchain's chapter (`docs/06-quality-checks.md` § The six
     gestures) still shows `typescript fix` before the checker; it is the
     toolchain's to turn in its next round.

## Iteration 27 — the calls on 119 to 122, and the toolchain round's findings (orchestrator, 2026-09-24)

- **119.** `toBeEmpty` and `toBeRunning` are left to the type-aware
  `typescript/no-floating-promises`, on in every profile; D2 drops its own
  check for them and keeps the argument-dependent `toMatch`. The handoff is
  proven: the typed rule catches a missing `await` on each.
- **121.** F2's reach walks are cached per run; B9w is gated to the roles
  it judges; re-measured.
- **A test body is at most 60 lines**: a new rule on `test(…)`/`it(…)`
  callbacks. The toolchain's `max-lines-per-function` goes off in test
  files, because C31's one `describe` is itself a long function.
- **C31's fix** keeps module-level helpers at module scope, and handles a
  `describe.each` and a second top-level `describe`.
- **D29** judges only imports of other spec files: a spec may compare
  against a production module's data (`package.json`).
- The prototype's version is 17.0.0, and the toolchain's 11.0.0, so the
  peer `^11.0.0` resolves locally; no release is cut.

### What the package-test branch did (iteration 27)

- **The version** (`4d106b4`): 17.0.0 in `package.json` and the
  lockfile's two root entries.
- **119** (`952c0da`). D2 no longer names the two matchers. A new
  meta-test, lint/type-aware.test.ts over lint/type-aware.ts, holds all
  six profiles of the toolchain to `no-floating-promises` at `error` with
  `typeAware` on, and lints a scratch source typed by this package's
  augmentation: a bare `toBeEmpty`, `.not.toBeEmpty` and `toBeRunning` are
  refused; the awaited, returned, assigned and `rejects` forms are not.
  Chapters 14 and 11 say who holds which `await`.
- **121** (`6fa395f`, `5a8f698`). `reachOf` keeps each answer by folder,
  specifier and allowed packages: a production module on the way ends a
  walk, so one folder's answer is every module's there. oxlint shows a
  plugin no run boundary, so `lintBegins` (F2's `before()`) draws it:
  the answers are dropped when a file is linted a second time, or a
  module a walk passed through is linted. B9w reads the `specification`
  role alone, its reach narrowed to it: A1 refuses a runner created
  anywhere else. `oxlint --type-aware --debug=timings`, this repository,
  two runs each:

    |                           | F2           | B9w          | JS runtime       | rule callbacks   | wall          |
    | ------------------------- | ------------ | ------------ | ---------------- | ---------------- | ------------- |
    | before (610 files)        | 511 / 505 ms | 242 / 242 ms | 1,906 / 1,894 ms | 1,695 / 1,690 ms | 2.98 / 2.91 s |
    | F2 cached (612 files)     | 296 / 296 ms | 242 / 240 ms | 1,674 / 1,678 ms | 1,471 / 1,474 ms | 2.65 / 2.66 s |
    | B9w gated (612 files)     | 294 / 297 ms | 2.8 / 2.5 ms | 1,443 / 1,451 ms | 1,241 / 1,250 ms | 2.42 / 2.46 s |
    | the iteration (614 files) | 334 / 298 ms | 2.8 / 2.6 ms | 1,550 / 1,456 ms | 1,333 / 1,252 ms | 2.63 / 2.43 s |

    The jterrazz diagnostics are the same before and after each of the
    two steps (74, across 7 rules). The last row carries C34, 3.8 ms.

- **C34** (`1743ea8`). `c34-test-body-size`: the function a
  `test(…)`/`it(…)` runs, modifiers and tables included, spans at most 60
  lines, counted as the toolchain counts; in the three test roles; two
  documents, chapter 18 and the skill. This repository has three test
  bodies past it, recorded (`jterrazz/c34-test-body-size: 3`).
- **C31** (`15ed568`). The wrap and the merge are one edit: what stands
  between the first test or group and the last stays above the new
  `describe`; a group titled with the aspect is unwrapped; another
  group's tests take its title, `<group> — <test>`, one level deep as J10
  wants and the prefix C33 groups by. A group with a hook or a local, a
  modified group and a table beside another group are scopes, refused
  without a fix. A lone `describe.each` passes when its title starts with
  `<aspect> — `, and its fix prefixes the aspect.
- **D29** (`dd24793`). An import counts only when its path resolves under
  the spec's `specs/` anchor; chapter 18 says the product's data may be
  compared against.
- **Red on a broken implementation:** `toBeEmpty` typed `() => void` (the
  type-aware test, 1) and D2 given back the two names (3); the reach cache
  bypassed (1), `lintBegins` never clearing (2), the walked modules not
  tracked (1); B9w's gate removed (1); C34's cap raised to 600 (2); C31's
  hoisting bypassed (2), a table read as a plain group (3), no group ever
  flattened (3); D29's anchor check removed (2).

### Raised by the package-test branch, iteration 27

123. F2's run boundary is drawn from what oxlint does, not from a hook.
     HYPOTHESIS (2026-09-24): in the editor's host, a file created after
     a folder's answer was kept, and asked about first by a sibling never
     linted in the run, reads the kept answer until any file is linted
     again. Settled by one session in an editor with the language server,
     creating `x.test.ts` beside a module whose sibling imports `./x.test`.
     Accept, or ask oxlint for a run hook?
124. F2 is still the plugin's largest rule (~300 ms): the first walk of each
     folder, where every candidate is probed three times through the git
     tree seam (the file, the index, its folder). A project-root memo per
     folder, under the same boundary, is the next cut. Take it?
125. A1 is next (103–170 ms over the runs, 12.5k calls): by its
     convention it reads every file but a specification, so no role gate
     narrows it; its cost is the `CallExpression` visit. Skip a file whose
     text never says `specification.` in `before()`, or leave it?
126. Until the toolchain turns `max-lines-per-function` off in test
     files, C34's three findings here are reported twice, and every long
     `describe` still counts on the toolchain's ratchet.
127. `make fix` ran `npm ci` because the version bump moved the lockfile,
     reinstalling `@jterrazz/typescript` from its clone through
     install-links; that clone still says 10.3.2 against the peer
     `^11.0.0`. npm did not refuse it: the dev dependency is a `file:`
     link. The peer only resolves once the toolchain's prototype is 11.0.0.

## Iteration 28 — the calls on 123 to 125 (owner, 2026-09-24)

- **123.** F2's per-run cache is keyed like the tree listing (git index +
  directory mtimes) so an editor never gets a stale answer.
- **124.** `projectRootOf` remembers each folder's project root.
- **125.** A1 skips a file that never says `specification.` (text
  pre-check). Measure.

### What the package-test branch did (iteration 28)

- **123** (`9b0b6fe`). `lintBegins` resets the reach cache when a file's
  own folder answers a tree listing differently than the last time this
  run asked it (`folderChanged`, `lint/fs-cache.ts`), reading the tree
  seam's own freshness stamp (`treeStamp`, `src/seams/git/tree.ts` — the
  same git index and directory modification times its own staleness
  check already reads). The file-linted-twice and walked-then-linted
  triggers stay: a content edit of a module the walk passed through
  moves no directory's time, so only they catch it.
- **124** (`9913a91`). `projectRootOf` memoises its answer per starting
  directory, invalidated by the same `folderChanged` signal — a
  `package.json` written or removed AT a directory already answered is
  seen next time, a directory above or below it is a fresh walk's to see.
- **125** (`30b8c58`). A1's `before()` checks `context.sourceCode.text`
  for the literal `specification.` first: a file that never writes it
  cannot hold the `specification.<member>(…)` call the visitor looks for.
- **Red on a broken implementation:** 123's boundary with the
  `folderChanged` trigger removed (1); `treeStamp` reading the directory's
  own time alone, blind to the git index (1); 124's memo with no
  invalidation (1); 125's pre-check inverted (both of A1's existing
  `invalid` cases, 2).
- **Verdicts unchanged.** `oxlint --type-aware --format=json` reports the
  same 1370 diagnostics before and after, byte-identical but for one
  message (`lint/production.ts`'s grown line count, from the added code).
  `npx vitest --run --project unit`: 389 files, 2016 tests, green across
  all three commits. `make fix` then `make check` exit 0 (2362 tests
  passed, 1 skipped).
- **Timings.** Toolchain reinstalled at package-typescript's HEAD
  (`npm ci`, clone at `f9f2d92`) before measuring. `oxlint --type-aware
--debug=timings` produced no visible timing output in this environment
  — text, JSON (`--format=json`) and even a clean single-file run all
  print nothing beyond the diagnostics themselves; `--help` lists the
  flag, and the JS-plugin side does collect per-rule timings internally
  (`node_modules/oxlint/dist/lint.js`'s `collectTimings`), but nothing
  surfaces it here. Measured wall time instead (`/usr/bin/time -p
npx oxlint --type-aware --format=json`, two runs each): before
  (package-typescript HEAD, this branch's tree at `f619e951`) 3.38 s /
  2.80 s; after (123–125 together) 2.52 s / 2.51 s. No F2/A1/JS-total
  breakdown could be measured this way.

### Raised by the package-test branch, iteration 28

128. `oxlint --type-aware --debug=timings` (oxlint 1.85.0, this
     repository) prints no timing report in any of text, `--format=json`
     or a one-file run, though `--help` documents the flag and the
     JS-plugin runtime collects the numbers internally. HYPOTHESIS
     (2026-09-24): the flag's aggregation/print side is not wired in this
     release. Settled by reading oxlint's own source at the pinned tag,
     or filing upstream — the toolchain round already tracks its debt.

## Iteration 29 — two signews-api defects (orchestrator, 2026-09-24)

From the signews-api night (its `VISION-signews-api.md`, "What reads
worse" 2 and 5): D20 blocks the cursor split C34 asks for, and a failing
`make fix` prints every `jterrazz(*)` rule twice. C28 × C34 (question 3
of the overnight summary) is left to the owner.

### What the package-test branch did (iteration 29)

- **D20, a carried read** (`fe7e9e8`). A read of `<result>.response`,
  `.json` or `.table('…')` whose value is only CARRIED into a later
  request of the same test owes no comparison: every use of the value,
  through the names (up to four hops) and helpers it passes, ends in the
  arguments of a later awaited chain off a handle — the path, `params`,
  a body, a header. One `expect(…)` of the value makes it a read again,
  and the result the test does claim is still compared whole.
- **D20's cases.** The signews split (`facts/list/pagination.spec.ts`,
  the cursor followed in a test of its own) is the accepted fixture, in
  its helper form (`nextCursor(first.response)`) and its in-place form.
  Red: the accepted case on the old rule (exit 1, and an extra finding
  at the carried read in the refused case); the refused case with the
  binding check forced true (the claimed cursor's read unreported).
- **One printer per finding** (`e9cf1ab`). The checker owns the `test`
  ratchet section and prints its own passes' findings; oxlint's
  diagnostics are the toolchain's Oxlint pass to print. A failing
  ratchet run of the checker now prints the plugin's share as one line,
  `conventions checker: <n> plugin diagnostic(s) judged, printed by
oxlint's own pass`, beside its reasons, which still name each rule
  that broke. Red: the old printer, on the new broken-ratchet case and
  on the updated no-section case (the per-diagnostic line where the
  count line is expected).

#### The contract the toolchain's Oxlint pass needs

With the checker counting the plugin's diagnostics and no longer
printing them, the toolchain's Oxlint pass is their one printer. Today
it prints oxlint's log only when its OWN verdict fails ("only a failing
pass needs the log", `src/cli/oxlint-report.js`), so a run whose
`typescript` section holds and whose `test` section breaks on a
`jterrazz(*)` rule prints the rule and its count and no location.

- **When.** The Oxlint pass prints oxlint's log when its own verdict
  fails OR when the Test Conventions pass's verdict fails — the log
  holds the `jterrazz(*)` diagnostics the member runs judged off the
  same report.
- **What.** The same lines, in the same form, as its own failing log:
  one print of each diagnostic across the whole run. The Test
  Conventions pass prints the checker's output as it comes; it carries
  the `jterrazz-check(*)` findings and one count line for the plugin's.
- **Order.** The Test Conventions pass runs after the report is
  complete, so the Oxlint pass can draw its log once both verdicts are
  known — or draw the `jterrazz(*)` lines alone after the Test
  Conventions pass fails. Which of the two is the toolchain's call.

### Raised by the package-test branch, iteration 29

129. A checker started by hand with no `--oxlint-report` lints the
     project itself and now prints only the count line: in this
     package's own `npm run lint` (`typescript check && node
dist/checker.js`), the `jterrazz(*)` diagnostics behind a broken
     `test` entry are printed by nobody when `typescript check` is
     green. Keep the one-printer rule there too (read them with
     `npx oxlint`), or let a checker that ran oxlint itself print what
     only it saw?
130. D20's carried read follows a value into a later request chain it
     recognises by shape (an awaited chain off a handle that is neither
     a result nor `expect`). A value handed to a request through a
     variable holding the chain (`const next = api.get(…); await next`)
     is not followed, and the rule reports the read, as before — read from
     the code, not proven by a case. Follow it, or keep the shape?

## Iteration 29 — the owner's answers (owner, 2026-09-24)

The four questions of the overnight summary, and 129 and 130 raised above.

- **ADR-009 and ADR-010** (package-typescript) are `Accepted`: every
  type-aware rule decided, nursery included; a spec file's size has one
  judge. package-typescript records them; no code here.
- **Fix mode's nested configs.** Fix mode moves to oxlint's own
  safe/dangerous fix split rather than re-declaring the nested configs
  in the unsafe-fixer wrapper. The toolchain's change, no code here.
- **C28 vs C34.** C34 does not count the lines of a `toMatch(<value>)`
  argument: the gestures of a test are capped at 60 lines, the claim may
  be long, up to C28's 150-line inline cap, which already holds it.
- **The route template** stays written on every chain
  (`.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })`);
  no file-level template. Nothing changes.
- **129.** A checker that ran oxlint itself — no `--oxlint-report`
  given — prints the plugin diagnostics it saw: it is their only printer
  then. Handed a report, it prints the count line only, and oxlint's own
  pass prints each diagnostic.
- **130.** D20 follows a request chain held in a variable
  (`const next = api.get(…); await next`).

### What the package-test branch did (the owner's answers)

- **C34 counts gestures** (`de31d106`). The rule subtracts the lines a
  `toMatch(<value>)` argument holds past the line it opens on; the
  message reads "a test body of <n> lines of gestures, over 60", and
  adds that the lines of a `toMatch(<value>)` argument are not counted. Cases: 20
  gestures and a 90-line inline expectation pass (a rule-tester case
  and a new literate document, `fixtures/claim/`); 60 gestures beside a
  90-line claim pass; 61 gestures fail. Red: counting the claim again
  failed 5 of 16, undercounting by one failed 8 of 16.
- **129** (`5d690a84`). With no report, the checker prints each plugin
  diagnostic on its own report line; with one, the count line. The case
  runs the checker over a fixture whose `node_modules/.bin/oxlint` is a
  stub printing a JSON report (a `.gitignore` negation keeps it
  tracked). Red: the previous printer (the count line where the
  diagnostic is expected); printing in full whatever the source (the
  two `--oxlint-report` cases).
- **130** (`ace65760`). A chain held whole in a declarator is a request
  when the test awaits that name after it; held and never awaited, the
  read stays a read. The carry analysis moved to `lint/carried.ts` (the
  rule file was at the 300-line cap). Red: the previous rule (the
  accepting rule-tester case and the accepting document, 2 of 15); the
  awaited-later check forced true (the never-awaited case, 1 of 15).
- **Gates.** `make fix` then `make check` exit 0 after each commit
  (2372 tests passed, 1 skipped, on the last).

## Iteration 30 — the shared pool has a name (owner, 2026-09-24)

The specs root holds only its facets and ONE more folder, `specs/shared/`,
which holds the shared ground: `specs/shared/{fixtures,seeds,requests,expected}/`.
A path leaves its leaf only to reach `specs/shared/<role>/` (C15); a pool
entry one leaf uses moves beside it (C14, now C28's level half); identical
copies across leaves move to `specs/shared/<role>/` (C27); C24 judges the
role folder under `shared/`. `shared` is a reserved name under `specs/` (C1:
no facet or domain named `shared`). The mover and the fixers move
`specs/<role>/` → `specs/shared/<role>/` and rewrite every path; leaves keep
their ground beside them (`./seeds/`…). The toolchain allows the name
`shared` (package-typescript `1bbb661`, installed here with `npm ci`).

### What the package-test branch did (iteration 30)

- **The drift line** (`611109f9`). `typescript check` printed
  `jterrazz.baseline.json › test 78` where the checker held 76: the drift
  block sums the section as recorded, the held line what the run found.
  `jterrazz/c34-test-body-size` stood at 3 against the 2 found since C34
  stopped counting a `toMatch(<value>)` argument, and was re-recorded;
  `routes/unreached` (1) is the run's key, which the checker never counts,
  so the two lines now read 77 and 76 by design.
- **A path after a template hole** (`17f73568`). The fixers' literal scan
  lost its place at a template holding `${…}`, and the paths written after
  it were never rewritten; it now reads with `literalSpans`. Red: a C27 fix
  over such a spec (exit 1, C8 at the path the move left behind).
- **The shared ground** (`577a150e`). `SHARED_GROUND` in
  `src/model/chain/ground.ts`; C9, C15, C27, C28 and C29 read and write
  `specs/shared/<role>/`, and the walks prune `specs/shared/` whole. A role
  folder at the specs root is refused as a folder (C15), and `--fix` moves
  its entries under `shared/` and rewrites every source literal and document
  key of the specs tree that named one. This package's own tree moved with
  that fixer. Red on each of: the pool read at the root, the fixer off, the
  folder finding off, C15's pools at the root, C27's target at the root,
  C29's lift at the root, `shared/` kept when emptied, `shared/` not pruned,
  C24's old message.
- **The mover** (`1d6ce990`). A 16 `<specs>/_fixtures/` goes straight to
  `<specs>/shared/fixtures/`, `$FIXTURES/` climbs there, and C13 names that
  rename. Red: the pool renamed in place; `$FIXTURES/` climbing to the root;
  the old rename named.
- **C1 reserves `shared`** (`7933db45`). A spec or specification under
  `specs/shared/` is refused in every mode; a domain named `shared` under
  `facet-domain` and `facet`. Ground under `shared/` keeps its module tests.
  Red: each check off, and the facet check skipped under `off`.
- **The history** (`23be665a`). Ten lines of earlier iterations spelled
  the old pool as backticked paths the Markdown pass holds to the disk;
  they name it with the `<specs>` placeholder now.
- **Gates.** `make fix` then `make check` exit 0 after each commit (2382
  tests passed, 1 skipped, on the last); `npm run build` exit 0.

### Raised by the package-test branch, iteration 30

131. C30 files `GET /shared` under `<specs>/api/shared/get/`, and C1 now
     refuses a domain named `shared`: a product with a `/shared` route has
     no legal folder for its spec. Keep the domain reservation (and let C30
     derive another name for that segment), or reserve `shared` at the
     facet level only?
132. The root-ground fixer rewrites the relative literals of the specs
     tree. It does not reach a module test outside `specs/` that names the
     pool (`lint/checker-member.test.ts` here), nor a path spelled from the
     project root inside a string (`command: 'node specs/fixtures/…'` in
     three website specifications): both were moved by hand here, and C8
     does not see either. Extend the fixer to the member's module tests and
     to `specs/<role>/` spelled from the root, or leave them to the author?
133. The capability matrix counts a file by a literal probe, by design: its
     `.toMatch(directory(` misses a call the formatter splits after the
     paren, and two cli files left the count (5 → 3) when their paths grew
     by `shared/`. Accept the undercount, or let the probe ignore the
     whitespace a formatter inserts?
134. Both ratchets let a count fall below its entry without a word: the
     `typescript` section held 1293 against 1396 recorded on the same run.
     Keep the slack (the entry is a ceiling), or fail a count below its
     entry the way an entry at zero fails?

## Iteration 31 — the calls on 131–134 (orchestrator, 2026-09-24)

- **131.** `shared` is reserved only DIRECTLY under `specs/`, beside the
  facets; a domain named `shared` deeper (`<specs>/api/shared/get/` for a
  `/shared` route) is legal.
- **132.** The path fixers and C8 reach every test that stands on a file,
  module tests outside `specs/` included; a shell command naming a path
  (`node specs/fixtures/…`) stays the author's.
- **133.** The capability matrix counts calls from the AST, not a literal
  string match.
- **134.** A ratchet is exact in both packages: a count BELOW its entry is a
  finding ("the debt fell — re-record"), like an entry at zero, and
  `make fix` re-records it — package-test for the `test` section,
  package-typescript for the `typescript` one.

### What the package-test branch did (iteration 31)

- **131** (`cb72c1fb`). C1 drops its domain check: a spec under
  `specs/shared/` is still refused in every mode, and a folder named
  `shared` below a facet is the author's. Red: the domain check restored
  (4 of 46 — three accepting rule-tester cases and the accepting document).
- **132** (`f36b282b`). Every fixer that moves ground — C15's root ground,
  C27, C28's level half, C29's lift, the mover's renames — rewrites the
  relative literals of the member's module tests that named the moved entry
  (one walk of them, `lint/module-tests.ts`). C8 reads a path a test
  resolves from its own directory with one `./`/`../` literal —
  `resolve`/`join` from `import.meta.dirname` or `__dirname`, `new URL('…',
import.meta.url)` — for existence; a bare literal and a command string are
  not read. Red: the helper a no-op, each call site removed, each anchored
  form off, the walk entering `specs/`, ground or a nested package.
- **C8's first finding.** `src/model/result/result.test.ts` resolved its CLI
  two levels above the repository since `89782e41` moved the file; fixed in
  the same commit.
- **133** (`b105ff64`). A call probe keeps its spelling and is read as a
  shape in a closed grammar (`lint/matrix-calls.ts`): the callee (bare, a
  method on any object, on one identifier), the first argument (a call of a
  name, a string and its opening, an object, an array), a leading `))`. Each
  file is parsed once; a type assertion around an argument is transparent.
  Keys, accessors, extensions and tokens stay literal. The matrix moved one
  cell: `toMatch(directory())`·cli 3 → 5. Red: the literal match back, and
  each part of the shape ignored in turn.
- **134** (`29414cfe`). `judge` breaks on a count below its entry; the
  ratchet run under `--fix` lowers every entry that fell and drops one at
  zero (`lint/ratchet-fix.ts`), never raising one nor adding a key, names
  each, then judges. `routes/unreached` is judged by the run that counts
  it: the api teardown now fails a run whose unreached count is below the
  entry, and `TEST_UPDATE=1` records it; the checker keeps leaving the key
  alone, so `make fix` does not re-record it. This package's `test` section
  was exact already. Red: the slack back, the fix raising, the fix not
  writing, the run's key dropped, the routes' slack back.
- **Gates.** `make fix` then `make check` exit 0 after each commit (2399
  tests passed, 1 skipped, on the last); `npm run build` exit 0.

### Raised by the package-test branch, iteration 31

135. C28's judgement counts the leaves of the specs tree only. A pool entry
     one leaf and a module test both read is moved down to that leaf, and
     the module test's path follows it into a leaf's ground, which nothing
     judges for a module test (C15 reads specs). Count a module test as a
     reader outside every leaf — the entry stays shared — or keep the leaf's
     move?
136. C8's anchored read takes ONE literal after `import.meta.dirname`:
     `resolve(import.meta.dirname, '..', 'specs', 'x')` and a bare segment
     (`resolve(…, 'expected')`, an output folder a test creates, in seven
     cli specs here) are out of reach, by design. Read the joined segments
     when every one is a literal, or keep the one-literal form?
137. An exact `routes/unreached` fails the api run the day a new spec reaches
     a route, until `TEST_UPDATE=1` records it — and `make fix` cannot, since
     no fix runs the suite. Keep the run as the key's one recorder, or let
     `TEST_UPDATE=1` stay the gesture and name it in the checker's green line
     as well?
138. `typescript check` here prints `jterrazz.baseline.json › typescript:
1293 held` against 1396 recorded: once package-typescript's half of 134
     lands, this repository's check fails until its `typescript` section is
     re-recorded — a gesture of that package's release, not of this branch.

## Iteration 32 — the component facet's name, and mobile coverage (owner, 2026-09-24)

- The tree named `component-app` becomes `specs/component/`: the component
  facet's tree, whose own shape is a component and its test side by side
  (A2/I2 unchanged). Chapters, vitest project, C1 and every rule that names it
  follow.
- Mobile gets a tree under `specs/mobile/`, run two ways by the SAME specs:
  (A) in `make check`, against a WebDriver-protocol double of Appium (a
  small server answering like Appium from a screen described as data) —
  every mobile capability cell covered, the M1 exemption and the 17 matrix
  exemptions go; (B) `make test-mobile`, outside CI, against a real iOS
  simulator and a small test app on this machine (Xcode present) — the
  real-device proof before a release or when the adapter changes. A macOS
  CI runner (C) only later, if B finds gaps A misses.

### What the package-test branch did (iteration 32)

- **The rename** (`37d5fc63`). `git mv`, and every path that named the old
  tree: the `component()` project, the matrix column, M1, chapter 03 (whose
  "the one non-facet folder says so in its name" became false).
- **A declared Appium server, and the double** (`9c3415e3`).
  `specification.mobile({ appium: { url } })` connects instead of spawning,
  and hands the server the device by capabilities (`appium:deviceName`,
  `appium:platformVersion`, `appium:udid` when known) instead of resolving
  and booting it through `simctl`; the handle's `udid` becomes optional.
  The double is a fixture, `specs/shared/fixtures/appium-double/` (the
  specs reach it beside the public entry, F3): the W3C endpoints the
  adapter calls, the predicate subset parsed, `unknown command` for the
  rest. The app is data, `specs/shared/fixtures/specimen-mobile/specimen.ts`.
  Red: the declared server ignored, each capability dropped or unstripped,
  the double drawing everything invisible.
- **Every mobile cell** (`2e7f36dd`). Four journeys — `launch/`,
  `sign-in/`, `notes/`, `drafts/` — declared as mobile's domains; the
  matrix's last mobile exemptions and the M1-only meta-test go. Red, on the
  11 cases: tap, fill, see, scope, scroll-into-view, the backend, the
  projection, the services, the double's `==`, each broken in turn.
- **B** (`a7e1d4d1`). Specimen in SwiftUI (`specimen-mobile/ios/`, one file,
  built with `swiftc` — no Xcode project); `make test-mobile` builds,
  boots the simulator `specimen.ts` names, installs, starts a pinned
  Appium + XCUITest driver under `.artifacts/mobile/`, and runs the
  `mobile` project against it. It ran here: 10 of 11 green, every golden
  identical to the double's; `drafts/scroll` red.
- **The gap B found** (`3af16162`). The adapter's scroll-into-view sent
  `mobile: scroll { toVisible }`, which WebDriverAgent refuses on a SwiftUI
  scroll view; it now sends `mobile: scrollToElement`, and the double
  refuses the old call with the device's message, so `make check` holds
  the gap. `make test-mobile`: 11 of 11, exit 0.
- **Gates.** `make fix` then `make check` exit 0 after each commit (2413
  tests passed, 1 skipped, on the last); `npm run build` exit 0.

### Raised by the package-test branch, iteration 32

139. The Makefile contract is six targets "and no other", held by a
     meta-test; `make test-mobile` is a seventh, so the meta-test now holds
     the six plus it, and a second case proves `check` never reaches it.
     Keep the seventh target, or move the gesture below the six as
     `npm run test:mobile` (like `test:repeat`)?
140. `mobile()` runs its project last (group 3) because "a simulator cannot
     share a machine with itself", yet its files run in parallel, each
     opening a session on the one simulator; this repository passes
     `serial: true`. Make `serial` the mobile project's default?
141. One driver session per FILE, not per run: on the simulator each of the
     7 files paid about 40 s of session start (5 min for 11 cases). A
     session shared across a run's files would cut it — worth a
     `globalSetup`, or is the per-file fresh session the point?
142. `appium: { url }` is a new constructor option name (the one other
     candidate, `server`, already means "the app's server" on api and
     website). Keep the name?

## Iteration 33 — the calls on 139–142 (owner, 2026-09-24)

- **139.** `make test-mobile` stays a seventh target: the toolchain's
  Makefile contract requires the six and does not forbid more, and this
  repository's own meta-test (`lint/makefile.test.ts`, iteration 32) already
  holds it to the six plus the declared extra. No code follows.
- **140.** `mobile()` runs its project files serially BY DEFAULT — one
  simulator, and a second worker would open a second session on it — so
  `fileParallelism: false` moves from something a caller states
  (`mobile({ serial: true })`) to the helper's own default; `serial` no
  longer needs passing, and passing it changes nothing.
- **141.** Noted for later: one driver session shared across a run's files,
  instead of a fresh one per file. No code follows the note.
- **142.** `appium: { url }` keeps its name; `server` stays reserved for
  "the app's server" on api and website. No code follows.

### What the package-test branch did (iteration 33)

- **140** (`8ba05585`). `mobile()` merges `fileParallelism: false` into
  every project it returns, whatever `options.serial` says; the repository's
  own `vitest.config.ts` drops the now-redundant `{ serial: true }`, and
  chapter 03's project table follows. Red: `mobile()` called bare, before
  the change, left `fileParallelism` undefined (`src/runner/projects.test.ts`).
- **Gates.** `make fix` then `make check` exit 0; `npm run build` exit 0.

## Batch of 2026-09-24 (hybrid): typescript

Two reviewed units landed on package-typescript's `vision/17` by
cherry-pick, with no conflicts, then one integrator commit. HEAD `3fcfc96`.
`make fix` exit 0, `make check` exit 0 (141 files, 419 tests).

- **The ratchet's held lines** (`fe1bdd6`, `56c898e`, `d98d530`).
  What it closed: an emptied `typescript` section now reads
  `jterrazz.baseline.json › typescript: nothing held`; Test Conventions
  keeps @jterrazz/test's own `nothing held` line; the root checker run
  passes no `--summary`. Integrator commit `3fcfc96` removed the false claim
  that the phrase mirrors @jterrazz/test (docs/06, check-baseline.js header).
  What stays open:
    - **Owner call.** Should `nothing held` mean the same case in both
      packages? Today typescript prints it for an EMPTIED section and nothing
      for an absent one; @jterrazz/test prints it for an ABSENT section and
      `0 held across 0 rules` for an emptied one (item 2).
    - **Owner call.** The Publish build guard against test material (item 6)
      needs @jterrazz/test to publish `materialAt` / `testPackageOf` on
      `./oxlint`. A copy in typescript would give one fact two owners.
    - **Item 5's premise was false.** The drift block runs only when a
      project has an oxlint config. If the question is wanted, restate it as
      "open the drift gate for projects with no config?".
    - **Optional.** The root-argv stub in `baseline-ownership.spec.ts` works
      only if it runs as CommonJS; it would be sturdier as `checker.cjs`.
- **Rulebook edges and tree gate** (`3216c45`…`54ef4a0`, 7 test
  commits). What it closed: complexity 12, max-lines 300 and
  max-lines-per-function 60 are each pinned on both sides of the cap; the
  size overrides are proven not to reach where they must not; the Makefile
  contract requires six targets and forbids none; the empty-directory walk's
  `.artifacts` and `dist` exclusions each have a case. What stays open:
  `.next`, `.turbo`, `.vite` and `coverage` have no case of their own;
  whether `fix` forwards `--ignore-pattern` in general is unproven; under
  `fix`, the `.artifacts` entry is not load-bearing (the check case proves
  it).

## Batch of 2026-09-24 (hybrid): test

Four reviewed units landed on package-test's `vision/17` by cherry-pick,
over the toolchain installed from package-typescript `3fcfc96` (`npm ci`).
The only conflicts were in the generated `docs/03-testing.md`; chore commit
`c1d694da` regenerates it with `npm run docs`. `make fix` exit 0,
`make check` exit 0 (547 files passed, 1 skipped; 2449 tests passed).

- **Mobile: one Appium session per run** (`abecb03e`). What it closed:
  **141**. Under `mobile()` with a declared `appium: { url }`, the first
  `.open()` records its session in a run ledger. Later files attach to it,
  and the run's global teardown ends it. This supersedes iteration 33's
  "No code follows the note" for 141. What stays open:
    - **Owner call.** A spawned Appium server (no `url`) still opens one
      session per file. Sharing it would need the project to declare the root
      and the device. That is an API decision.
    - A dead recorded session is not recovered: `openSession` attaches without
      a probe, and no `appium:newCommandTimeout` is set. Settle it with a
      timed `make test-mobile`, which also settles docs/09's "seconds" on a
      warm simulator against the 40 s per file measured earlier.
    - The ledger key includes `appium:bundleId`, so two apps on one simulator
      keep two live sessions. docs/09 claims this works, and nothing proves it.
    - Unfixed: builder.ts's `.open()` JSDoc still says "one driver session per
      runner". docs/09 does not state that a global setup serving the Appium
      server must come before `mobile()`'s own setups. The 7-file mobile run
      prints its session count but does not assert it.
- **Checker ground: C28's readers, C8's anchored paths** (`d2cf87d9`…
  `65e1bc80`, 8 commits). What it closed: **135** and **136**. A module
  test counts as a reader of shared ground outside every leaf. C8 and C28
  read a path built from several literal pieces, but not a lone bare piece.
  C28 never writes in place a file a module test names, and its writers
  reuse a file that already holds the same bytes. What stays open:
    - **Owner confirmation.** In
      `specs/lint/c29-one-subject/fixes-a-file-of-two-routes.spec.yaml`,
      the seed now stays in `specs/shared/seeds/`.
    - A fixer that moves ground rewrites only whole relative literals, not a
      path built from pieces, so `--fix` can leave a C8 error. docs/18's "A
      fixer that moves ground rewrites every path that named it" is now false
      for pieces. Either extend `repointModuleTests` or narrow the sentence.
    - No spec pins two things: the relative-literal half of
      `pathsModuleTestsName`, and the folder half of C28's inline exemption.
      The folder half also silences a whole facet, while the pool side
      ignores folders.
    - `test.each` past its cap is unpinned. A spec that fails to parse drops
      all its anchored C8 reads.
- **Subject split and static-rule edges** (`9247f37a`…`be55d63f`,
  5 commits, the branch's fixup folded into the first). What it closed:
  C29 leaves an author's fixtures module alone and splits a website file
  by page. C32 refuses every generic aspect. D20's carry depth is pinned
  on both sides of its boundary, and F2's allow list on a walk through a
  relay. What stays open: the mobile-journey split has no case of its own,
  there is no YAML spec under `specs/lint/d20-whole-result/`, and the
  generated C32 cases carry no name.
- **Chain `with()` headers, and the routes ratchet's recorder**
  (`dc953985`, `b61fea5f`, `74cb963f`). What it closed: `with()` sends its
  headers on every chain it starts, and a chain's own headers win for that
  chain alone. docs/19 now states that a test run under `TEST_UPDATE=1` is
  the only recorder of `routes/unreached`. What stays open: the spec lives
  at `api/echo/create/headers.spec.ts` rather than beside
  `users/create/sending.spec.ts`, and `specs/website/clock/` is untouched.

## Batch 2 of 2026-09-24 (hybrid): typescript

One reviewed unit landed on package-typescript's `vision/17` by
cherry-pick, with no conflicts and no fixups to fold, over @jterrazz/test
installed from package-test `5900b968` (`npm ci`). HEAD `77f2d92`.
`make fix` exit 0, `make check` exit 0 (144 files, 422 tests).

- **Drift for configless projects, nothing held, the unswept members,
  `--ignore-pattern` under fix** (`f3b4186`…`77f2d92`, 5 commits). What it
  closed: a project with no oxlint config of its own now gets a drift
  report, measured against its default profile (`node`), and an absent tool
  is named without a null version. A green check with no `typescript`
  section prints `typescript: nothing held`. `.next`, `.turbo`, `.vite` and
  `coverage` each have an empty-directory walk case. A fix run with
  `--ignore-pattern` is pinned. What stays open:
    - **Owner call.** For an absent section, the Oxlint pass prints
      `nothing held`, the drift row prints `absent`, and `--json` gives
      `baseline: null`. That is two words for one state. Either print
      `nothing held` in the drift row, or state in docs/06 §The drift report
      that `absent` is a separate state on purpose.
    - **Owner call.** In `--json`, a configless project reports
      `profile: "node"`, the same as a config that extends node, so a fleet
      sweep cannot tell them apart. Proposed: a `config: "default" | "own"`
      field, pinned in `drift-default-config.spec.yaml`.
    - The file-level sweep filter in `src/cli/project-files.js`
      (`UNSWEPT.has(segment)`) has no case. The proof covers only the
      empty-directory walk, so Names, Secrets or Markdown could lose the
      filter and stay green.
    - The `--ignore-pattern` spec goes red only at the suppressions rewriter
      and the Names pass. Forwarding at the fixer loop and at the fix-mode
      JSON re-run is redundant, because the target list already drops the
      globbed paths. The spec proves less than the commit title claims:
      narrow the wording, or delete the redundant forwarding.
    - A configless check runs `oxlint --print-config` on `node.js` twice to
      compare it with itself. Resolve it once.
    - If the Names pass dies before it writes `names.json`, the absent-section
      path still prints `nothing held`. The present-section path has the same
      gap: print no held line when the Names report cannot be read.

## Batch 2 of 2026-09-24 (hybrid): test

Three reviewed units landed on package-test's `vision/17` by cherry-pick,
over the toolchain installed from package-typescript `77f2d92` (`npm ci`).
Every conflict was in a generated file (`docs/03-testing.md`,
`jterrazz.baseline.json`) except one: `specs/api/intercepts.specification.ts`,
whose inline app the capability filing moved to
`specs/shared/fixtures/specimen-api-outbound/app.ts`. Keeping one side of
chapter 03 whole dropped the filing's prose, and `ed29775` restores it.
Integrator commits: `382bae0` re-files the two specs and the fixture the
other units added, and `9f3ce1f` regenerates chapter 03 and re-records the
ratchet. `make fix` exit 0, `make check` exit 0 (555 files, 2496 tests).

- **Non-JSON bodies, and a cancelled intercepted body** (`b02a59e`,
  `ef9263d`). What it closed: an HTML or event-stream response is read and
  compared as its text (`specs/api/response/bodies.spec.ts`). Signews
  defect 4 is closed too: under node, `response.body.cancel()` on a reply
  that `intercept()` served now settles, because the seam hands the body
  back as a stream this package owns. `specs/api/intercept/body-cancel.spec.ts`
  runs, and chapter 16's M3 escape is gone. What stays open:
    - `src/model/contracts/intercept.ts` still calls the origin wrapper "the
      one place `fetch` is wrapped", but `src/seams/msw/server.ts` now wraps
      it too.
    - ADR-006 (Proposed) still says the cancel repro is skipped and that M3
      sanctions a suppression. Amend it to state the present.
    - A mismatched text body prints as one JSON-escaped line
      (`formatResponseDiff`). Diff it line by line and add a test.
    - `readBody` ignores content-type. A `text/plain` body `42`, `true` or
      `null` parses to a JSON value, and a binary body decodes to
      replacement characters where it used to be `null`. docs/10 states
      neither case.
    - docs/10 says a text body has its "blank lines" trimmed, but `trim()`
      drops all surrounding whitespace. docs/16 says "every reply", but only
      replies to `fetch` are owned, not replies over `node:http`.
    - The browser worker is not wrapped, and no test proves that a
      passthrough cancel settles (both HYPOTHESIS).
- **`make fix` order, the mobile shared server, the published readers,
  `nothing held`** (`078a86a`…`ec48abd`, 10 commits). What it closed:
  `--fix` applies the plugin's own autofixes (B16w, C31, D28) before the
  ratchet counts, so one `make fix` settles them (Signews defect 3). A
  green run over an emptied `test` section prints `nothing held`.
  `materialAt` and `testPackageOf` are published on `./oxlint`, which
  answers the typescript batch's owner call. A `mobile({ device })`
  project shares one spawned Appium server and session per run, and a spec
  that names another device is refused. What stays open:
    - The own-fixes wrapper drops `extends`, so a root config that arms the
      plugin through `extends` (cap01's web app) gets no fixes, silently.
      Nested-config subtrees are ignored by the pass but counted by the
      ratchet, so they settle only on the second `make fix`. docs/19:522
      states neither.
    - The C27 and C15 rows in `lint/manifest.ts` still say "every path"
      is rewritten. That file is hand-authored, not generated output, so
      edit the rows and run `npm run docs`.
    - `runDevice` compares `os` strictly, so `'iOS 26.5'` and `'26.5'`
      refuse each other, although the simulator matcher treats them as the
      same runtime.
    - A `test` section that holds only `routes/unreached` prints `nothing
held`.
    - **Owner call.** `device` is still required in
      `MobileSpecificationOptions`, so each spec restates the project's
      device, which gives one fact two owners. Decide whether to make it
      optional when the run serves the session.
    - **Toolchain owner.** The oxlint config-name list is duplicated from
      package-typescript's `oxlint-config-names.json`, which that package
      does not export.
    - One possible orphan-process flake was seen once and not reproduced
      (HYPOTHESIS).
- **A spec is filed by what it specifies** (iteration 34, `8228d20`…`6ddd18c`,
  6 commits). What it closed: C1 refuses a first-level folder that holds no
  test. C30 files a method-less route under its segments. The fixture apps
  are specimens (`specs/shared/fixtures/specimen-<facet>…`), a spec of a
  specimen is no subject for C29 or C30, and C35 files it under a
  capability of the matrix. The domain vocabulary file is retired. What stays open:
    - With the domain vocabulary retired, nothing guards integration's folder names:
      `integration/intercepts/` sits beside `api/intercept/` and
      `jobs/intercept/`. Rename it.
    - `api/initiation-errors/` is neither a capability nor a route,
      and C35 misses it because its runners are built inline. Together with
      the VISION-pinned `api/echo/create/headers.spec.ts`, it
      contradicts docs/03's "every spec here". Move it, or name both
      exceptions in docs/03.
    - `capabilityFolders()` ignores each row's `columns`, so
      `cli/appium/` passes although `appium` is a mobile row.
    - Specimen detection counts `root:` as a runner's app, so
      `integration.specification.ts` passing `root: '../shared/fixtures/specimen-api'`
      reads as reaching the specimen.
    - C1's stray-folder clause exempts a `.specification.ts` in `support/`
      and a whole folder for one `.test.ts`, and no `.spec.yaml` document
      proves its message end to end.
    - `mobile-app` is not renamed `specimen-mobile`, because this page
      names its path. `params` is not a matrix row. `headers.spec.ts` moves
      to `api/headers/` once this page is folded.
    - Commit `f46408f` landed on the unit branch while `make check` exited 2
      (Docker specs under load). Later commits ran the full check green.

## Batch 2 of 2026-09-24 (hybrid): typescript, the publish guard

No unit landed on package-typescript's `vision/17` in this pass. @jterrazz/test
was reinstalled from package-test `0aa5a546` (`npm ci`). HEAD stays
`77f2d92`. `make fix` exit 0, `make check` exit 0 (144 files, 422 tests).

- **The Publish build guard against test material** (branch
  `vision17-typescript-publish-guard`, `943b504`…`927d5a7`, 6 commits).
  Skipped, because its review came back `fix-first` after one round. What
  it would close: the Publish pass builds the package and refuses a build
  compiled from test material, and a failed build becomes a
  `publish-build` finding while the pass carries on to publint. The
  worktree `ptc-publish-guard` and the branch are kept for the fix round.
  What stays open:
    - **Major.** Nothing proves the `publish-build` verdict fails the pass.
      The fixture of `publish-broken-build.spec.yaml` also fails
      `publish-files` and publint. When `failed = true` is removed at
      `src/cli/check-publish.js:147`, the spec stays green. Add a
      `publish-broken-build-alone` document whose only Publish output is
      the `publish-build` line with exit 1, and check that it goes red.
    - `isPacked` ignores negated `files` entries. On package-test it judges
      `dist/catalog.js` and `dist/coverage.js`, which npm leaves out. Give
      it npm's negation semantics with a module case, or state the limit at
      docs/06:311.
    - **Owner call.** The guard does not exempt the same test packages as
      F2. The guard exempts any test package declared in `dependencies` or
      `peerDependencies`. F2 exempts only `test.production.allow`. Either
      read the allowance from @jterrazz/test (`allowedTestPackagesAt`,
      published on `./oxlint`), or have docs/06:315 state that the two
      rules differ.
    - The opening sentence of docs/06:287 ("invisible in the repository and
      fatal in the registry") is false for the two new rules. Reword it.
    - When no reader loads (a resolved @jterrazz/test older than 17), the
      guard is skipped with no output line. State the version condition in
      the docs/06:26 row, and optionally print a note.
    - A config's own tsdown `hooks` still run during the guard's build.
      This is documented at docs/06:308. None of the estate's five
      own-config packages declares hooks today.
    - **Owner call, carried from the unit.** Keep the toolchain-name
      fallback for the reader, or replace it with a chain that links
      `node_modules` (C18 debt 22 against 21).

## Batch 3 of 2026-09-24 (hybrid): typescript

One unit landed on package-typescript's `vision/17`, by cherry-pick with no
conflict. @jterrazz/test was reinstalled from package-test `8b57b457`
(`npm ci`). HEAD is now `0a024e8`. `make fix` exit 0, `make check` exit 0
(149 files, 440 tests).

- **The Publish build guard, fix round** (branch
  `vision17-typescript-publish-guard`, `e72deab`…`0a024e8`, 13 commits).
  Its review came back `integrate`. The worktree `ptc-publish-guard` and the
  branch are removed. What it closed:
    - The Publish pass builds the package and refuses a build compiled from
      test material. A failed build is a `publish-build` finding, and that
      finding alone fails the pass (`publish/broken-build-alone`, shown red).
    - The build runs without a reader and fails the pass all the same
      (`publish-build-unresolved.spec.yaml`). A package with no build hears
      nothing.
    - The reader of test material comes only from the @jterrazz/test the
      package resolves. The toolchain fallback is gone, which settles the
      carried owner call. With no reader, the pass prints
      `publish-test-material: nothing to judge` and names the reason:
      `absent`, `readerless` or `unloadable`. In a workspace it also names
      the member.
    - The guard judges only the chunks `files` ships. It builds the entries
      the `exports` map earns, and names chunks as `typescript bundle`
      writes them (the `.mjs` hypothesis was checked and is false). Its
      build turns off the config's `copy`, `exe` and `onSuccess`.
- What stays open:
    - **C18 debt 22.** `cli/check/publish-guard.spec.ts` stays a raw
      chain. Paying it off needs a `.link()` or install setup verb in
      @jterrazz/test's `CliSpecification`, and that is a backlog row for
      this package. docs/03:88 names only the rulebook third door, and
      docs/03:85 says "link" where two cases write a stub install.
    - Unproved branches (a mutation stays green): the `src/index.ts`
      fallback of `buildOf` (publish-material.js:121-123, which covers
      string `exports` or `main`-only packages), the `dynamicImports` half
      of externals (:158), and the `!existsSync(entry)` readerless guard
      (:85).
    - **Owner call.** There is one build definition. The guard prefers a
      package's own `tsdown.config.*`, but `typescript bundle` always passes
      the preset, and the entry rule is written twice (bin/typescript.sh:76-86
      and `buildOf`). docs/06:306 "builds the package as it builds" is false
      for an own-config package. No estate package has one today.
    - The Publish pass is now a writer (check.sh:958), so a green run
      prints whatever check-publish writes: config hooks, and side effects
      of importing `./oxlint`. Give the nothing-to-judge note its own
      channel.
    - skills/jterrazz-typescript/SKILL.md:37 does not name `publish-build`.
    - Rule lines in a workspace still print a member-relative path. Only
      the nothing-to-judge note names the member.
    - Carried from batch 2: `isPacked` ignores negated `files` entries, the
      opening sentence of docs/06:287 is false for the two new rules, the
      guard's exemption (any test package in `dependencies` or
      `peerDependencies`) still differs from F2's `test.production.allow`
      (**owner call**), and a config's tsdown `hooks` still run.
- **Drift words and JSON, the config-name export, the proofs and perf**
  (branch `vision17-typescript-drift-and-names`, `f9ea4cd`…`978fa47`,
  12 commits). Skipped, because its review came back `fix-first` after one
  round. The worktree `ptc-drift-and-names` and the branch are kept. It
  would close the test section's **Toolchain owner** row: `1eb6900`
  publishes the oxlint config-name list as a subpath. Strike that row once
  the unit lands. What stays open for its fix round:
    - **Major.** docs/03-testing.md:23 does not name the `node` spawn of
      `src/cli/check-baseline.test.ts`.
    - **Major.** The two new cases in `specs/cli/check/drift.spec.ts:241-280`
      run `check-drift.js` directly, which is hidden C18 debt. Move them
      into a new `src/cli/check-drift.test.ts`.
    - **Major.** Nothing proves the JSON contract at docs/06:337 (an absent
      section reads `null`, an emptied one reads `0`). Add a
      `{ "typescript": {} }` `--json` case and show it red.
    - No test proves that the unreadable case drops the human `test` row.
    - `typescript baseline` refusing when the Names pass writes no report
      is proved only by the module test. Add a spec document on
      `names-refused` that pins exit 1 and the untouched baseline.
    - The judge's `oxlint wrote no JSON report` message keeps its wording.
      That was a choice the unit documented.

## Batch 3 of 2026-09-24 (hybrid): test

Three reviewed units landed on package-test's `vision/17` by cherry-pick,
in the listed order, with no merge commit. The toolchain was reinstalled
from package-typescript `0a024e8` (`npm ci`; better-sqlite3 loaded with no
rebuild). The last commit before this record is `42ebeadd`. `make fix` exit 0,
`make check` exit 0 (558 files, 2543 tests).

How the conflicts were settled:

- The generated blocks of docs/03 (layer counts, matrix, meta-tests)
  conflicted four times. Each took the HEAD side, and `42ebeadd`
  regenerated them with `npm run docs`. The prose of both sides is kept.
  One resolution first took the whole file and lost the appium sentence
  of `0bc88de6`; `8146284c` brings it back, so only that one commit reads
  without it.
- `src/runner/route-coverage.ts` kept both sides: the failed-run guard
  (`RouteRun`) and the method-less drift check. The filing unit's tests
  called `judgeRoutes` with a boolean. They now pass `GREEN` or
  `RECORDING`, inside `e294f1dc` and `1affbb86`.
- The filing unit renamed `integration/intercepts/` to
  `integration/intercept/`. The bodies unit's new
  `passthrough-cancel.spec.ts` moved with it, and docs/16's path to it was
  updated in `8146284c`.
- The oxlint config-name list is not exported by the installed toolchain
  (`0a024e8` has no `./oxlint-config-names` subpath), so the `CONFIG_NAMES`
  copy in `lint/ratchet-own-fixes.ts` stays. It matches the toolchain's
  `oxlint-config-names.json` today. Swap it once the typescript
  drift-and-names unit lands.
- This batch rewrapped two lines of the typescript batches above. oxfmt
  un-indented a line that started with `{}`, and the Markdown pass held a
  typescript spec path to this repository's disk.

The units:

- **api-bodies follow-ups** (branch `vision17-test-bodies-followups`,
  `eee66bea`…`6f876c41`, 14 commits). Review `integrate`. What it closed:
  a response body is read by its content-type, and only a type known to be
  binary drops its body. A mismatched text body is diffed line by line. A
  golden with no content-type reads its body by the reply's. A failed run
  is not judged (`api routes: not judged`), and `TEST_UPDATE=1` refuses to
  record `routes/unreached` over it. A cancel settles on a reply that
  passes through to a real server, and in a page. ADR-006 says the cancel
  repro runs. What stays open:
    - The bodyKind table at docs/10-api.md:169 is only partly pinned. Three
      mutations stay green: dropping `+xml`, dropping
      `application/x-ndjson`, and dropping `.toLowerCase()`
      (http-file.ts:108-143). Add one table-driven case and show it red.
    - The live input of the failed-run guard
      (`getFailedFilepaths().length`, route-coverage.ts) has no test. That
      it counts correctly is a HYPOTHESIS, backed by a reviewer probe. A
      guard needs a nested-vitest harness, which the repo does not have.
    - A filtered run still records a false ratchet:
      `TEST_UPDATE=1 vitest run --project api <one file>` recorded 12
      unreached. **Owner call:** refuse to record over a filtered run, and
      say so at docs/10-api.md:297.
    - `specs/component/intercept/quote-status.test.tsx` proves how the browser
      behaves, and guards no package code. docs/16's "the proof" could say
      so.
    - `hono.adapter.test.ts:84` is titled "neither text nor binary", but
      its YAML input is now a named text type. Rename it, or test YAML with
      a body that would parse as JSON.
    - ADR-006:195-208 still counts the gone repro's directive in its 66/15
      figures, and line 201 is unwrapped.
- **Runtime-and-surface follow-ups** (branch
  `vision17-test-runtime-followups`, `9ec9d721`…`8c9d6ccb`, 10 commits).
  Review `integrate`. What it closed: a spec's os agrees with the run's,
  and a spec leaves its device to `mobile({ device })`. The own-fixes pass
  keeps a plugin the root arms through `extends`, and one `make fix`
  settles a subtree under a nested oxlint config. It stops on a config
  oxlint could not load, reads a JSON config as oxlint does, and resolves
  an extended JSON's override plugins from its folder. The C27 and C15
  rows say their fixers rewrite whole relative literals. The green line
  counts `routes/unreached` as held. What stays open:
    - The JSONC reader's escape branch (ratchet-own-fixes.ts:245) is
      unpinned: `end += 1` stays green. Add a string with an escaped quote
      followed by `//`.
    - The C27 warning (`copyAdvice`, checker-crossfile.ts:1370) still says
      `make fix` rewrites "every path that named a copy", and so does the
      comment at checker-subject.ts:692. Narrow both to whole relative
      literals.
    - **Product defect, open.** The run's Appium server is spawned
      `detached` (serve.adapter.ts:124). It and every ServeAdapter child
      outlive a SIGKILLed vitest. Only the fixture's stand-in was fixed.
      The runner's mobile setup needs a parent watchdog.
    - The green line's "N held across M rules" now counts
      `routes/unreached` as a rule. **Owner call:** keep it, or print
      "entries". Check whether package-typescript parses the line.
    - The case "the wrapper carries `extends`…" pins a string `extends` in
      a JS config, which oxlint 1.85 refuses. Rewrite it over a JSON root.
- **Capability filing follow-ups** (branch
  `vision17-test-filing-followups`, `d2a45edb`…`50e60f44`, 14 commits).
  Review `integrate`. What it closed, which covers most of Batch 2's
  filing list: the mobile specimen is `specimen-mobile`, and `params` is a
  matrix row. C1 refuses a runner parked in a folder with no test. C35
  files a spec under its own facet's column. A specimen is what a server
  command runs, so `initiation-errors` moved to `api/services/`.
  integration's folders are guarded, and `intercepts/` is `intercept/`.
  The `with()` headers spec is under `api/headers/`. The run holds
  `test: { methodless }` to the app's route table, by the route's shape.
  The session spec's env leak under `make test-mobile` is fixed. What stays
  open:
    - Batch 2's filing bullets and its headers line are still worded as
      open. The commits above close them. Their `specs/` prefixes were
      stripped to quiet the Markdown pass, and that workaround can go once
      the bullets are folded.
    - Nothing pins the rule that the method-less list is judged against
      the app's own table and not against the OpenAPI one
      (route-coverage.ts:108). Two mutations stay green. Add the two cases
      the review names.
    - docs/18-conventions.md:181 says the list "cannot drift from the app".
      That is false for an app known only by its OpenAPI document.
    - `RUNS_A_COMMAND` (lint/specimen.ts:52) misses the shorthand
      `server: { command }` that its own rule prose writes.
    - Two specimen guards are unpinned: the `;` boundary in `constHolding`
      and the `command` test in `runsAServerCommand`.
    - `specs/shared/fixtures/orders/` is now a specimen. It is not named
      `specimen-*`, and docs/03's pool sentence does not list it. Any
      import of the shared fixtures counts for an integration spec. This
      needs an **owner call** on the name.
    - Out of the unit's area, but needed: `src/model/routes/routes.ts`,
      `src/settings.ts` and docs/10-api.md.
    - `make test-mobile` on a real simulator was not run (HYPOTHESIS).

The three worktrees (`pt-bodies-followups`, `pt-runtime-followups`,
`pt-filing-followups`) and their branches are removed.

## Speed batch of 2026-09-24: typescript

One unit landed on package-typescript's `vision/17`, by cherry-pick with no
conflict. @jterrazz/test was reinstalled from package-test `2d54d941`
(`npm ci`). HEAD is now `7fc5dcd`. `make fix` exit 0, `make check` exit 0
(154 files, 452 tests).

- **Drift words and JSON, the config-name export** (branch
  `vision17-typescript-drift-and-names`, `4f3b834`…`b4e1e6b`, 19 commits,
  plus `7fc5dcd`). Its review came back `integrate`. The worktree
  `ptc-drift-and-names` and the branch are removed. It closes batch 3's
  fix-first list: the two direct `check-drift.js` cases are the module's
  own tests (`src/cli/check-drift.test.ts`), the JSON contract (absent
  `null`, emptied `0`) and the dropped human `test` row are pinned, and
  `baseline-record-names-refused.spec.yaml` pins the product command's
  refusal. `6b5fd94` publishes the oxlint config-name list as the subpath
  `@jterrazz/typescript/oxlint-config-names`, so the test section's
  **Toolchain owner** row can be struck.

    `7fc5dcd` repairs docs/03's unit row and spawn list from the review.
    It also carries three batch-3 items: `f3a33a6` (the sweep drops a
    tracked file under an unswept build folder) and `b955029`, `95bb352`
    (the ignore-pattern documents). What stays open:
    - The CONFIG_NAMES swap in this package (lint/checker-cli.ts,
      lint/checker-member.ts, lint/ratchet-own-fixes.ts): import the new
      subpath once a @jterrazz/typescript carrying `6b5fd94` is installable.
    - docs/06-quality-checks.md:361 does not match check-drift.js for the
      test section: an absent section prints no row (not `nothing held`),
      and for an unreadable file `--json` marks the test section unreadable
      while the human block prints no test row. **Owner call:** rescope
      the sentence, or print `test  unreadable` and flip `ba54b7e`.
    - No timeout on `oxlint --print-config` (check-drift.js:67) or on the
      spawnSync calls in `src/cli/check-drift.test.ts`. A stall in
      `os.tmpdir()` would hang the unit project, which runs first.

- **A spec runs only the pass it specifies; shared sandbox template and temp
  dir** (branch `vision17-typescript-toolchain-spec-speed`, 12 commits).
  Skipped, because its review came back `fix-first` after one round. The
  worktree `ptc-toolchain-spec-speed` and the branch are kept. What stays
  open for its fix round:
    - **Major.** docs/02-developing.md:202 and :204 state as laws what
      holds only for some chains: eight chain files and about 69 goldens
      still run every pass, and 22 sites (13 cli chain, 4 unit, 2 in
      drift.spec.ts) still call `tmpdir()` directly. The report's notDone
      does not say so.
    - The Names pass running under the ratchet's held line with only
      `oxlint` selected (check.sh:500) has no spec. Add an
      `onlyPasses('oxlint')` case on `FOUR_TARGETS` and show it red.
    - Three new goldens (`passes-*.spec.yaml`) and a re-recorded
      `jterrazz.baseline.json` land outside the unit's area. Move them into
      a `.spec.ts` chain or state them as cross-unit touches, and correct
      the report.
    - Item 4 (split or concurrent long files) was not done, item 5 (the
      install-matrix cache) was declined for the reason in `69c1e21`, and
      the cli project measured about 590 → 470 s CPU with the wall time
      flat at about 74 s. The selector bought CPU, not wall time. Say so in
      the report.
    - Now that drift-and-names has landed, rebase the branch on
      `vision/17`: `drift.spec.ts` lost two cases to
      `src/cli/check-drift.test.ts`, and the baseline file may re-record.

## Speed batch of 2026-09-24: test

No unit landed: both reviews came back `fix-first` after one round, so
neither branch was cherry-picked. Their worktrees and branches are kept.
The toolchain was reinstalled from package-typescript `7fc5dcd` (`npm ci`
there and here). `make fix` exit 0, `make check` exit 0 (558 files, 2549
tests).

- **The config-name swap** (`340a0909`). `lint/ratchet-own-fixes.ts`
  imports `@jterrazz/typescript/oxlint-config-names`, bundled inline into
  `dist/checker.js`. Its fix test runs once per listed name, so a
  narrowed list is red. This closes the **Toolchain owner** row for that
  file. The lists in `lint/checker-cli.ts` and `lint/checker-member.ts`
  name vitest configs, not oxlint's, so they were never copies of it.
- `c450aa6c` splits the typescript batch's 14-line drift bullet, which
  failed the Markdown pass at HEAD.
- **Declared services once per run, fast postgres, pinned slim images**
  (branch `vision17-test-service-containers`, worktree
  `pt-service-containers`). Skipped, `fix-first`. What stays open:
    - **Major.** Two `redis()` services in one record share one container
      and one index, so one's `reset()` wipes the other's keys
      (`RunContainers.keyOf`, run-containers.ts:37). Keep a two-redis
      spec, red on HEAD, and a redis sentence at docs/17-services.md:140.
    - **Major.** Nothing proves a worker reaches the run's container: the
      mutation `new ServiceContainer(request, async () => undefined)`
      (src/index.ts:122) stays green. Add a spec asserting the handle's
      port is the run container's.
    - The failure log window (orchestrator.ts:123, :146) drops a fresh
      container's boot lines. Take `since` before Phase 1.
    - docs/17-services.md:150 asserts the reaper guarantee the open leak
      question doubts. The redis capacity is 254 workers, not 255
      (redis.ts:97-100, docs/17:163).
    - The load-matched after-run (`scratchpad/sc-after/run.sh`, load1 < 6)
      and the leak's root cause are not done. The leak question needs a
      follow-ups page, which is the maintainer's to create.
- **Dedicated temp root, per-worker browser, preset speed knobs, build
  cache** (branch `vision17-test-runner-browser-temp`, worktree
  `pt-runner-browser-temp`). Skipped, `fix-first`. What stays open:
    - **Major.** `make test SHARD=4/4` exits 2: the route ratchet
      (route-coverage.ts:158-164) judges one shard's partial ledger, and
      `test-merge` judges no routes. Make a shard skip the judgement and
      let the merge judge it, or pull SHARD out of Makefile, AGENTS.md:45,
      docs/02:20 and docs/03:516.
    - **Major.** Brief items 3 (the component flake under `--coverage`),
      8 (in-process checker specs) and 9 (CONFIG_NAMES, now closed by
      `340a0909`) are neither done nor in its notDone.
    - The temp-root timing compares against its own a6147881, not
      `vision/17`. The browser singleton has no measured gain.
    - `npm run docs` and `coverage` bypass the clean dist and telemetry
      opt-out that `make build` has, which docs/02:28-30 claims for both.
    - The per-test removal and the evidence relocation lack a caller
      spec. A shared `/tmp` gives a second user EACCES
      (temp-root.ts:53-58, :80-83). `packageManager` ships in the
      published package.json:165.
    - About 540k `spec-command-*` entries leaked into the system TMPDIR
      await a one-off removal by the owner.

## Speed fix round of 2026-09-25: typescript

One unit landed on package-typescript's `vision/17` by cherry-pick, with no
conflict. @jterrazz/test was reinstalled from package-test `ca9b1445`
(`npm ci`). HEAD is now `cc9c3a4`. `make fix` exit 0, `make check` exit 0
(157 files, 458 tests).

- **A spec runs only the pass it specifies, and the temp root** (branch
  `vision17-typescript-toolchain-spec-speed`, `080721e`…`e8e32ea`, 13
  commits). Its review came back `integrate`. Two commits were folded out:
  the shared-template commit and its revert cancel exactly, so neither
  landed. `cc9c3a4` narrows docs/02-developing.md:202 from the review: the
  three `passes-*.spec.yaml` goldens are the spec documents that name
  passes. The worktree `ptc-toolchain-spec-speed` and the branch are
  removed. What stays open:
    - Item 4 (splitting the long serial files or running them
      concurrently) was not done. The cli runner spawns synchronously, and
      the wall time is bounded by CPU saturation. Item 5 (the
      install-matrix cache keyed on the lockfile) was declined, because the
      store copies bin/, lint/ and src/, which the lockfile does not cover.
    - **Owner call:** whether to bring back the shared node_modules template,
      rebuilt on every rerun and refusing scoped names. It measured no gain.
    - About 69 goldens and 8 chains still run every pass (secrets,
      markdown-ignored, astro, docs-layout, committed-artefact,
      default-config, oxlint-config-unparsed,
      suppressions-resolved-config). Converting each one changes what it
      records.
    - The launch trace (`TYPESCRIPT_CHECK_TRACE`) is not built, so no spec
      proves which passes a run launches.
    - **Owner call:** a c18 exception for repository-ground chains.
      names-repository.spec.ts is 335 lines, and splitting it would add a
      c18 entry above the recorded 22.
    - Type-aware lint resolves `@jterrazz/typescript/oxlint` (imported by
      @jterrazz/test's `dist/oxlint.d.ts`) through the estate root's
      node_modules, not this checkout. In a clone outside the estate,
      `oxlint.config.ts:5:43` fails `no-unsafe-argument`, and vision/17
      fails the same way. The owner of the `file:../package-test` linkage
      decides, for example with a tsconfig `paths` entry to src/.

## Speed fix round of 2026-09-25: test

Both units landed on package-test's `vision/17` by cherry-pick, with no
merge commit and no fixup to fold. The toolchain was reinstalled from
package-typescript `cc9c3a4` (`npm ci`). `make fix` exit 0, `make check`
exit 0 (567 files, 2604 tests). The conflicts were the generated counts
of docs/03-testing.md and the entries of tsdown.config.ts, which keep both
units' bundles (`route-split`, `services-setup`, `temp-root`).
`428e616e` regenerates the counts: 83 module tests, 10 exempt seam
adapters, 4 bundled CLI entries. No hand-written line either unit added
was dropped. No speed gain is claimed for either unit.

- **Declared services once per run, fast postgres, pinned slim images**
  (branch `vision17-test-service-containers`, `ebf2ad93`…`aaf96192`, 16
  commits). Its review came back `integrate`, with both majors from the
  last round shown red under mutation. The worktree
  `pt-service-containers` and the branch are removed. What stays open:
    - docs/17-services.md:140 says a container is started once per RUN.
      Vitest runs global setup once per PROJECT, so `api()`, `jobs()` and
      `integration()` each start their own. The sentence should read
      "once per project of a run".
    - docs/17-services.md:152 names the leak question without a link. The
      maintainer creates the package-test follow-ups page, and the clause
      then links to it. The leak's root cause is not investigated: the
      Ryuk prune race is still a hypothesis.
    - The load-matched after-run of api/jobs/integration
      (`scratchpad/sc-after/run.sh`, load1 < 6) is not appended to
      timings-before.md.
    - `cli()`, `website()` and `mobile()` still start a container per
      specification.
- **Dedicated temp root, per-worker browser, preset speed knobs, build
  cache, shard split** (branch `vision17-test-runner-browser-temp`,
  `f0cc2dbf`…`113d7628`, 20 commits). Its review came back `integrate`.
  The worktree `pt-runner-browser-temp` and the branch are removed. What
  stays open:
    - The split judge passes in silence when there are no shard ledgers.
      An unsharded api run, a partial one included, empties the
      `shard-*` folders (routes.ts:181), and `node dist/route-split.js`
      then exits 0 with no output, so the merge never judges the routes.
      `judgeSplit` should fail on zero ledgers, with a test red on HEAD.
      A non-shard setup should also leave `shard-*` alone, or
      docs/03-testing.md:516 should say it empties them.
    - A shard with a `-t` filter is still classed `shard`
      (route-coverage.ts:64), so the merge judges a partial ledger as a
      whole run. Neither the Makefile nor CI combines the two today.
    - The stale-shard fix was not run end to end, only through
      `make -n`.
    - **Owner call:** whether the split judge (`route-split.js`) is
      published as a bin for consumers.

## Audience batch of 2026-09-25: typescript

No unit landed on package-typescript's `vision/17`. @jterrazz/test was
reinstalled from package-test `0ecd7a76` (`npm ci`). HEAD stays `cc9c3a4`.
`make fix` exit 0, `make check` exit 0 (157 files, 458 tests).

- **Every rule declares its audience** (branch
  `vision17-typescript-audience`, worktree `ptc-audience`, HEAD `fa13781`).
  Skipped: its review came back `fix-first` after one round. The worktree
  and the branch are kept. What stays open:
    - The fragment walk (specs/surface/package/lint-fragments.ts:29, :39-41)
      reads only `.js` files and default exports. A named-export, `.mjs` or
      `src/` self fragment ships with the meta-tests green. Walk `.js`,
      `.mjs` and `.cjs`, collect every fragment-shaped export, and walk the
      packed `lint/` and `src/` in tarball.test.ts.
    - tarball.test.ts never checks what the packed profiles expose. Every
      rule key of the six profiles and `hexagonal` should be a consumer
      catalogue entry, or a hexagonal/layers decision.
    - lint/README.md:17 and docs/03-testing.md:112 claim more than the
      audit covers.
    - The classification table in `78213be`'s body is wrong in two rows:
      the selector, and the id refusal.
    - No registry declares the `self` rules or the runtime refusals in
      shipped builders (layers id and disjoint, the unsafe-fixer refusal,
      drift-unreasoned). A `self-rules.json` registry, checked by
      audience.test.ts, would do it.
    - **Owner call:** accepting ADR-011, then the "superseded in part by
      ADR-011" line under ADR-003's status.
    - The estate page for the family-wide audience decision is not written.
      It is maintainer work.

## Audience batch of 2026-09-25: test

No unit landed on package-test's `vision/17`: both reviews came back
`fix-first` after one round, so neither branch was cherry-picked. Their
worktrees and branches are kept. The toolchain was reinstalled from
package-typescript `cc9c3a4` (`npm ci`). HEAD stays `187fb69d` before this
entry. `make fix` exit 0, `make check` exit 0 (567 files, 2604 tests).

- **Redis index per (worker, service) pair, and the owner sweep** (branch
  `vision17-test-redis-index`, worktree `pt-redis-index`, HEAD
  `86f3e9e5`). Skipped, `fix-first`. What stays open:
    - docs/17-services.md:142 is false. Outside the project setup,
      orchestrator.ts:97-103 starts one container per handle, so two
      `redis()` under `cli()` or `website()` start two containers. Share
      one container per canonical request (the `keyOf` of
      run-containers.ts:27) with a module test, or scope :140 and rewrite
      :142.
    - docs/17-services.md:154 overstates the owner sweep: it runs only when
      the next services setup starts (run-setup.ts:49). State the bound, or
      also sweep in the setup's teardown (run-setup.ts:84-87).
    - Three mutants of src/seams/redis/redis.ts survive: `letGo` not
      freeing the slot, `acquire` not letting go first, and `release`
      without try/finally. Add the two module tests the review names, each
      red against its mutant.
    - specs/integration/services/redis.spec.ts:39-40 and
      docs/17-services.md:195 still say "per worker"; both should say
      "per (worker, service) pair".
    - The owner label keys on `os.hostname()`, which changes with the
      network on macOS, so a sweep misses containers labelled under an
      earlier name. State the limit in docs/17-services.md, or label with
      a stable machine identity.
    - `3523a998`'s body calls cross-project pool-id uniqueness "not
      established"; vitest 5.0.1 draws every pool id from one Pool. Cite
      that when the follow-up to share containers across projects opens.
    - From the maker: the error strings still say "the run"
      (run-container.ts:57); no spec proves the sweep against real Docker,
      only the hand-run probe at docs/17-services.md:158; a reused owner
      pid is not swept (a hypothesis, fails safe).
- **Every rule declares its audience** (branch `vision17-test-audience`,
  worktree `pt-audience`, HEAD `8310d955`). Skipped, `fix-first`. What
  stays open:
    - **Major.** K12 recognises a self bundle by its name (`dist/self-*`,
      lint/audience.test.ts:69) and checks one bin
      (`jterrazz-test-check`). Renamed bundles ship the F3 rule and C35
      with K12 green. Assert instead that no packed bundle's `.map`
      `sources` names a self module, and run the published-checker test
      over every `bin` value; show both red under the rename.
    - **Major.** K12 ignores the runtime and type channels. B12 flipped to
      `self` still ships in dist/index.js with a dead `read:` anchor
      (src/model/lesson/refusal.ts:40 hardcodes the chapter). Every
      REFUSAL_WHY key must be a `consumer` row, no self type row may be
      asserted against the published types, and each refusal's anchor must
      exist in its audience's chapter. Update the K12 convention at
      lint/manifest.ts:1574.
    - docs/02-developing.md:340, in the consumer walkthrough, still cites
      rule E1, which is self.
    - docs/18-conventions.md:153 (§ K1) and :374 (K1–K5) present self rules
      as consumer conventions, and docs/README.md:24 advertises them. Move
      them to docs/03-testing.md.
    - The published bundles still carry the self rows as data, through
      lesson.ts importing `catalog`. **Owner call:** whether the manifest
      is split at build time.
    - docs/decisions/007:53 still reads "what rule F3 asks of every
      consumer". Whether the historical ADR gets a superseding note is the
      maintainer's call.

## Audience batch of 2026-09-25: intelligence

No unit landed on package-intelligence's `vision/17`, cut from
`origin/main`. HEAD stays `ba9d695`. The package has no `make fix` or
`make check`; its equivalents all exit 0: `make build`, `npm run lint:fix`,
`make lint`, and `make test` (18 files, 210 tests).

- **Every rule declares its audience** (branch
  `vision17-intelligence-audience`, worktree `pi-audience`, HEAD
  `3144c38`). Skipped: its review came back `fix-first` after one round.
  The worktree and the branch are kept. What stays open:
    - **Major.** `1f25059` dropped the packed file-list check. A home-only
      tsdown entry ships in the tarball and the spec stays green. Pin the
      exact packed file set in oxlint-entry.spec.ts. Show it red under a
      temporary `home-lint` entry. Then state in docs/02-developing.md that
      a self rule's plugin module is never a tsdown entry.
    - **Major.** Every rule module imports RULE_DOCS, so a `self` row's
      text is inlined into dist/oxlint.{js,cjs} and their maps. The
      meta-tests stay green. Move self rows into a module the plugin never
      reaches, with its own SelfRuleId. Judge the union in plugin.test.ts.
      Add a tarball row saying no shipped file carries a self id or its
      convention text. **Owner call:** if the split is rejected, reword
      docs/02:84-86 and manifest.ts:25-28 to say the text is bundled.
      @jterrazz/test has the same leak.
    - The audience walk skips functions (spec:49), and only `./oxlint`'s
      export set is pinned. Pin the sorted export names of every subpath,
      in ESM and in CJS.
    - docs/02-developing.md:84-86 claims a home wiring for self rules. No
      such wiring exists. Say so, or drop the claim.
    - `exportMap()` (spec:77) reads the root package.json, not the
      extracted one. Pass it `installed`.
    - The meta rows and runtime refusals declare their audience only in
      `f25c84f`'s commit body. Accept that as recorded. docs/03-testing.md
      should state that the meta rows are `self` and that the refusals are
      the API's contract, with no catalogue row.

## Audience batch, integrated (2026-09-25): typescript

The audience unit landed on package-typescript's `vision/17`: its 15
commits were cherry-picked in order onto `cc9c3a4`, with no fixup to fold
and no merge commit, then the owner's acceptance of ADR-011 and the
"superseded in part" line under ADR-003's status. @jterrazz/test was
reinstalled from package-test `a83d926b` (`npm ci`). `make fix` exit 0
left no generated file to regenerate; `make check` exit 0 (159 files, 475
tests). HEAD is `aeb6d83`. The worktree `ptc-audience` and the branch
`vision17-typescript-audience` are removed.

- **Every rule declares its audience** (branch HEAD `7a1b00d`). Integrated
  after its second review. Four minor findings stay open:
    - The shell-bin proof checks variable names, not behaviour. A
      `function selected {` form, a lowercase variable, or an argv flag
      re-inlines a pass selector with tarball.test.ts and audience.test.ts
      green. Require every `selected` word in a packed `.sh` to be the one
      definition or a consumer-pass call, collect variable names of any
      case minus those the scripts assign, and add a bin variant per
      `--flag)` case. docs/03-testing.md:132 claims more than the proof.
    - A fragment whose audience is computed ships as `self` with the proofs
      green, through a builder a consumer calls (`layers()`) or one built
      after a turn. Call every exported fragment builder in the module walk,
      or freeze `audience` in `fragment()`; otherwise name the hole in
      docs/03.
    - The runtime refusal count misses `throw Error(` without `new`,
      `reject(` of any argument, and `exit "$status"`. Widen REFUSALS in
      audience.test.ts.
    - Shipped docs/06-quality-checks.md:211, docs/07-lint-presets.md:29 and
      :204, lint/_contract.js:23 and :53 and lint/catalog.js:23 link to
      docs/03-testing.md, which `files` excludes. **Owner call:** ship
      docs/03, or repoint those links to the repository URL.

## Audience batch, integrated (2026-09-25): test

Two units landed on package-test's `vision/17`, cut from `ad6add85`: the
redis-index unit's 6 commits, then the audience unit's 17, each
cherry-picked in order, with no fixup to fold and no merge commit. Every
line either branch added is present in the result. The toolchain was
reinstalled from package-typescript `aeb6d83` (`npm ci`). `npm run docs`
exit 0 and `make fix` exit 0 left no generated file to regenerate;
`make check` exit 0 (571 files, 2630 tests). HEAD before this entry is
`a4fca462`. The worktrees `pt-redis-index` and `pt-audience` and the
branches `vision17-test-redis-index` and `vision17-test-audience` are
removed.

- **One redis container per project, an index per (worker, service)
  pair** (branch HEAD `86f3e9e5`). Integrated after its re-review, which
  left no major finding. Six minor findings stay open:
    - docs/17-services.md:142 is false: without a project server,
      `cli()`, `website()`, `mobile()` and hand-written projects start a
      container per handle (orchestrator.ts, service-container.ts), so
      `cache: redis()` and `queue: redis()` there are two containers,
      against :140's sharing sentence. Either key the orchestrator's
      container requests by their canonical request, with a module test
      of one `createContainer` call, or scope :140 to the project setup
      and reword :142.
    - docs/17-services.md:154 overstates the owner sweep: it runs only
      when the next services setup on the machine starts. State the bound
      (the next setup or the reaper's last client, whichever comes first),
      or also sweep in the setup's teardown.
    - Commit `cd07024c`'s "release gives it back even when the flush
      fails" and "a handle that acquires again gives its pair back first"
      are untested: three mutants survive (no `freeSlot` in `letGo`; no
      leading `letGo()` in `acquire`; `release` without `try/finally`).
      Add the two module tests the review names in
      src/seams/redis/redis.test.ts.
    - Stale wording: specs/integration/services/redis.spec.ts:39-40
      ("isolation is per WORKER") and docs/17-services.md:195 ("the
      worker's") now describe a (worker, service) pair's index.
    - The owner label keys on `os.hostname()`, which on macOS follows
      DHCP; a container labelled under an earlier network's name is never
      swept. It fails safe. State the limit beside the two others in
      docs/17-services.md, or label with a stable machine identity.
    - Commit `3523a998`'s reason for not sharing containers across
      projects ("pool-id uniqueness across projects is not established")
      is weak: vitest 5.0.1 draws every pool id from one Pool's
      concurrency id. The decision stands; cite that when the follow-up to
      share across projects opens.
- **The tarball exposes no self rule** (branch HEAD `6cfc2260`).
  Integrated after its review; every attack on the self/consumer split
  turned the proofs red. Two minor findings stay open:
    - docs/01-architecture.md:87 says `docs/` ships in the tarball whole;
      `files` excludes docs/03-testing.md and docs/decisions/
      (docs/04-operating.md:19-21). Add the clause, keeping 04 as the
      owner.
    - Beyond the whole-tarball grep, the loaded-entry walk neither calls
      exported functions nor enters Map/Set entries, and the bin test runs
      bins only over the SELF_CHECKER_PASSES fixtures. Defense in depth,
      not a leak; optionally run each bin over the F7 fixtures too.

Audience batch, integrated (2026-09-25): intelligence

## Architecture migration, integrated (2026-09-25): test, S0

One step of the @jterrazz/test architecture migration landed on
package-test's `vision/17`, cut from `5cc2114d`: step S0, the skeleton.
Its 8 commits were cherry-picked in order with no conflict, no fixup to
fold and no merge commit. `npm run docs` exit 0 and `make fix` exit 0
left no generated file to regenerate. `make check` exit 0 (580 files,
2655 tests). HEAD before this entry is `e88bf7a8`. The worktree
`pt-arch-s0` and the branch `vision17-test-arch-s0` are removed.

- **S0, the skeleton** (branch HEAD `f4b93a16`). Integrated after its
  review, which found nothing major. What the step left undone:
    - The stubBackend InterceptPort adapter (plan step 5) is not built.
      Nothing uses it until U1/U3, and an unused export fails knip.
    - `JobHandle` stays in src/model/chain/config.ts, because
      SpecificationConfig names it and model/ may not import actions/.
    - builder.test.ts cases stay in place. They cover the builder, which
      still serves api, cli, integration, website and mobile until S6.
    - Plan §7 R6 is not pinned: no module test shows that loading
      src/index.ts does not load msw/node.
- Eight minor findings stay open:
    - The default type argument prints differently:
      `JobsSpecification<string>` where vision/17 printed
      `JobsSpecification`. Record it in the plan's R1 note, or pin it with
      a type-channel row.
    - lint/self-layers.ts gives all of `model/` a `results/` edge. Narrow
      it to seams for model/chain/builder.ts and
      model/goldens/matchers.ts. **S6 decision:** matchers.ts imports
      accessors as values, and the final §4.4 map has no model→results
      edge. Either move the accessor comparison or declare the edge.
    - capabilities/intercept/intercept.scope.ts imports a type from
      seams/msw/handlers.js, against K-arch-2. Declare
      `ContractRegistration` as a port type on the capability side, or
      let S6 decide it with the `.wrap()` gap.
    - R6 is not pinned (see above). Add a module test that imports the
      node entry in a fresh module graph and asserts msw/node is not
      loaded.
    - The seed effect has two live definitions: builder.executeSetup and
      seams/fs/database-set.ts. databaseSet's two refusals have no test
      of their own. Add a sibling test before builder.test goes in S6.
    - Doc drift: docs/19-linting.md:535 does not list the
      `src/seams/vitest/**` F2 exemption. The docs/01 claim that the
      runner is named in "exactly TWO places" is no longer true. The
      SharingOf JSDoc example names `api.with({ clock })` on `jobs.with`,
      and `jobs.clock` reads "the subject's".
    - Only specs/jobs/clock/branch.spec.ts has its regression stated in
      the commit body. Hold the next units to one line per spec.
    - Disclosed behaviour change: a clock refused while arming now
      releases the msw handlers armed before it (pinned in
      perform.test.ts). It has no owner Q. Accepted unless the owner wants
      it listed with Q1/Q2.

## Architecture migration, integrated (2026-09-25): test, U5 and U1–U4 — gates RED

Five steps were cherry-picked onto package-test's `vision/17`, in the order
U5, U1, U2, U3, U4, with no merge commit and no fixup to fold. HEAD before
this entry is `74c52d4e`. The generated tables of docs/03 were taken from
one side at every conflict and regenerated by `npm run docs` (exit 0) in
`8431bf0a`. `make fix` exit 0. **`make check` exit 2**: three meta-tests
fail, and the ratchet refuses five new I6 findings. The step worktrees and
branches are KEPT until the owner settles the conflict below.

- **U5, the gates** (branch HEAD `e6318786`). Clean cherry-pick.
- **U1, api and website** (`9e8a7320`). The U1 review's builder finding
  is taken as a rule: U1–U4 may delete their facet's now-dead paths from
  builder.ts.
- **U2, cli and integration** (`d4a3ce69`). builder.ts, builder.test.ts,
  docs/01, lint/self-layers.ts and the siblingless kinds were resolved by
  hand against U1.
- **U3, mobile** (`2e46f8fb`). Mobile was the last node facet the builder
  served, so `SpecificationBuilder` is now handed out by no facet. The
  class and builder.test.ts stay until S6 deletes them. U1's
  `seams/stub-backend/stub-network.ts` is collapsed into U3's
  `stub-backend.engine.ts`, as the U3 review required.
- **U4, component** (`37f7927b`). U2's run.action.test.ts awaited a
  refusal that U4's asynchronous `prepare` now rejects (`bfd1ec15`).

**Open, for the owner:** U5's gates were reviewed against a tree where only
`jobs` was composed. They judge U1–U4 on the integrated tree and fail:

- I6 (`i6-facet-is-composition`) flags five engines written in a facet.
  In api, website and cli, the engine is `required(config.<engine>, …)`,
  the Q11/R-6 guards. In integration it is `config.services ?? {}`. In
  component it is `locate: () => ''`. These are not recorded as ratchet
  debt.
- The I7 meta-test flags `capabilities/env` (U2), which reaches
  `model/chain/resolve.ts` for `expandWorkdir`, and through it `node:fs`,
  `node:path` and `seams/git/tree`.
- The I8 meta-test finds no sibling test beside the `headers` capability
  (U1), the `fetch` action (U1) or the `render` action (U4).
- `lint/self/compositions.ts` lists `jobs` alone. Its meta-test wants all
  seven composed facets, and reading their rows off the compositions
  changes the hand matrix.

Decide whether the units conform to the gates (a reconciliation step) or
the gates change. Until then, `vision/17` is red.

Minors carried from the reviews:

- The U2 cast in integration.handle.ts goes to the S6 `open<Self>`
  decision.
- Nothing pins "one docker run id per runner". Add a follow-up spec.
- The `model → actions/run/literate` edge goes to S6.
- U3's unreachable `.open()` device guard in seams/appium/appium.app.ts
  goes on the S6 list, next to R-6.
- The siblingless kind "a mobile module that needs a device" is stale and
  goes to the maintainer.
- U4's `component.handle.ts` refusing stub is not yet built through
  `refusing<ComponentChain>()` and moves to S6.
- U4 leaves a known unmount-time request race.
- U4 changes the order of the viewport restore and the console recorder.
- U5's I6/I7 walker has known gaps: a tagged template, an assignment, and
  the `capabilities.reduce` false positive.

## Architecture migration, integrated (2026-09-25): test, S6 — gates RED on I8

S6, the seal (branch HEAD `159668ad`), was cherry-picked onto `vision/17`
with no merge commit and no fixup to fold. HEAD before this entry is
`c01c42f5`. There were no conflicts. `npm run docs` (exit 0) and
`make fix` (exit 0) left the tree unchanged. The review allowed dropping
`ef1e665d`, the formatter's blank lines in VISION.md, but it is kept:
`make fix` writes the same two lines, and the format pass needs them.
**`make check` exit 2**: 1 test fails out of 2707, and 605 of 606 files
pass. Before S6, three tests failed.

S6 settles I6, I7 and the compositions list from the U5 and U1–U4
conflict. One conflict is still open, **for the owner**:

- I8 finds no sibling test beside `capabilities/headers`,
  `actions/fetch` or `actions/render`. Meanwhile
  `lint/siblingless-kinds.ts` claims all three are proven by specs, so the
  two self gates contradict each other. No filler test was written. For
  `render`, a real test under node needs `vi.stubGlobal`, which the lint
  forbids, and E5 forbids a simulated DOM. A possible way out is to put
  the console recorder's `addEventListener` behind the page port. Decide
  which gate gives way. Until then, `vision/17` is red on this one test.

Minors carried from the review:

- The final I1 map in `lint/self-layers.ts` keeps three edges that plan
  §4.4 drops: `model → results/`, `facets → results/` (the handles'
  `createDockerReader`) and `seams → results/text`. The code still takes
  them. Either record this as a plan correction, or add a follow-up that
  moves the docker reader and the golden comparison behind a port.
- The U2 cast in `src/facets/integration/integration.handle.ts` is still
  there, and no decision records a generic `open<Self>`.
- The component node stub is an object literal typed `ComponentChain`. It
  is not built through `refusing<ComponentChain>()`.
- The `baseUrl` guards in `.visit()` and `.fetch()` stay. Q11 covers
  adapter guards, and `baseUrl` is not an engine.
- `make test-mobile` was not run. It needs Xcode and a simulator.

The S6 worktree and branch are removed. The U1–U5 worktrees are kept, as
the previous entry decided.

## Architecture migration, integrated (2026-09-25): test, U-post-1..3 and iteration 38 — gates RED on I8

Two steps were cherry-picked onto `vision/17` in order, with no merge
commit and no fixup to fold. HEAD before this entry is `b7e193d6`.

- **arch-post** (U-post-1..3, branch HEAD `02963f30`): the component page
  clock refuses what is not an instant, a website page's content stream is
  named `content`, and a JSON reading names the stream it parsed. It
  applied cleanly.
- **stubs-rename** (iteration 38, branch HEAD `779a4c3e`): contract
  becomes stub in every name, folder and rule. A stub's folder is its
  kind, and C4 holds it to that kind's builder. The 16 → 17 mover moves
  `contracts/` to `stubs/`. One conflict came up, in the GENERATED layer
  counts of `docs/03-testing.md`. It held no prose. The step's side was
  taken, and `npm run docs` was rerun and committed as a chore.

`make fix` exits 0. **`make check` exits 2**: 1 test fails out of 2717,
and 609 of 610 files pass. The failure is the same I8 as in the S6 entry,
and it is still **for the owner**. One `make check` run also crashed on
a Playwright `JSON.parse` error inside `playwright-core`. `make test` did
not reproduce it.

Open from the reviews, **for the owner or orchestrator**:

- U-post-4: the website clock engine does not refuse a non-instant.
  `website.clock('soon').visit()` fails with Playwright's
  `Invalid date`, not with the clock's own refusal. The fix is either
  `instantOf` in `pageClock.pin`, or the check moves to the clock
  capability's `arm`. Pin it with a website spec.
- A streamed LLM stub has no legal folder under the kind-strict C4.
  Either add `openai.stream` and `anthropic.stream` builders, or have
  docs/16 state that a streamed provider reply is an http stub.
- C4 now tracks only named imports of builders. A namespace import
  (`t.http.get`) is not kind-checked. Resolve it, or record the limit in
  docs/16's C4 row.
- No static guard catches a leftover `contracts/` tree. Should C13 name
  it? ADR-006 line 42 still reads the role from a "contracts/ ancestor".
- `src/stubs/kinds.test.ts` hand-lists the exported builders. Derive the
  list from the entry's namespace instead.
- The mover's usage rename can collide with a local `Stub`, and it does
  not rewrite `export { Contract }` re-exports. Both fail loudly at
  compile time.

Release notes: the declared type of `JsonAccessor`'s constructor is now
`(rawText, streamName, testDir, options?)`, the same shape as
`TextAccessor`'s. It is exported as a type only. 17.0 also removes the
`Contract` names in favour of `Stub`.

The arch-post and stubs-rename worktrees and branches are removed.

## Architecture migration, integrated (2026-09-25): test, component-grouping — gates RED on I8

Integrated onto `vision/17` by cherry-pick, with no merge commits:

- **component-grouping** (branch HEAD `46c2e7aa`): the component tree
  is filed by capability, one folder per `component` column capability,
  and C35 holds it. The step also carries the redis release that still
  gives its pair back, the services and architecture pages it touched,
  and two runner fixes: a merge with no shard's ledgers fails, and a
  shard filtered by `-t` leaves its split unjudged. The seven commits
  applied without conflict.

Three fixes from the review landed with it. The quote-status note above
now cites `specs/component/intercept/`. docs/03's component paragraph
says a test is filed by what it chiefly asks about, and split only where
separate units carry its claims. C35's lead sentence now covers the
component tree, and `npm run docs` regenerated its catalogue row.

`make fix` exits 0. **`make check` exits 2**: 1 test fails out of 2723,
and 612 of 613 files pass. The failure is the same I8, and it is still
**for the owner**.

Open, **for the owner or maintainer**:

- Seven component tests claim two capabilities and are filed by the
  dominant one. Split them, or keep the rule docs/03 now states.
  `mockOf` and `waitUntil` have no component row.
- Does `route-split.js` ship to consumers as a bin?
- The stale-shard fix has not been run end to end with
  `make test SHARD=i/n`. It is a HYPOTHESIS until it is.
- The coverage floor was not verified here, because `make test` stops on
  I8 before `coverage:check` runs.
- docs/17's leak paragraph needs a package-test follow-ups page to link
  to. That page is the maintainer's to create.

The component-grouping worktree and branch are removed.

## Refresh on 17, and the audience minors closed (2026-09-25): typescript

package-typescript's `vision/17` now runs on this package's `vision/17`,
at `17b489ee`. `npm ci` installed @jterrazz/test 17.0.0. The first
`make fix` exited 0 and renamed nothing: the mover never descends into a
ground folder, and the toolchain's one `contracts/` tree sits under
`package-typescript/specs/cli/preset/fixtures/`. Five commits followed, `aeb6d83..a5b4018`.
The last `make fix` exited 0, and `make check` exited 0 (161 files, 478
tests).

- **The tsconfig ground fixture** (`a59b409`) had its `contracts/` folder
  moved to `stubs/` by hand. The spec now names the stub.
- **REFUSALS** (`f824a4b`) now counts `throw X(` with or without `new`,
  every `reject(`, and a script's `exit` handed a variable. A test pins
  each spelling. It also pins what does not count: a rethrow of a caught
  error, a clean exit, and `--linter-exit`. No shipped count changed.
- **The shell-bin proof** (`2651085`) now judges behaviour, not names.
  Every `selected` outside a comment is either the one definition or a
  call naming a consumer pass. The environment variant sets every
  variable of any case that the scripts read and never assign. The bin
  also runs once per `case`-arm flag, followed by a pass. Each of the
  three re-inlining spellings was tried by hand, and each went red.
  docs/03 names what the proof still cannot reach: a flag tested
  outside a `case` arm, and a choice read from a project file.
- **Computed audience** (`edaa7b1`) is closed by a text proof,
  `builder-calls.test.ts`, rather than by calling the builders or by
  freezing `fragment()`. Every packed `fragment()` call must hand an
  object literal, with no spread, whose `audience` is a string literal.
  A namespace import, a re-export, or the builder handed on as a value
  also fails. Three mutations of `layers.js` were tried, and each went
  red. A fragment-shaped object built without the builder stays the
  module walk's alone, and docs/03 says so.
- **The docs/03 links** (`a5b4018`) are repointed to the repository URL,
  as the owner chose. Beyond the six listed sites, the proof found
  docs/01, 02 and 04, ADR-011, lint/README.md and README.md, whose
  skill link was dead too. `shipped-links.test.ts` now fails any
  relative link from a packed file to a page the checkout keeps and the
  tarball omits. The map, docs/README.md, is exempt, because the Docs
  (layout) pass requires its relative chapter row.

Open, **for the owner or maintainer**:

- The package-lock entry for `@jterrazz/test` still records `16.1.1`.
  `npm ci` installed 17.0.0 from `file:../package-test`, and
  `npm install --package-lock-only` rewrote nothing. It moves at release,
  when the dependency stops being a `file:`.
- ADR-011's body had a link repointed, and nothing else. Its status is
  untouched.

## Architecture wave closed (2026-09-25)

Three close units were integrated onto package-test's `vision/17` by
cherry-pick, with no merge commits, in this order:

- **close-i8** (branch HEAD `3d132578`, 8 commits). I8 now honours the
  kinds that have no sibling, `render` is declared page-only, and a test
  proves that loading the node entry reaches no msw, playwright or
  webdriverio. docs/01 gives the three results edges that plan §4.4
  dropped, each with its reason.
- **close-stubs** (branch HEAD `3a35e7d2`, 4 commits). The clock
  capability refuses a stated non-instant for every engine, which closes
  U-post-4. C4 kind-checks a stub reached through a namespace import.
  `openai.stream` and `anthropic.stream` serve a provider's streamed
  reply. C13 names a leftover `contracts/` folder beside a test, and
  names the mover that moves it.
- **close-component** (branch HEAD `7fc4d1a2`, 7 commits). Component
  test files are split so that each asks about one capability. docs/03
  names `page-surface` as the one exception.

The docs/03 generated counts conflicted twice while close-stubs was
being picked. Both times vision/17's figures were kept, and
`npm run docs` then restated them in a separate chore commit. The Markdown
(prose) gate was red because this page cited a package-typescript
fixtures path as if it were local. The path is now qualified with its
repository. With I8 closed, `make fix` exits 0 and **`make check` exits
0**: 623 test files and 2742 tests pass. The coverage floor was checked
and holds, with statements at 94.88%, branches at 85.75%, functions at
96.34% and lines at 94.83%.

Open, **for the orchestrator**:

- Plan §4.4 should record the three results edges as a correction:
  model→results, facets→results through the handles' `createDockerReader`,
  and seams→results/text through `vitest-browser/golden.ts`.
- Iteration 38 said SSE and streams are `http`. docs/16 now refines that
  with the provider streams. The owner should confirm the refinement.

Open, **for the owner or maintainer**:

- The `.json body` module count reads 12 when the true figure is 11. The
  probe matches the `'package.json'` literal in `src/index.test.ts`,
  because `matcherOf` anchors a probe that starts with a dot only on that
  dot.
- `oxlint.config.ts` still exempts `src/seams/vitest/**` from F2, but
  `clock.engine.ts` imports only `model/`. If that exemption is dead,
  drop it, and docs/01's "the two vitest seams" becomes "the page seam".
- C13's rule that any `contracts/` under `specs/` counts is not pinned.
  Its only invalid in-specs case also has a facade. It needs a case with
  kind folders only. C13 also looks only at the folder beside a test,
  while the mover renames every `contracts/`. Either accept that limit
  and record it, or also probe the ancestors.
- C4's `composes()` still matches only a bare `defineStubs`, so
  `export default t.defineStubs(…)` is refused. Either extend it or
  record the limit in the C4 convention.
- The cast in `integration.handle.ts` stays, because the Services
  parameter blocks removing it. The hand-written component node stub
  stays too: it is already exhaustive with no cast, and
  architecture-plan.md:718's helper would need one. Both need a decision.
- `mockOf` and `waitUntil` have no component row, so their tests stay in
  `intercept/page-surface.test.tsx`. Once rows exist, splitting them into
  `mock-of/` and `wait-until/` is mechanical. The two page-matcher
  `toContain` tests would move to that row's folder.
- docs/03:80 should say that the verbs a form is driven by belong to
  `fill/`. Without that, fill/'s `press`, `gone` and `check` claims read
  as a second capability.
- The component `.wrap()` cell rests on one file, nav. use-modal-dialog
  no longer goes through `.wrap()`.

The three worktrees and branches are removed.
