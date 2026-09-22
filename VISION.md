# Vision 17 — the plan the three `vision/17` branches implement

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
- `$FIXTURES/` is removed. The shared pool is `specs/fixtures/`, reached by a
  relative path. A path may leave its leaf only to reach the pool (C15
  restated); anything else is an error.
- The `.spec.yaml` documents follow the same law: `fixture: ./fixtures/shop/`.
- `{{any}}`-style tokens and `TEST_UPDATE=1` keep working on every `…File`
  and `…Directory` matcher.
- The checker's mover rewrites every call and document mechanically.

## 2. Ground folders are bare, reserved names

| 16                             | 17                | Holds                                          |
| ------------------------------ | ----------------- | ---------------------------------------------- |
| `_fixtures/`                   | `fixtures/`       | input files and file-system state              |
| `_seeds/`                      | `seeds/`          | database state, `.sql`                         |
| `_requests/`                   | `requests/`       | input requests, `.http`                        |
| `_expected/`                   | `expected/`       | everything asserted, response `.http` included |
| `_fixtures/` at the specs root | `specs/fixtures/` | the shared pool                                |

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

| Area             | package-test                                                                                                                   | package-typescript                           | signews-api         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------- |
| §1 verbs + types | shown: the six verbs, `RelativePath` exported, the type and runtime refusals, own specs and lint fixtures migrated             | its own `.spec.yaml` migrated                | migrated            |
| §2 folders       | shown: renamed everywhere, C1 refuses a reserved domain, C13 flipped with the 16→17 mover as its `--fix`, C15 restated         | ignore globs + own specs renamed             | renamed             |
| §3 names         | shown: the three `types` sites renamed (`oxlint-api`, `exchange`, `component.shape`)                                           | the rule, tested                             | ratchet delta shown |
| §4 spine         | shown: `src/lint` → `lint/`, I1 reads the spine; 4 rules as `.spec.yaml`. Deferred: 81 rule specs, `lint/` one folder per rule | the spine check; `rules/` → `lint/`          | follows             |
| §5 knowledge     | shown: reference, typedoc, skill references and cards deleted; SKILL.md 106 lines, held by a meta-test                         | `docs` command, typedoc, Docs (sync) deleted | —                   |
| §6 exact names   | shown: the window removed from the three adapters, with its commands and its name reading                                      | —                                            | —                   |

Each branch keeps one commit per unit, so the owner can read the vision
commit by commit.

### Deferred in package-test

- **The toolchain bridge.** The installed `@jterrazz/typescript` 10.3.1 still
  names the underscored folders, so this repository states the bare ground
  itself: tsconfig `exclude`, oxlint and oxfmt `ignorePatterns`, knip `ignore`,
  and the `--ignore-pattern` pair its `lint` scripts hand the tree gates. All
  of it goes when the package-typescript 11 globs ship.
- **`lint/` one folder per rule.** The rules moved to the root as they were,
  `lint/rules/<facet>/<rule>.ts` beside its test.
- **The lint rule specs still to convert in the refactor** — 81 files under
  `specs/lint/<family>/`, each to become `specs/lint/<rule-id>/<case>.spec.yaml`
  with its twin moved into a local `fixtures/`. Converted: i2-sibling-test-naming
  (static), d12w-response-body-probe (warn), c15-local-fixture-reach (checker),
  c14-pool-fixture-shared (autofix). To convert: a1, a2, a3, a4, a9w, b4, b6w,
  b8, b9w, b10, b11, c1, c2, c4, c6, c7, c8, c10, c11, c13, d2, d2w, d6w, d8w,
  d9w, d13w, d15w, d16, d16w, d17w, d18w, d19w, e2, e4w, e5, e6, e7w, e8, e9w,
  f1–f6, g4, i1, i4, j2, j6w, w1, w2, w5w; the checker's a7, b5, c8-spec, c9,
  c12, c16, c18, c20, c21w, c23, d4 ×2, d4b ×4, d5, d5w, d10w, d11w, j3w, j4,
  j5, j9, member-pass, checker-cli, kitchen-sink; and the k4 reach meta-test.

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
   `**/{fixtures,expected}/**` rather than `specs/**/…`?
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
