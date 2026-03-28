---
name: jterrazz-test
description: Mocking utilities and testing conventions for TypeScript projects using @jterrazz/test with vitest. Activates when writing tests, mocking dates, creating deep mocks, or setting up test structure.
---

# @jterrazz/test

Mocking utilities for vitest — date mocking and deep interface mocks.

## Testing conventions

### File structure

```
src/
├── domain/
│   ├── user.ts
│   └── user.test.ts              # Unit — colocated next to source
tests/
├── integration/                   # Tests real wiring (DB, HTTP, DI)
│   ├── api/
│   │   └── list-users.integration.test.ts
│   └── persistence/
│       └── user-repository.integration.test.ts
├── e2e/                           # Full system through public interface
│   └── user-flow.e2e.test.ts
├── fixtures/                      # Shared test data
│   └── users.json
└── helpers/                       # Shared test utilities
    └── setup.ts
```

### File naming

- `thing.test.ts` — unit test (colocated with source)
- `thing.integration.test.ts` — integration test (in `tests/integration/`)
- `thing.e2e.test.ts` — end-to-end test (in `tests/e2e/`)

### package.json

```json
{
  "test": "vitest --run"
}
```

## API

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export | Description |
| --- | --- |
| `mockOfDate` | Date mocking — `set(date)` and `reset()` |
| `mockOf<T>()` | Deep mock of any interface via vitest-mock-extended |

### Date mocking

```typescript
afterEach(() => mockOfDate.reset());

test("fixed date", () => {
    mockOfDate.set(new Date("2024-01-01"));
    expect(new Date()).toEqual(new Date("2024-01-01"));
});
```

### Deep mocking

```typescript
interface UserService {
    getUser: (id: string) => Promise<{ id: string; name: string }>;
}

test("mock service", async () => {
    const service = mockOf<UserService>();
    service.getUser.mockResolvedValue({ id: "1", name: "John" });
    expect((await service.getUser("1")).name).toBe("John");
});
```

## Peer dependencies

- `vitest` (required)
- `msw` (optional — for API mocking)
