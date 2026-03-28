# @jterrazz/test

Testing framework for the @jterrazz ecosystem — declarative Docker infrastructure, specification runners, and conventions that all projects follow.

## Installation

```bash
npm install -D @jterrazz/test vitest
```

Requires Docker.

## Specification runners

Declare services, provide an app factory, the framework starts containers and wires everything.

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

### Usage

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
```

After `await integration()`, service handles have `.connectionString` populated from running containers.

## Docker convention

```
docker/
├── compose.test.yaml           # Source of truth for test infrastructure
├── postgres/
│   └── init.sql                # Auto-run on container start
```

## Builder API

**Setup:** `.seed("file.sql")`, `.mock("file.json")`

**Action:** `.get(path)`, `.post(path, "body.json")`, `.put(path, "body.json")`, `.delete(path)`

**Assertions:** `.expectStatus(code)`, `.expectResponse("file.json")`, `.expectTable(table, { columns, rows })`

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
│           ├── requests/
│           └── responses/
└── e2e/
    ├── e2e.specification.ts
    └── api/...
```

## Test data (colocated per test)

| Folder       | Purpose                            |
| ------------ | ---------------------------------- |
| `seeds/`     | Database state setup               |
| `mock/`      | Mocked external API responses      |
| `requests/`  | Request bodies                     |
| `responses/` | Expected API responses             |
| `expected/`  | Expected output to compare against |

## File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

## Mocking utilities

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export        | Description                              |
| ------------- | ---------------------------------------- |
| `mockOfDate`  | Date mocking — `set(date)` and `reset()` |
| `mockOf<T>()` | Deep mock of any interface               |
