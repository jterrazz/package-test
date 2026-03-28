# @jterrazz/test

Testing framework for the @jterrazz ecosystem — conventions, structure, and utilities that all projects follow.

## Philosophy

Every @jterrazz project tests the same way. This package provides the shared utilities and defines the conventions so testing is consistent across the entire ecosystem.

## Installation

```bash
npm install -D @jterrazz/test vitest
```

Optional — for API mocking:

```bash
npm install -D msw
```

## Test structure

```
src/
├── domain/
│   ├── user.ts
│   └── user.test.ts                  # Unit — colocated next to source
tests/
├── integration/                       # Real wiring (DB, HTTP, DI)
│   ├── api/
│   │   └── list-users.integration.test.ts
│   └── persistence/
│       └── user-repository.integration.test.ts
├── e2e/                               # Full system through public interface
│   └── user-flow.e2e.test.ts
├── fixtures/                          # Shared test data
│   └── users.json
└── helpers/                           # Shared test utilities
    └── setup.ts
```

## File naming

| Type | Suffix | Location |
| --- | --- | --- |
| Unit | `.test.ts` | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/` |
| E2E | `.e2e.test.ts` | `tests/e2e/` |

## Utilities

### Date mocking

```typescript
import { afterEach } from "vitest";
import { mockOfDate } from "@jterrazz/test";

afterEach(() => mockOfDate.reset());

test("fixed date", () => {
    mockOfDate.set(new Date("2024-01-01"));
    expect(new Date()).toEqual(new Date("2024-01-01"));
});
```

### Deep mocking

```typescript
import { mockOf } from "@jterrazz/test";

interface UserService {
    getUser: (id: string) => Promise<{ id: string; name: string }>;
}

test("mock service", async () => {
    const service = mockOf<UserService>();
    service.getUser.mockResolvedValue({ id: "1", name: "John" });
    expect((await service.getUser("1")).name).toBe("John");
});
```

## API

| Export | Description |
| --- | --- |
| `mockOfDate` | Date mocking — `set(date)` and `reset()` |
| `mockOf<T>()` | Deep mock of any interface via vitest-mock-extended |

## Peer dependencies

- `vitest` (required)
- `msw` (optional — API mocking)
