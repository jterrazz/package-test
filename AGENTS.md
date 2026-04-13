# Agent brief — `@jterrazz/test`

Declarative testing framework for APIs and CLIs. One entry point (`spec()`), three targets (`app()`, `stack()`, `command()`).

## Setup

```bash
npm install
```

Requires Docker running for `http(app(...))` and `http(stack(...))` self-tests.

## Commands

| Task                             | Command                               |
| -------------------------------- | ------------------------------------- |
| Run all tests                    | `npm test`                            |
| Run fast tests only (no infra)   | `npx vitest --run tests/cli/`         |
| Build the bundle                 | `npm run build`                       |
| Lint + format + typecheck + knip | `npm run lint`                        |
| Auto-fix lint issues             | `npm run lint:fix`                    |
| Generate API docs + llms.txt     | `npm run docs` (or `make docs`)       |

## Repo layout

```
src/
├── index.ts                       # public entry — re-exports everything
├── runner/                        # spec() + target factories (app, stack, command)
│   ├── spec.ts                    # spec() entry point — dispatches to targets
│   └── targets.ts                 # app(), stack(), command() factories
├── builder/                       # core domain — fluent builder + result accessors
│   ├── specification-builder.ts   # SpecificationBuilder + createSpecificationRunner
│   ├── specification-result.ts    # SpecificationResult + FileAccessor
│   ├── directory-accessor.ts      # directory snapshot assertions
│   ├── table-assertion.ts         # database table assertions
│   └── response-accessor.ts       # HTTP response body assertions
├── ports/                         # all domain contracts (command, database, server, container, service)
├── adapters/                      # all implementations (exec, fetch, hono, testcontainers, compose, postgres, redis)
├── orchestrator/                  # container lifecycle + compose parsing
├── docker/                        # DockerContainerPort + DockerAssertion
├── utilities/                     # reporter, directory walk/diff, grep
└── mocking/                       # mockOf, mockOfDate
tests/
├── http/                          # HTTP-based spec tests (lifecycle, requests, seeding, assertions)
├── cli/                           # CLI-based spec tests (exec, env, directory snapshots)
├── integration/                   # heavier infra tests (container lifecycle, docker)
└── setup/                         # spec runners + shared fixtures
    ├── http.specification.ts      # spec(app(...)) — in-process Hono
    ├── http-compose.specification.ts # spec(stack(...)) — docker compose
    ├── http-runners.ts            # [app, stack] for describe.each
    └── cli.specification.ts       # spec(command(...))
skills/jterrazz-test/SKILL.md     # Claude skill
```

## Conventions

This repo follows the `jterrazz-stack` skill for everything cross-cutting:

- Lint config (`@jterrazz/codestyle` — oxlint + oxfmt + knip + tsc)
- Test writing convention (`// Given —` / `// Then —` comments, always both)
- File naming (`*.test.ts`, `*.integration.test.ts`)
- Directory layout for tests (`seeds/`, `fixtures/`, `requests/`, `responses/`, `expected/`)

## Self-test on changes

This package self-tests via its own framework — the tests under `tests/cli/` use `spec(command(...))` against a fixture CLI app (`tests/setup/fixtures/cli-app/cli.sh`). When you change `SpecificationBuilder` or `DirectoryAccessor`, these are the canonical regression coverage.

## Docs

- `npm run docs` generates API reference + `llms.txt` + `llms-full.txt` to `.docs/`
- CI auto-deploys to GitHub Pages on push to main
- Agent ingestion: <https://jterrazz.github.io/package-test/llms-full.txt>
