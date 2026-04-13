# Agent brief — `@jterrazz/test`

Declarative testing framework for APIs and CLIs. One entry point (`spec()`), three targets (`app()`, `stack()`, `command()`).

## Setup

```bash
npm install
```

Requires Docker running for HTTP and adapter tests.

## Commands

| Task                             | Command                         |
| -------------------------------- | ------------------------------- |
| Run all tests                    | `npm test`                      |
| Run fast tests only (no infra)   | `npx vitest --run tests/cli/`   |
| Build the bundle                 | `npm run build`                 |
| Lint + format + typecheck + knip | `npm run lint`                  |
| Auto-fix lint issues             | `npm run lint:fix`              |
| Generate API docs + llms.txt     | `npm run docs` (or `make docs`) |

## Repo layout

```
src/
├── index.ts                       # public entry — re-exports everything
├── runner/                        # spec() + target factories (app, stack, command)
│   ├── spec.ts                    # spec() entry point — dispatches to targets
│   └── targets.ts                 # app(), stack(), command() factories
├── builder/                       # core domain — fluent builder + result accessors
├── ports/                         # all domain contracts
├── adapters/                      # all implementations (exec, fetch, hono, testcontainers, compose, postgres, redis)
├── orchestrator/                  # container lifecycle + compose parsing
├── docker/                        # DockerContainerPort + DockerAssertion
├── utilities/                     # reporter, directory walk/diff, grep
└── mocking/                       # mockOf, mockOfDate
tests/
├── http/                          # HTTP spec tests (run with both app and stack targets via SPEC_RUNNER env)
├── cli/                           # CLI spec tests (exec, env, directory snapshots)
├── adapters/                      # adapter tests (postgres, redis, orchestrator, container-logs)
└── setup/
    ├── http-spec.ts               # shared HTTP spec (app or stack based on SPEC_RUNNER)
    ├── cli.specification.ts       # spec(command(...))
    └── fixtures/                  # test apps, CLI fixtures
```

## Test runner modes

HTTP tests run against **two targets** via the vitest workspace:

- `http-app` — in-process Hono via `spec(app(...))` with testcontainers
- `http-stack` — docker compose via `spec(stack(...))` with `SPEC_RUNNER=stack`

Same test code, two execution strategies. The `http-spec.ts` setup file switches based on `SPEC_RUNNER` env var.

## Conventions

- Lint config (`@jterrazz/codestyle` — oxlint + oxfmt + knip + tsc)
- Test writing convention (`// Given —` / `// Then —` comments, always both)
- Directory layout for tests (`seeds/`, `fixtures/`, `requests/`, `responses/`, `expected/`)

## Self-test on changes

This package self-tests via its own framework. Tests under `tests/cli/` use `spec(command(...))` against a fixture CLI app. When you change `SpecificationBuilder` or `DirectoryAccessor`, these are the canonical regression coverage.

## Docs

- `npm run docs` generates API reference + `llms.txt` + `llms-full.txt` to `.docs/`
- CI auto-deploys to GitHub Pages on push to main
- Agent ingestion: <https://jterrazz.github.io/package-test/llms-full.txt>
