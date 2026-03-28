---
name: jterrazz-test
description: Testing framework for the @jterrazz ecosystem — defines how all projects test. Conventions, structure, specification runners for integration/e2e tests, and mocking utilities. Activates when writing tests, setting up test structure, or configuring specification runners.
---

# @jterrazz/test

Part of the @jterrazz ecosystem. Defines how all projects test.

## Test structure

```
src/
├── domain/
│   ├── user.ts
│   └── user.test.ts                              # Unit — colocated

tests/
├── integration/
│   ├── integration.specification.ts               # Shared setup
│   └── api/
│       └── analyze-company/
│           ├── analyze-company.integration.test.ts
│           ├── seeds/
│           │   └── transactions.sql
│           ├── mock/
│           │   └── inpi-success.json
│           ├── inputs/
│           │   └── request.json
│           └── responses/
│               └── created.response.json
├── e2e/
│   ├── e2e.specification.ts                       # Shared setup
│   └── api/
│       └── ...                                    # Same structure
└── helpers/
```

## File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

## Test data folders

| Folder       | Use when                                   |
| ------------ | ------------------------------------------ |
| `seeds/`     | Database state setup                       |
| `mock/`      | Mocked external API responses              |
| `inputs/`    | Request bodies or data fed into the system |
| `responses/` | Expected API responses from your system    |
| `expected/`  | Expected output to compare against         |

## Specification runners

### Integration (in-process, fast)

```typescript
// tests/integration/integration.specification.ts
import { integration } from "@jterrazz/test";
import { PrismaAdapter } from "@jterrazz/test/adapters/prisma";
import { app } from "../../src/app.js";
import { prisma } from "../../src/database.js";

export const spec = integration({
  database: new PrismaAdapter(prisma),
  app,
});
```

```typescript
// tests/integration/api/analyze-company/analyze-company.integration.test.ts
import { spec } from "../../integration.specification.js";

test("creates company from INPI data", async () => {
  await spec(import.meta.dirname, "creates company")
    .seed("transactions.sql")
    .mock("inpi-success.json")
    .post("/api/analyze", "request.json")
    .run()
    .expectStatus(201)
    .expectResponse("created.response.json")
    .expectTable("company_profile", {
      columns: ["identification_number", "user_id", "company_name"],
      rows: [["123456789", "test-user-uuid", "TEST COMPANY SARL"]],
    });
});
```

### E2E (real HTTP, real infra)

```typescript
// tests/e2e/e2e.specification.ts
import { e2e } from "@jterrazz/test";
import { PrismaAdapter } from "@jterrazz/test/adapters/prisma";
import { prisma } from "../../src/database.js";

export const spec = e2e({
  database: new PrismaAdapter(prisma),
  url: "http://localhost:3000",
});
```

Same test API — only the setup differs.

### Builder methods

**Setup:**

- `.seed("file.sql")` — execute SQL from `seeds/`
- `.mock("file.json")` — register MSW handler from `mock/`

**Action:**

- `.get(path)` — GET request
- `.post(path, "file.json")` — POST with body from `inputs/`
- `.put(path, "file.json")` — PUT with body from `inputs/`
- `.delete(path)` — DELETE request

**Assertions (after `.run()`):**

- `.expectStatus(code)` — HTTP status
- `.expectResponse("file.json")` — deep compare with `responses/`
- `.expectTable(table, { columns, rows })` — query DB and compare

## Ports

```typescript
// Implement these to plug in your stack
interface DatabasePort {
  seed(sql: string): Promise<void>;
  query(table: string, columns: string[]): Promise<unknown[][]>;
  reset(): Promise<void>;
}
```

Built-in adapters: `PrismaAdapter`.

## Mocking utilities

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export        | Description                                         |
| ------------- | --------------------------------------------------- |
| `mockOfDate`  | Date mocking — `set(date)` and `reset()`            |
| `mockOf<T>()` | Deep mock of any interface via vitest-mock-extended |

## Peer dependencies

- `vitest` (required)
- `msw` (optional — for `.mock()` in specification runners)
- `@prisma/client` (optional — for PrismaAdapter)
