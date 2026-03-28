---
name: jterrazz-test
description: Testing framework for the @jterrazz ecosystem — declarative service factories, Docker-based infrastructure, specification runners, and mocking utilities. Activates when writing tests, setting up test infrastructure, or configuring specification runners.
---

# @jterrazz/test

Part of the @jterrazz ecosystem. Defines how all projects test.

## Specification runners

Three modes, same test API. The framework handles containers, wiring, and temp directories.

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

### CLI (local command execution)

```typescript
// tests/setup/cli.specification.ts
import { resolve } from "node:path";
import { cli } from "@jterrazz/test";

export const spec = await cli({
  command: resolve(import.meta.dirname, "../../bin/my-cli.sh"),
  root: "../fixtures",
});
```

### API test usage

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

### CLI test usage

```typescript
import { spec } from "../setup/cli.specification.js";

test("builds successfully", async () => {
  const result = await spec("build").project("sample-app").exec("build").run();

  result
    .expectExitCode(0)
    .expectStdoutContains("Build completed")
    .expectFile("dist/index.js")
    .expectNoFile("dist/index.cjs")
    .expectFileContains("dist/index.js", "Hello");
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

- Every test gets `// Given —` and `// Then —` comments. Always both, never one without the other
- `// Given —` setup context, one short phrase
- `// When —` only if the action isn't obvious
- `// Then —` what we verify, one short phrase
- No `// When` for spec builder — `.seed().post().run()` / `.project().exec().run()` IS the when
- Error tests belong in their domain folder (seeding errors in seeding/, not a separate errors/)
- Failure assertions use full `toBe` with exact multiline output (never `toContain`)

## Builder methods

**Setup (cross-mode):** `.seed("file.sql")`, `.seed("file.sql", { service: "name" })`, `.fixture("file")`, `.project("name")`, `.mock("file.json")`
**HTTP action:** `.get(path)`, `.post(path, "body.json")`, `.put(path, "body.json")`, `.delete(path)`
**CLI action:** `.exec("command args")`

### Assertions

**HTTP-specific:** `.expectStatus(code)`, `.expectResponse("file.json")`
**CLI-specific:** `.expectExitCode(code)`, `.expectStdoutContains(str)`, `.expectStderrContains(str)`, `.expectStdout("file.txt")`, `.expectStderr("file.txt")`
**Cross-mode:** `.expectTable(table, { columns, rows, service? })`, `.expectFile(path)`, `.expectNoFile(path)`, `.expectFileContains(path, content)`

### Multi-database support

When multiple databases are declared, `seed()` and `expectTable()` accept an optional `{ service: "name" }` to target a specific database by its compose name. Without `service`, both default to the first postgres.

```typescript
const result = await spec("cross-db")
  .seed("users.sql") // default db
  .seed("events.sql", { service: "analytics-db" }) // analytics db
  .post("/users", "request.json")
  .run();

await result.expectTable("users", { columns: ["name"], rows: [["Alice"]] });
await result.expectTable("events", {
  columns: ["type"],
  rows: [["user_created"]],
  service: "analytics-db",
});
```

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
