# @jterrazz/test — the manual

How to test with `@jterrazz/test`, and how this repository is built. New here: read [05 — Getting started](05-getting-started.md), then the chapter of the kind of test you are writing. The front page is the root `README.md`; the brief an agent opens first is the root `AGENTS.md`.

## Using the framework

| Chapter                                       | Holds                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [05 — Getting started](05-getting-started.md) | What the framework is and why, the five ideas behind it, a first spec, and which kind of test to write     |
| [06 — Setting up a project](06-setting-up.md) | What to install, the vitest config and its project helpers, turning the conventions on, where a run writes |

### What is tested — one chapter per kind

| Chapter                                     | The subject                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| [07 — Module tests](07-module-tests.md)     | One module, beside its code, nothing started — `<file>.test.ts`                        |
| [08 — Integration specs](08-integration.md) | A module against real services, or against a golden — `specification.integration()`    |
| [09 — Component specs](09-component.md)     | A rendered unit in a real Chromium, beside its code — the `component` chain            |
| [10 — Website specs](10-website.md)         | A served page, fetched or driven in a browser — `specification.website()`              |
| [11 — Mobile specs](11-mobile.md)           | A native app on an iOS simulator — `specification.mobile()`                            |
| [12 — API specs](12-api.md)                 | An HTTP app, in-process, through complete requests — `specification.api()`             |
| [13 — Job specs](13-job.md)                 | A pipeline triggered by name — `specification.job()`                                   |
| [14 — CLI specs](14-cli.md)                 | A binary in a fresh working directory — `specification.cli()`                          |
| [15 — Spec documents](15-documents.md)      | A CLI session written as data — the `<case>.spec.yaml` format                          |
| [16 — Lint specs](16-lint.md)               | The rules a project ships, over fixture trees — `specification.lint()`, `ruleTester()` |

### What surrounds the subject

| Chapter                                         | Holds                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| [17 — Stubs](17-stubs.md)                       | The network, declared: `defineStub`, the builders, `.intercept()` and `intercept()`    |
| [18 — Services](18-services.md)                 | Real databases, caches and processes: `postgres()`, `redis()`, `sqlite()`, `process()` |
| [19 — Time and doubles](19-time-and-doubles.md) | `clock`, `mockOf()`, and the doubles ladder                                            |

The disk a subject reads is laid by its chain — `.fixture()` and `.link()` on a CLI ([14](14-cli.md#file-state-is-the-shape-of-a-fixture-tree)) and a lint spec ([16](16-lint.md)) — and every path a test names is spelled with `file()` or `directory()` ([23 § The naming recap](23-conventions.md#the-naming-recap)).

### Acting on a screen

| Chapter                           | Holds                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [20 — The visitor](20-visitor.md) | The verbs (`click`, `fill`, `see` …), the targets (`button()`, `field()` …), scoping, and how one element is matched |

### Judging the result

| Chapter                             | Holds                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------- |
| [21 — Assertions](21-assertions.md) | Every result subject and its matchers, goldens, sync and async             |
| [22 — Tokens](22-tokens.md)         | The `{{token}}` grammar for values that move, `#ref` captures, update mode |

### The conventions

| Chapter                               | Holds                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [23 — Conventions](23-conventions.md) | The principles: which test earns its place, one file one subject, the naming of a spec tree, what stays human |
| [24 — Linting](24-linting.md)         | The oxlint plugin, the conventions checker, the ratchet, and the generated catalogue of every rule            |

## Words this manual uses

| Word        | Means                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| kind, facet | A kind of test — api, cli, website … A **facet** is the code behind one kind: its constructor, its chain and its result                                                                |
| runner      | What a constructor returns, such as `api` from `specification.api()`: the object every chain of the suite starts from                                                                  |
| handle      | What a service factory returns, such as `postgres()`: the service before it starts, then its `connectionString` once it runs                                                           |
| chain       | One test's sentence on a runner: zero or more setups (`.seed()`, `.intercept()` …), then exactly one action (`.get()`, `.exec()` …) that resolves to a result                          |
| oracle      | What a test compares the result against: the value inside `expect(…).toMatch(…)`                                                                                                       |
| golden      | An oracle kept in a file under `_expected/`, compared whole and rewritten by `TEST_UPDATE=1`                                                                                           |
| ground      | The files a test stands on, in the `_seeds/`, `_requests/`, `_fixtures/` and `_expected/` folders                                                                                      |
| seam        | A place where the framework meets an outside tool it loads on demand: a database driver, a browser, a simulator. Each is an optional peer                                              |
| ratchet     | A count of debt kept in `jterrazz.baseline.json` that may only fall: an unreached route, a convention not yet followed. A run that raises it fails, and `TEST_UPDATE=1` records a fall |
| specimen    | A small sample app a testing tool keeps under `specs/_shared/_fixtures/` to test itself against. Only a repository that tests a testing tool has one                                   |
| door        | Where a test file may sit: beside its module (a unit), under `specs/<kind>/` (an assembled product), or in a repository suite (the third door)                                         |

The examples use made-up products: `shoply`, a shop CLI; a news app with an events feed; and hosts under `.test` and `.example`, which never resolve on the internet.

## Developing this repository

| Chapter                                 | Holds                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [01 — Architecture](01-architecture.md) | The runner model, the source trees and their edges, the enforcement channels, what the tarball publishes |
| [02 — Developing](02-developing.md)     | The loop, which file a change opens, what a change owes                                                  |
| [03 — Testing](03-testing.md)           | The vitest projects, the generated capability matrix, coverage, the meta-tests, the package's own rules  |
| [04 — Operating](04-operating.md)       | The npm release, what leaves the tree, the footprint in a project                                        |

The decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken, beside the `_template.md` they follow. Neither 03 nor `decisions/` ships in the tarball: from inside an install, read them at <https://github.com/jterrazz/package-test/tree/main/docs>. The API itself is the types the package publishes, and no page restates it.

## How the chapters are written

- **One owner per fact.** Each fact is stated in one chapter; the others link to it.
- **The kind chapters share one outline** — what it specifies, the constructor, the chain, the result, unique here, pitfalls — so the reader who learned one kind knows where to look in the next.
- **Rules live in the code.** A rule's normative sentence is written in `lint/consumer/catalogue/manifest.ts` and generated into [24](24-linting.md); the chapters explain and illustrate, and the catalogue decides.
- **Every example compiles.** A meta-test typechecks each block that imports only the framework, so a sample cannot drift from the API.
- **A block that starts at `test(…)` is an excerpt.** In its file, that test sits inside the file's one `describe`, which a block showing a whole file writes out.
