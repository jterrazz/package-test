# @jterrazz/test

Testing framework for the @jterrazz ecosystem — conventions, structure, and utilities that all projects follow.

## Installation

```bash
npm install -D @jterrazz/test vitest
```

Optional — for mocking external APIs:

```bash
npm install -D msw
```

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
│       ├── inputs/
│       └── expected/
├── integration/
│   ├── api/
│   │   └── list-users/
│   │       ├── list-users.integration.test.ts
│   │       ├── seeds/
│   │       └── responses/
│   └── persistence/
│       └── user-repository/
│           ├── user-repository.integration.test.ts
│           └── seeds/
└── helpers/
```

## File naming

| Type | Suffix | Location |
| --- | --- | --- |
| Unit | `.test.ts` | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/` |
| E2E | `.e2e.test.ts` | `tests/e2e/` |

## Test data

Each test owns its data in colocated subfolders:

| Folder | Use when |
| --- | --- |
| `inputs/` | Raw data fed into the system under test |
| `expected/` | Expected output to compare against |
| `seeds/` | Database or state setup before test runs |
| `responses/` | Expected API responses from your system |
| `api/` | Mocked external API responses (third-party) |

File names describe the scenario: `empty.response.json`, `wrong-style.ts`, `with-challenges.seed.ts`.

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
