# Agent brief - `@jterrazz/test`

Declarative testing framework for APIs and CLIs. One entry point (`spec()`), three targets (`app()`, `stack()`, `command()`).

## Setup

```bash
npm install
```

Requires Docker running for HTTP and adapter tests.

## Commands

| Task                             | Command                           |
| -------------------------------- | --------------------------------- |
| Run all tests                    | `npm test`                        |
| Run fast tests only (no infra)   | `npx vitest --run tests/command/` |
| Build the bundle                 | `npm run build`                   |
| Lint + format + typecheck + knip | `npm run lint`                    |
| Auto-fix lint issues             | `npm run lint:fix`                |
| Generate API docs + llms.txt     | `npm run docs` (or `make docs`)   |

## Repo layout

```
src/
├── index.ts                       # public entry - re-exports everything
├── spec/                          # spec() entry point + targets (app, stack, command)
├── builder/
│   ├── common/                    # universal: .seed(), .intercept(), .env(), result accessors
│   │   └── intercept/             # MSW-based HTTP interception
│   │       └── adapters/          # openai, anthropic, http providers
│   ├── http/                      # HTTP-only: .get(), .post(), .headers() + adapters
│   └── command/                    # command-only: .exec(), .spawn(), .project() + adapters
├── infra/                         # container lifecycle (orchestrator, compose, testcontainers)
│   ├── ports/                     # container, service, isolation interfaces
│   └── adapters/                  # compose + testcontainers implementations
├── adapters/                      # database/cache service adapters (postgres, redis, sqlite)
│   └── ports/                     # database port interface
├── docker/                        # container introspection + assertions
└── mock/                          # mockOf, mockOfDate
tests/
├── http/                          # HTTP spec tests (run with both app and stack targets via SPEC_RUNNER env)
├── command/                       # command spec tests (exec, env, directory snapshots)
├── adapters/                      # adapter tests (postgres, redis, orchestrator, container-logs)
└── setup/
    ├── http-spec.ts               # shared HTTP spec (app or stack based on SPEC_RUNNER)
    ├── command.specification.ts   # spec(command(...))
    └── fixtures/                  # test apps, command fixtures
```

## Test runner modes

HTTP tests run against **two targets** via the vitest workspace:

- `http-app` - in-process Hono via `spec(app(...))` with testcontainers
- `http-stack` - docker compose via `spec(stack(...))` with `SPEC_RUNNER=stack`

Same test code, two execution strategies. The `http-spec.ts` setup file switches based on `SPEC_RUNNER` env var.

## Conventions

- Lint config (`@jterrazz/typescript` - oxlint + oxfmt + knip + tsgo)
- Test writing convention (`// Given -` / `// Then -` comments, always both)
- Directory layout for tests (`seeds/`, `fixtures/`, `requests/`, `responses/`, `expected/`)

## Self-test on changes

This package self-tests via its own framework. Tests under `tests/command/` use `spec(command(...))` against a fixture CLI app. When you change `SpecificationBuilder` or `DirectoryAccessor`, these are the canonical regression coverage.

## Docs

- `npm run docs` generates API reference + `llms.txt` + `llms-full.txt` to `.docs/`
- CI auto-deploys to GitHub Pages on push to main
- Agent ingestion: <https://jterrazz.github.io/package-test/llms-full.txt>
