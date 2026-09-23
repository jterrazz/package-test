# Agent brief — `@jterrazz/test`

A declarative testing framework for HTTP APIs, background jobs, CLIs, rendered websites and native mobile apps, plus the oxlint plugin and checker that enforce its conventions. This file **routes**; it never restates what the corpus already says.

## Mental model

- **Six constructors, and only six.** `specification.api()`, `.jobs()`, `.cli()`, `.integration()`, `.website()`, `.mobile()` — each returns a handle, each chain is zero or more setups closed by exactly ONE terminal action, and every assertion goes through vitest's `expect()`. A seventh subject is a decision before it is a constructor, and `component` is the one facet that is a chain rather than a constructor.
- **Five trees with declared edges.** Under `src/`: `model/` (what every facet is made of, no external imports), `facets/<facet>/` (the same four files in each), `seams/<dep>/` (one folder per dependency), `runner/` (the config side of the runner coupling); at the root, `lint/` (the rules the package ships, no runtime imports). The map is stated as `FRAMEWORK_LAYERS` in `oxlint.config.ts` and enforced from there.
- **The code owns the rules.** A mechanized rule's normative sentence lives in `lint/manifest.ts` beside its implementation, and the catalogue is GENERATED from it. Add a rule to the manifest, never to a chapter.
- **The package specifies itself with itself.** `specs/` is written with `@jterrazz/test` against fixture apps, and a family of meta-tests runs the framework on its own output.
- **The build precedes the lint.** `oxlint.config.ts` and the lint specs load `./dist/oxlint.js`, so `make build` comes first — always.

## Where knowledge lives (route here first)

The corpus is `docs/` + `README.md`, mapped by [`docs/README.md`](docs/README.md). Do not duplicate it — link to it.

| Working on…                                       | Read                                           |
| ------------------------------------------------- | ---------------------------------------------- |
| The layers, the runner model, the channels        | `docs/01-architecture.md`                      |
| The loop, which file a change opens, what it owes | `docs/02-developing.md`                        |
| The projects, the spec tree, the meta-tests       | `docs/03-testing.md`                           |
| The npm release and what ships                    | `docs/04-operating.md`                         |
| A facet: api · jobs · cli · integration           | `docs/10` · `11` · `12` · `06`                 |
| A facet: website · mobile · component             | `docs/08` · `09` · `07`                        |
| A module test, and the doubles it may build       | `docs/05-module-tests.md`                      |
| The element vocabulary every surface shares       | `docs/13-elements.md`                          |
| Matchers, the `{{token}}` grammar                 | `docs/14-assertions.md` · `docs/15-tokens.md`  |
| Contracts and services                            | `docs/16-contracts.md` · `docs/17-services.md` |
| The principles, and what review must judge        | `docs/18-conventions.md`                       |
| Rule ids, channels, the generated catalogue       | `docs/19-linting.md`                           |

Decisions this package alone took are in `docs/decisions/`. The agent-facing skill is `skills/jterrazz-test/SKILL.md` — a short, hand-written routing page, not a second copy.

## Setup & commands

```bash
make install                      # the dependencies
make build                        # MUST precede lint and the unit project
make lint                         # typescript check + the conventions checker
make fix                          # the fixers: typescript fix, then the checker's --fix, each whatever the other said
make test                         # every project, with coverage — needs Docker and chromium
make check                        # the whole verdict: build, lint, test
npx vitest --run --project unit   # the loop, no infrastructure
npm run docs                      # regenerate the generated tables and the schema
```

## Standing rules

- **A discovery grows a guard, in the same change** (rule K1) — a static rule, a meta-test, or a runtime refusal, or an explicit note of why no channel can hold it.
- **Never edit a generated table.** The catalogue between the `GENERATED:catalog` markers of `docs/19-linting.md`, the other `GENERATED` blocks of the chapters and `schema/spec.schema.json` all come from `npm run docs`. A hand edit fails the freshness meta-test.
- **Four things land with the change that makes them true** — the guard, the regenerated tables, the chapter the behaviour falsified, and the skill when the public surface moved. Each is stated once, in `docs/02-developing.md` § What a change owes.
- **A rule belongs in the code, a principle in the constitution.** `lint/manifest.ts` for the first, `docs/18-conventions.md` for the second; neither ever holds a copy of the other.
