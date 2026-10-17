# Agent brief: `@jterrazz/test`

A declarative testing framework for HTTP APIs, background jobs, CLIs, rendered websites, native mobile apps and the rules a project ships, plus the oxlint plugin and checker that enforce its conventions. This file **routes**; it never restates what the corpus already says.

## Mental model

- **Seven constructors, and only seven.** `specification.api()`, `.job()`, `.cli()`, `.integration()`, `.website()`, `.mobile()`, `.lint()`. Each returns a handle, each chain is zero or more setups closed by exactly ONE terminal action, and every assertion goes through vitest's `expect()`. An eighth subject is a decision before it is a constructor, and `component` is the one specification that is a chain rather than a constructor.
- **The root reads the sentence of a test.** `src/` holds the entries (`index.ts`, `index.services.ts` and `index.stubs.ts`, each with its `.browser.ts` twin, and `index.vitest.ts`) and their tests in `__tests__/`, `vitest/`, and the trees of a test's sentence: `specifications/`, `visitor/`, `expectations/`, the notions around the subject (`stubs/`, `services/`, `disk/`, `clock/`, `mocks/`) and `chain/`, the machinery that composes them; `lint/` sits at the repository root beside it. The edges point one way. The map, its edges and the passes that hold it: [Architecture § The source trees](docs/concepts/architecture.md#the-source-trees); the declaration: `lint/self/checks/layers.ts`.
- **The code owns the rules.** A mechanized rule's normative sentence lives in `lint/consumer/catalogue/manifest.ts` beside its implementation (in `lint/self/catalogue/manifest.ts` for a rule only this package is held to, which no published entry imports), and the catalogue is GENERATED from it. Add a rule to the manifest, never to a page.
- **The package specifies itself with itself.** `specs/` is written with `@jterrazz/test` against fixture apps, and a family of meta-tests runs the framework on its own output.
- **The build precedes the lint.** `oxlint.config.ts` and the lint specs load `./dist/oxlint.js`, so `make build` always comes first.

## Where knowledge lives (route here first)

The corpus is `docs/` + `README.md`, mapped by [`docs/README.md`](docs/README.md). Do not duplicate it; link to it.

| Developing the package...                                  | Read                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| The layers, the runner model, the channels                 | [`docs/concepts/architecture.md`](docs/concepts/architecture.md)                                                                     |
| The loop, which file a change opens, what it owes          | [`docs/guides/develop.md`](docs/guides/develop.md)                                                                                   |
| The projects, the spec tree, the meta-tests                | [`docs/guides/test.md`](docs/guides/test.md)                                                                                         |
| The npm release and what ships                             | [`docs/guides/release.md`](docs/guides/release.md)                                                                                   |
| What a consumer installs, configures, writes first         | [`docs/start/getting-started.md`](docs/start/getting-started.md), [`docs/start/set-up-a-project.md`](docs/start/set-up-a-project.md) |
| The principles, and what review must judge                 | [`docs/concepts/conventions.md`](docs/concepts/conventions.md)                                                                       |
| Rule ids, channels, the generated catalogue                | [`docs/reference/linting.md`](docs/reference/linting.md)                                                                             |
| Anything else: a specification, the vocabulary, stubs, ... | [`docs/README.md`](docs/README.md), which owns the map of the pages                                                                  |

Decisions this package alone took are in `docs/decisions/`. The agent-facing skill is `skills/jterrazz-test/SKILL.md`, a short, hand-written routing page, not a second copy.

## Setup & commands

What each target runs is [Develop § The loop](docs/guides/develop.md#the-loop)'s.

```bash
make install                      # the dependencies
make build                        # MUST precede lint and the unit project
make lint                         # the static verdict
make fix                          # the fixers
make test                         # every suite; needs Docker and chromium
make check                        # the whole verdict: build, lint, test, mutation
make test-mobile                  # the mobile specs; needs Xcode
make test-changed                 # the loop over what changed
make test SHARD=1/3               # one shard of a split run
npx vitest --run --project unit   # the loop, no infrastructure
npm run docs                      # regenerate the generated tables and the schema
```

## Standing rules

- **A discovery grows a guard, in the same change** (rule `discovery-grows-a-guard`): see [Develop § What a change owes](docs/guides/develop.md#what-a-change-owes).
- **Never edit a generated table.** `npm run docs` writes them; see [Develop § What a change owes](docs/guides/develop.md#what-a-change-owes).
- **What lands with the change that makes it true** (the guard, the regenerated tables, the falsified page, the skill) is stated once, in [Develop § What a change owes](docs/guides/develop.md#what-a-change-owes).
- **A rule belongs in the code, a principle in the constitution.** `lint/consumer/catalogue/manifest.ts` (or `lint/self/catalogue/manifest.ts`) for the first, `docs/concepts/conventions.md` for the second; neither ever holds a copy of the other.
