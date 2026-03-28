---
name: jterrazz-test
description: Testing framework for the @jterrazz ecosystem — defines how all projects test. Conventions, specification runners with automatic infrastructure, and mocking utilities. Activates when writing tests, setting up test structure, or configuring specification runners.
---

# @jterrazz/test

Part of the @jterrazz ecosystem. Defines how all projects test.

## Test structure

```
tests/
├── setup/                                         # Infrastructure (Docker, DB, migrations)
├── fixtures/                                      # Shared fake things to test against
├── helpers/                                       # Shared test utilities
├── integration/
│   ├── integration.specification.ts               # Runner config
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

## Specification runners

### Integration (in-process, fast)

```typescript
// tests/integration/integration.specification.ts
import { afterAll } from "vitest";
import { integration, postgres } from "@jterrazz/test";
import { createApp } from "../../src/app.js";

const db = postgres({ compose: "db" });

export const spec = await integration({
  services: [db],
  app: () => createApp({ databaseUrl: db.connectionString }),
});

afterAll(() => spec.cleanup());
```

### E2E (real HTTP, automatic server)

```typescript
// tests/e2e/e2e.specification.ts
import { afterAll } from "vitest";
import { e2e, postgres } from "@jterrazz/test";
import { createApp } from "../../src/app.js";

const db = postgres({ compose: "db" });

export const spec = await e2e({
  services: [db],
  app: () => createApp({ databaseUrl: db.connectionString }),
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
postgres({ compose: "db" }); // Links to docker-compose.test.yaml service
redis({ compose: "cache" });
```

After `await integration()`, service handles have `.connectionString` populated.

## Docker compose convention

```
docker/
├── compose.test.yaml                # Auto-detected by framework
├── postgres/
│   └── init.sql                     # Auto-run on container start
```

## Builder methods

**Setup:** `.seed("file.sql")`, `.mock("file.json")`
**Action:** `.get(path)`, `.post(path, "body.json")`, `.put(path, "body.json")`, `.delete(path)`
**Assertions:** `.expectStatus(code)`, `.expectResponse("file.json")`, `.expectTable(table, { columns, rows })`

## Folder conventions

| Folder              | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `tests/setup/`      | Infrastructure — Docker, DB init, migrations   |
| `tests/fixtures/`   | Shared fake things to test against             |
| `tests/helpers/`    | Shared test utilities                          |
| `{test}/seeds/`     | Database state setup (colocated)               |
| `{test}/mock/`      | Mocked external API responses (colocated)      |
| `{test}/requests/`  | Request bodies (colocated)                     |
| `{test}/responses/` | Expected API responses (colocated)             |
| `{test}/expected/`  | Expected output to compare against (colocated) |

## Mocking utilities

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export        | Description                              |
| ------------- | ---------------------------------------- |
| `mockOfDate`  | Date mocking — `set(date)` and `reset()` |
| `mockOf<T>()` | Deep mock of any interface               |
