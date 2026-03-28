# @jterrazz/test

Testing framework for the @jterrazz ecosystem — conventions, specification runners, and utilities that all projects follow.

## Installation

```bash
npm install -D @jterrazz/test vitest
```

Optional — for API mocking in specification runners:

```bash
npm install -D msw
```

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
│   ├── e2e.specification.ts
│   └── api/
│       └── ...
└── helpers/
```

## File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

## Test data

Each test owns its data in colocated subfolders:

| Folder       | Use when                                |
| ------------ | --------------------------------------- |
| `seeds/`     | Database state setup                    |
| `mock/`      | Mocked external API responses           |
| `inputs/`    | Request bodies or data fed in           |
| `responses/` | Expected API responses from your system |
| `expected/`  | Expected output to compare against      |

## Specification runners

Fluent builders for integration and e2e tests. One setup file per test type, all tests share it.

### Integration (in-process, fast)

```typescript
// tests/integration/integration.specification.ts
import { integration } from "@jterrazz/test";
import { PrismaAdapter } from "@jterrazz/test";
import { app } from "../../src/app.js";
import { prisma } from "../../src/database.js";

export const spec = integration({
  database: new PrismaAdapter(prisma),
  app, // Hono instance — requests are in-process, no HTTP
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
import { PrismaAdapter } from "@jterrazz/test";
import { prisma } from "../../src/database.js";

export const spec = e2e({
  database: new PrismaAdapter(prisma),
  url: "http://localhost:3000", // Real running server
});
```

Same builder API — only the setup differs.

### Builder API

**Setup** (before `.run()`):

| Method               | Reads from | Description                           |
| -------------------- | ---------- | ------------------------------------- |
| `.seed("file.sql")`  | `seeds/`   | Execute SQL against database          |
| `.mock("file.json")` | `mock/`    | Register MSW handler for external API |

**Action** (triggers the request):

| Method                     | Reads from | Description    |
| -------------------------- | ---------- | -------------- |
| `.get(path)`               | —          | GET request    |
| `.post(path, "file.json")` | `inputs/`  | POST with body |
| `.put(path, "file.json")`  | `inputs/`  | PUT with body  |
| `.delete(path)`            | —          | DELETE request |

**Assertions** (after `.run()`):

| Method                                   | Reads from   | Description                |
| ---------------------------------------- | ------------ | -------------------------- |
| `.expectStatus(code)`                    | —            | Check HTTP status          |
| `.expectResponse("file.json")`           | `responses/` | Deep compare response body |
| `.expectTable(table, { columns, rows })` | —            | Query DB and compare rows  |

## Ports

Plug in your stack by implementing the database port:

```typescript
interface DatabasePort {
  seed(sql: string): Promise<void>;
  query(table: string, columns: string[]): Promise<unknown[][]>;
  reset(): Promise<void>;
}
```

Built-in adapter: `PrismaAdapter`.

## Mocking utilities

For unit tests:

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export        | Description                              |
| ------------- | ---------------------------------------- |
| `mockOfDate`  | Date mocking — `set(date)` and `reset()` |
| `mockOf<T>()` | Deep mock of any interface               |

## Peer dependencies

- `vitest` (required)
- `msw` (optional — for `.mock()`)
- `@prisma/client` (optional — for `PrismaAdapter`)
