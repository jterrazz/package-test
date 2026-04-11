# `integration()` mode

Starts real containers via testcontainers; the app runs **in-process** via a Hono adapter. Fastest feedback loop when the code under test is a Hono app hitting real databases.

## Setup

```typescript
// tests/setup/integration.specification.ts
import { afterAll } from "vitest";
import { integration, postgres } from "@jterrazz/test";
import { createApp } from "../../src/app.js";

const db = postgres({ compose: "db" });

export const spec = await integration({
  services: [db],
  app: () => createApp({ databaseUrl: db.connectionString }),
  root: "../../",
});

afterAll(() => spec.cleanup());
```

## Writing a test

```typescript
// tests/e2e/users/users.e2e.test.ts
import { test, expect } from "vitest";
import { spec } from "../../setup/integration.specification.js";

test("creates a user", async () => {
  // Given — one existing user
  const result = await spec("creates user")
    .seed("initial-users.sql")
    .post("/users", "new-user.json")
    .run();

  // Then — user created
  expect(result.status).toBe(201);
  await result.table("users").toMatch({
    columns: ["name"],
    rows: [["Alice"], ["Bob"]],
  });
});
```

## When to use this mode

- **Use `integration()`** when your service is a Hono app and you want the fastest loop against real DBs.
- **Use [`e2e()`](./e2e)** if your service is in another language or you need real HTTP and the full deployed stack.
- **Use [`cli()`](./cli)** if you're testing a CLI binary.

## See also

- [`integration()` API reference](/reference/functions/integration)
- [`postgres()`](/reference/functions/postgres), [`redis()`](/reference/functions/redis) — service factories
- [`SpecificationBuilder`](/reference/interfaces/SpecificationBuilder) — the full builder API
