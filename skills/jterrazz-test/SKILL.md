---
name: jterrazz-test
description: Mocking utilities for TypeScript testing with vitest using @jterrazz/test. Activates when writing tests, mocking dates, creating deep mocks, or setting up test infrastructure.
---

# @jterrazz/test

Mocking utilities for vitest — date mocking and deep interface mocks.

## Usage

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

### Date mocking

```typescript
import { afterEach } from "vitest";
import { mockOfDate } from "@jterrazz/test";

afterEach(() => {
  mockOfDate.reset();
});

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

  const user = await service.getUser("1");
  expect(user.name).toBe("John");
});
```

## API

| Export        | Description                                         |
| ------------- | --------------------------------------------------- |
| `mockOfDate`  | Date mocking — `set(date)` and `reset()`            |
| `mockOf<T>()` | Deep mock of any interface via vitest-mock-extended |

## Peer dependencies

- `vitest` (required)
- `msw` (optional — for API mocking)
