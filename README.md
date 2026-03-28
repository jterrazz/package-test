# @jterrazz/test

Testing framework for the @jterrazz ecosystem — conventions, specification runners, and utilities that all projects follow.

## Installation

```bash
npm install -D @jterrazz/test vitest
```

## Test structure

```
src/
├── domain/
│   ├── user.ts
│   └── user.test.ts                              # Unit — colocated

tests/
├── setup/                                         # Infrastructure (Docker, DB, migrations)
│   └── database.ts
├── fixtures/                                      # Shared fake things to test against
│   └── app/
├── helpers/                                       # Shared test utilities
├── integration/
│   ├── integration.specification.ts               # Runner config
│   └── api/
│       └── analyze-company/
│           ├── analyze-company.integration.test.ts
│           ├── seeds/
│           ├── mock/
│           ├── requests/
│           └── responses/
└── e2e/
    ├── e2e.specification.ts                       # Runner config
    └── api/
        └── ...
```

## File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

## Folder conventions

| Folder              | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `tests/setup/`      | Infrastructure — Docker, DB init, migrations                   |
| `tests/fixtures/`   | Shared fake things to test against (sample apps, mock servers) |
| `tests/helpers/`    | Shared test utilities                                          |
| `{test}/seeds/`     | Database state setup (colocated)                               |
| `{test}/mock/`      | Mocked external API responses (colocated)                      |
| `{test}/requests/`  | Request bodies (colocated)                                     |
| `{test}/responses/` | Expected API responses (colocated)                             |
| `{test}/expected/`  | Expected output to compare against (colocated)                 |

## Specification runners

Fluent builders for integration and e2e tests.

### Integration (in-process, fast)

```typescript
// tests/integration/integration.specification.ts
import { integration, PrismaAdapter } from "@jterrazz/test";

export const spec = integration({
  database: new PrismaAdapter(prisma),
  app, // Hono instance
});
```

### E2E (real HTTP)

```typescript
// tests/e2e/e2e.specification.ts
import { e2e, PrismaAdapter } from "@jterrazz/test";

export const spec = e2e({
  database: new PrismaAdapter(prisma),
  url: "http://localhost:3000",
});
```

### Usage

```typescript
import { spec } from "../integration.specification.js";

test("creates company", async () => {
  const result = await spec("creates company")
    .seed("transactions.sql")
    .mock("inpi-success.json")
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

### Builder API

**Setup:** `.seed("file.sql")`, `.mock("file.json")`

**Action:** `.get(path)`, `.post(path, "body.json")`, `.put(path, "body.json")`, `.delete(path)`

**Assertions:** `.expectStatus(code)`, `.expectResponse("file.json")`, `.expectTable(table, { columns, rows })`

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
