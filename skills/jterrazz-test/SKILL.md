---
name: jterrazz-test
description: Testing framework for the @jterrazz ecosystem — declarative service factories, Docker-based infrastructure, specification runners, and mocking utilities. Activates when writing tests, setting up test infrastructure, or configuring specification runners.
---

# @jterrazz/test

Part of the @jterrazz ecosystem. Defines how all projects test.

## Specification runners

Two modes, same test API. Declare services, provide an app factory, the framework handles containers and wiring.

### Integration (testcontainers, in-process app)

```typescript
// tests/integration/integration.specification.ts
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

### E2E (docker compose up, real HTTP)

```typescript
// tests/e2e/e2e.specification.ts
import { afterAll } from "vitest";
import { e2e } from "@jterrazz/test";

export const spec = await e2e({
  root: "../../",
});

afterAll(() => spec.cleanup());
```

### Test usage

```typescript
import { spec } from "../integration.specification.js";

test("creates company", async () => {
  const result = await spec("creates company")
    .seed("transactions.sql")
    .post("/api/analyze", "request.json")
    .run();

  result.expectStatus(201);
  result.expectResponse("created.response.json");
  await result.expectTable("company_profile", {
    columns: ["name"],
    rows: [["TEST COMPANY"]],
  });
});
```

## Service factories

```typescript
import { postgres, redis } from "@jterrazz/test";

const db = postgres({ compose: "db" }); // Reads config from docker/compose.test.yaml
const cache = redis({ compose: "cache" });

// After await integration(), handles have .connectionString populated
db.connectionString; // postgresql://test:test@localhost:54321/test
cache.connectionString; // redis://localhost:63791
```

## Docker convention

```
docker/
├── compose.test.yaml           # Source of truth for test infrastructure
├── postgres/
│   └── init.sql                # Auto-run on container start
```

## Test structure

```
tests/
├── setup/                      # Infrastructure (DB init, Docker config)
├── fixtures/                   # Shared fake things to test against
├── helpers/                    # Shared test utilities
├── integration/
│   ├── integration.specification.ts
│   └── api/
│       └── {feature}/
│           ├── {feature}.integration.test.ts
│           ├── seeds/
│           ├── mock/
│           ├── requests/
│           └── responses/
└── e2e/
    ├── e2e.specification.ts
    └── api/...
```

## File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

## Test data (colocated per test)

| Folder       | Purpose                            |
| ------------ | ---------------------------------- |
| `seeds/`     | Database state setup               |
| `mock/`      | Mocked external API responses      |
| `requests/`  | Request bodies                     |
| `responses/` | Expected API responses             |
| `expected/`  | Expected output to compare against |

## Test writing convention

Use `// Given`, `// When`, `// Then` comments to structure non-trivial tests:

```typescript
test("creates a user and returns 201", async () => {
  // Given — two existing users
  const result = await spec("creates user")
    .seed("initial-users.sql")
    .post("/users", "new-user.json")
    .run();

  // Then — user created with all three in table
  result.expectStatus(201);
  await result.expectTable("users", {
    columns: ["name"],
    rows: [["Alice"], ["Bob"], ["Charlie"]],
  });
});
```

Rules:

- `// Given —` setup context, one short phrase
- `// When —` only if the action isn't obvious
- `// Then —` what we verify, one short phrase
- Skip on trivial tests (single assertion, name says it all)
- No `// When` for spec builder — `.seed().post().run()` IS the when

## Builder methods

**Setup:** `.seed("file.sql")`, `.mock("file.json")`
**Action:** `.get(path)`, `.post(path, "body.json")`, `.put(path, "body.json")`, `.delete(path)`
**Assertions:** `.expectStatus(code)`, `.expectResponse("file.json")`, `.expectTable(table, { columns, rows })`

## Mocking utilities (unit tests)

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export        | Description                              |
| ------------- | ---------------------------------------- |
| `mockOfDate`  | Date mocking — `set(date)` and `reset()` |
| `mockOf<T>()` | Deep mock of any interface               |

## Requirements

- Docker (testcontainers for integration, docker compose for e2e)
- `vitest` (peer dependency)
