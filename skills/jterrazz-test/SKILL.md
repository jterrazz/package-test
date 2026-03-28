---
name: jterrazz-test
description: Testing framework for the @jterrazz ecosystem — defines how all projects test. Conventions, structure, file naming, data organization, and mocking utilities. Activates when writing tests or setting up test structure.
---

# @jterrazz/test

Testing framework for the @jterrazz ecosystem — conventions, structure, and utilities that all projects follow.

## Test structure

```
src/
├── domain/
│   ├── user.ts
│   └── user.test.ts                          # Unit — colocated next to source

tests/
├── e2e/
│   └── build/
│       ├── build.e2e.test.ts
│       ├── inputs/                            # Raw data fed in
│       └── expected/                          # Expected output
├── integration/
│   ├── api/
│   │   └── list-users/
│   │       ├── list-users.integration.test.ts
│   │       ├── seeds/                         # DB setup
│   │       └── responses/                     # Expected API responses
│   └── persistence/
│       └── user-repository/
│           ├── user-repository.integration.test.ts
│           └── seeds/
└── helpers/                                   # Shared test utilities
```

## File naming

| Type | Suffix | Location |
| --- | --- | --- |
| Unit | `.test.ts` | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/` |
| E2E | `.e2e.test.ts` | `tests/e2e/` |

## Test data folders

Each test owns its data in colocated subfolders. Name folders for what the data represents:

| Folder | Use when |
| --- | --- |
| `inputs/` | Raw data fed into the system under test |
| `expected/` | Expected output to compare against |
| `seeds/` | Database or state setup before test runs |
| `responses/` | Expected API responses from your system |
| `api/` | Mocked external API responses (third-party services) |

File names describe the scenario: `empty.response.json`, `wrong-style.ts`, `with-challenges.seed.ts`.

## Rules

- One folder per test file
- Data colocated with its test, never shared across tests
- No `fixtures/` — name it for what it is
- Unit tests have no I/O — mock everything
- Integration tests use real adapters (DB, HTTP)
- E2E tests run the full system through its public interface

## Utilities

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export | Description |
| --- | --- |
| `mockOfDate` | Date mocking — `set(date)` and `reset()` |
| `mockOf<T>()` | Deep mock of any interface via vitest-mock-extended |

## Peer dependencies

- `vitest` (required)
- `msw` (optional — for mocking external APIs in integration tests)
