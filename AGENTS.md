# Agent brief — `@jterrazz/test`

A declarative testing framework for HTTP APIs, background jobs, CLIs, rendered websites and native mobile apps, plus the oxlint plugin and checker that enforce its conventions. This file **routes**; it never restates what the corpus already says.

## Mental model

- **Six constructors, and only six.** `specification.api()`, `.job()`, `.cli()`, `.integration()`, `.website()`, `.mobile()` — each returns a handle, each chain is zero or more setups closed by exactly ONE terminal action, and every assertion goes through vitest's `expect()`. A seventh subject is a decision before it is a constructor, and `component` is the one facet that is a chain rather than a constructor.
- **The root reads the sentence of a test.** `src/` holds the two entries (`index.ts`, `index.browser.ts`), `vitest/`, and the trees `facets/`, `world/`, `elements/`, `expectations/`, `kernel/`; `lint/` sits at the repository root beside it. The edges point one way. The map, its edges and the passes that hold it: [01 § The source trees](docs/01-architecture.md#the-source-trees); the declaration: `lint/self-layers.ts`.
- **The code owns the rules.** A mechanized rule's normative sentence lives in `lint/manifest.ts` beside its implementation — in `lint/self-manifest.ts` for a rule only this package is held to, which no published entry imports — and the catalogue is GENERATED from it. Add a rule to the manifest, never to a chapter.
- **The package specifies itself with itself.** `specs/` is written with `@jterrazz/test` against fixture apps, and a family of meta-tests runs the framework on its own output.
- **The build precedes the lint.** `oxlint.config.ts` and the lint specs load `./dist/oxlint.js`, so `make build` comes first — always.

## Where knowledge lives (route here first)

The corpus is `docs/` + `README.md`, mapped by [`docs/README.md`](docs/README.md). Do not duplicate it — link to it.

| Developing the package…                           | Read                                                           |
| ------------------------------------------------- | -------------------------------------------------------------- |
| The layers, the runner model, the channels        | [`docs/01-architecture.md`](docs/01-architecture.md)           |
| The loop, which file a change opens, what it owes | [`docs/02-developing.md`](docs/02-developing.md)               |
| The projects, the spec tree, the meta-tests       | [`docs/03-testing.md`](docs/03-testing.md)                     |
| The npm release and what ships                    | [`docs/04-operating.md`](docs/04-operating.md)                 |
| The principles, and what review must judge        | [`docs/18-conventions.md`](docs/18-conventions.md)             |
| Rule ids, channels, the generated catalogue       | [`docs/19-linting.md`](docs/19-linting.md)                     |
| Anything else: a facet, the vocabulary, stubs, …  | [`docs/README.md`](docs/README.md), which owns the chapter map |

Decisions this package alone took are in `docs/decisions/`. The agent-facing skill is `skills/jterrazz-test/SKILL.md` — a short, hand-written routing page, not a second copy.

## Setup & commands

```bash
make install                      # the dependencies
make build                        # MUST precede lint and the unit project
make lint                         # the static verdict — what it runs is docs/02-developing.md's make table
make fix                          # the fixers: the checker's --fix, then typescript fix (the formatter last), each whatever the other said
make test                         # every project, with coverage — needs Docker and chromium
make check                        # the whole verdict: build, lint, test
make test-mobile                  # the mobile specs on a real iOS simulator — never in check, needs Xcode
make test-changed                 # only the tests the uncommitted changes reach — the loop, never a verdict, no route ratchet
make test SHARD=1/3               # one shard, with its blob report; make test-merge judges the floor and the routes on them all
npx vitest --run --project unit   # the loop, no infrastructure
npm run docs                      # regenerate the generated tables and the schema
```

## Standing rules

- **A discovery grows a guard, in the same change** (rule K1) — see [02 § What a change owes](docs/02-developing.md#what-a-change-owes).
- **Never edit a generated table** — `npm run docs` writes them; see [02 § What a change owes](docs/02-developing.md#what-a-change-owes).
- **What lands with the change that makes it true** — the guard, the regenerated tables, the falsified chapter, the skill — is stated once, in [02 § What a change owes](docs/02-developing.md#what-a-change-owes).
- **A rule belongs in the code, a principle in the constitution.** `lint/manifest.ts` (or `lint/self-manifest.ts`) for the first, `docs/18-conventions.md` for the second; neither ever holds a copy of the other.
