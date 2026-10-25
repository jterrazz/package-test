# @jterrazz/test: the manual

How to test with `@jterrazz/test`, and how this repository is built. New here: [Getting started](start/getting-started.md), then the guide of the kind of test you are writing. The front page is the root `README.md`; the brief an agent opens first is the root `CLAUDE.md`.

The pages follow the package's four export families (what is tested, what surrounds the subject, acting on a screen, judging the result). The first is a guide per kind, the other three are reference.

## Start

| Page                                          | Answers                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [Getting started](start/getting-started.md)   | What the framework is and why, the five ideas behind it, a first spec, and which kind of test to write     |
| [Set up a project](start/set-up-a-project.md) | What to install, the vitest config and its project helpers, turning the conventions on, where a run writes |

## Guides

### What is tested: one guide per kind

| Guide                                            | The subject                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [Module tests](guides/module-tests.md)           | One module, in its folder's `__tests__/`, nothing started: `<file>.test.ts`             |
| [Integration specs](guides/integration-specs.md) | A module against real services, or against a golden: `specification.integration()`      |
| [Component specs](guides/component-specs.md)     | A rendered unit in a real Chromium, in its folder's `__tests__/`: the `component` chain |
| [Website specs](guides/website-specs.md)         | A served page, fetched or driven in a browser: `specification.website()`                |
| [Mobile specs](guides/mobile-specs.md)           | A native app on an iOS simulator: `specification.mobile()`                              |
| [API specs](guides/api-specs.md)                 | An HTTP app, in-process or deployed at a `url`, through requests: `specification.api()` |
| [Job specs](guides/job-specs.md)                 | A pipeline triggered by name: `specification.job()`                                     |
| [CLI specs](guides/cli-specs.md)                 | A binary in a fresh working directory: `specification.cli()`                            |
| [Spec documents](guides/spec-documents.md)       | A CLI session written as data: the `<case>.spec.yaml` format                            |
| [Lint specs](guides/lint-specs.md)               | The rules a project ships, over fixture trees: `specification.lint()`, `ruleTester()`   |

### Developing this repository

| Guide                        | Answers                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| [Develop](guides/develop.md) | The loop, which file a change opens, what a change owes, how a page of this manual is written           |
| [Test](guides/test.md)       | The vitest projects, the generated capability matrix, coverage, the meta-tests, the package's own rules |
| [Release](guides/release.md) | The npm release, what leaves the tree, the footprint in a project                                       |

## Concepts

| Page                                     | Answers                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [Conventions](concepts/conventions.md)   | The principles: which test earns its place, one file one subject, the naming of a spec tree, what stays human |
| [Architecture](concepts/architecture.md) | The runner model, the source trees and their edges, the enforcement channels, what the tarball publishes      |

## Reference

### What surrounds the subject

| Page                                              | Holds                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Stubs](reference/stubs.md)                       | The network, declared: `defineStub`, the builders, `.intercept()` and `intercept()`    |
| [Services](reference/services.md)                 | Real databases, caches and processes: `postgres()`, `redis()`, `sqlite()`, `process()` |
| [Time and doubles](reference/time-and-doubles.md) | `clock`, `mockOf()`, and the doubles ladder                                            |

The disk a subject reads is laid by its chain: `.fixture()`, `.link()` and, for what git cannot carry, `.prepare()` on a CLI ([CLI specs](guides/cli-specs.md#file-state-is-the-shape-of-a-fixture-tree)) and a lint spec ([Lint specs](guides/lint-specs.md)). Every path a test names is spelled with `file()` or `directory()` ([Conventions § The naming recap](concepts/conventions.md#the-naming-recap)).

### Acting on a screen

| Page                                | Holds                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [The visitor](reference/visitor.md) | The verbs (`click`, `fill`, `see` ...), the targets (`button()`, `field()` ...), scoping, and how one element is matched |

### Judging the result

| Page                                  | Holds                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------- |
| [Assertions](reference/assertions.md) | Every result subject and its matchers, goldens, sync and async             |
| [Tokens](reference/tokens.md)         | The `{{token}}` grammar for values that move, `#ref` captures, update mode |

### The rules and the words

| Page                              | Answers                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Linting](reference/linting.md)   | The oxlint plugin, the conventions checker, the ratchet, and the generated catalogue of every rule |
| [Glossary](reference/glossary.md) | The words this manual uses: kind, runner, chain, oracle, golden, ground, seam, ratchet, door       |

The examples use made-up products: `shoply`, a shop CLI; a news app with an events feed; and hosts under `.test` and `.example`, which never resolve on the internet.

## Decisions

The decisions this package alone took are in [`decisions/`](decisions/), numbered in the order they were taken, beside the `_template.md` they follow. Neither [Test](guides/test.md) nor `decisions/` ships in the tarball: from inside an install, read them at <https://github.com/jterrazz/package-test/tree/main/docs>. The API itself is the types the package publishes, and no page restates it: they are browsed as the root `README.md` says, `dist/index.d.ts` first.
