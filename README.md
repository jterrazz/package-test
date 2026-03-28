# @jterrazz/test

Declarative testing framework for APIs and CLIs. Same fluent builder API, three execution modes.

```bash
npm install -D @jterrazz/test vitest
```

## Quick start

### API testing (HTTP)

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

```typescript
// tests/e2e/users/users.e2e.test.ts
import { spec } from "../../setup/integration.specification.js";

test("creates a user", async () => {
  // Given — one existing user
  const result = await spec("creates user")
    .seed("initial-users.sql")
    .post("/users", "new-user.json")
    .run();

  // Then — user created
  result.status.toBe(201);
  await result.table("users").toMatch({
    columns: ["name"],
    rows: [["Alice"], ["Bob"]],
  });
});
```

### CLI testing

```typescript
// tests/setup/cli.specification.ts
import { resolve } from "node:path";
import { cli } from "@jterrazz/test";

export const spec = await cli({
  command: resolve(import.meta.dirname, "../../bin/my-cli.sh"),
  root: "../fixtures",
});
```

```typescript
// tests/e2e/build/build.e2e.test.ts
import { spec } from "../../setup/cli.specification.js";

test("builds the project", async () => {
  // Given — sample app project
  const result = await spec("build").project("sample-app").exec("build").run();

  // Then — ESM output with source maps
  result.exitCode.toBe(0);
  result.stdout.toContain("Build completed");
  result.file("dist/index.js").toExist();
  result.file("dist/index.cjs").not.toExist();
  result.file("dist/index.js").toContain("Hello");
});
```

## Specification runners

Three modes, same builder API. Each handles infrastructure and cleanup automatically.

### `integration()` — testcontainers + in-process app

Starts real containers via testcontainers. App runs in-process (Hono). Fastest feedback loop.

```typescript
import { integration, postgres, redis } from "@jterrazz/test";

const db = postgres({ compose: "db" });
const cache = redis({ compose: "cache" });

export const spec = await integration({
  services: [db, cache],
  app: () => createApp({ databaseUrl: db.connectionString }),
  root: "../../",
});
```

### `e2e()` — docker compose up + real HTTP

Starts the full `docker/compose.test.yaml` stack. App URL and databases auto-detected.

```typescript
import { e2e } from "@jterrazz/test";

export const spec = await e2e({
  root: "../../",
});
```

### `cli()` — local command execution

Runs CLI commands against fixture projects in temp directories. Optionally starts infrastructure.

```typescript
import { cli } from "@jterrazz/test";

export const spec = await cli({
  command: resolve(import.meta.dirname, "../../bin/my-cli.sh"),
  root: "../fixtures",
});

// With infrastructure (CLI that needs a database)
export const spec = await cli({
  command: "my-migrate-tool",
  root: "../fixtures",
  services: [db],
});
```

## Builder API

Every test follows the same pattern: `spec("label") → setup → action → assertions`.

### Setup (cross-mode)

| Method                                   | Description                                              |
| ---------------------------------------- | -------------------------------------------------------- |
| `.seed("file.sql")`                      | Load SQL from `seeds/file.sql` into the default database |
| `.seed("file.sql", { service: "name" })` | Load SQL into a specific database                        |
| `.fixture("file")`                       | Copy `fixtures/file` into the CLI working directory      |
| `.project("name")`                       | Use `fixtures/name/` as the CLI working directory        |
| `.mock("file.json")`                     | Register mocked external API response (MSW, planned)     |

### Actions (one per spec, mutually exclusive)

**HTTP:**

| Method                     | Description                                   |
| -------------------------- | --------------------------------------------- |
| `.get(path)`               | HTTP GET request                              |
| `.post(path, "body.json")` | HTTP POST with body from `requests/body.json` |
| `.put(path, "body.json")`  | HTTP PUT with body from `requests/body.json`  |
| `.delete(path)`            | HTTP DELETE request                           |

**CLI:**

| Method                                 | Description                                                 |
| -------------------------------------- | ----------------------------------------------------------- |
| `.exec("args")`                        | Run command (blocking)                                      |
| `.exec(["build", "start"])`            | Run commands sequentially in same directory                 |
| `.spawn("args", { waitFor, timeout })` | Run long-lived process, resolve on pattern match or timeout |

### Assertions

Assertions use a scoped API: `result.{scope}.{assertion}`. Database assertions (`result.table()`) are async.

**HTTP-specific:**

| Method                                     | Description                                        |
| ------------------------------------------ | -------------------------------------------------- |
| `result.status.toBe(code)`                 | Assert HTTP status code                            |
| `result.response.toMatchFile("file.json")` | Assert response body matches `responses/file.json` |

**CLI-specific:**

| Method                                              | Description                                        |
| --------------------------------------------------- | -------------------------------------------------- |
| `result.exitCode.toBe(code)`                        | Assert process exit code                           |
| `result.stdout.toContain(str)`                      | Assert stdout contains string                      |
| `result.stdout.not.toContain(str)`                  | Assert stdout does not contain string              |
| `result.stdout.toContain(str, { near: "ctx" })`     | Assert stdout contains string near context         |
| `result.stderr.toContain(str)`                      | Assert stderr contains string                      |
| `result.stderr.not.toContain(str)`                  | Assert stderr does not contain string              |
| `result.stderr.not.toContain(str, { near: "ctx" })` | Assert stderr does not contain string near context |
| `result.stdout.toMatch(/regex/)`                    | Assert stdout matches regex                        |
| `result.stdout.toMatchFile("file.txt")`             | Assert stdout matches `expected/file.txt`          |
| `result.stderr.toMatchFile("file.txt")`             | Assert stderr matches `expected/file.txt`          |
| `result.stdout.toBeEmpty()`                         | Assert stdout is empty                             |

**Cross-mode:**

| Method                                                             | Description                             |
| ------------------------------------------------------------------ | --------------------------------------- |
| `await result.table(name).toMatch({ columns, rows })`              | Assert database table contents          |
| `await result.table(name, { service }).toMatch({ columns, rows })` | Assert on a specific database           |
| `await result.table(name).toBeEmpty()`                             | Assert database table is empty          |
| `result.file(path).toExist()`                                      | Assert file exists in working directory |
| `result.file(path).not.toExist()`                                  | Assert file does not exist              |
| `result.file(path).toContain(content)`                             | Assert file contains string             |
| `result.file(path).toMatch(/regex/)`                               | Assert file content matches regex       |

## Multi-database support

When multiple databases are declared, `seed()` and `result.table()` accept `{ service: "name" }` to target a specific database by its compose name. Without `service`, both default to the first postgres.

```typescript
const db = postgres({ compose: "db" });
const analyticsDb = postgres({ compose: "analytics-db" });

const spec = await integration({
  services: [db, analyticsDb],
  app: () => createApp({ ... }),
});

const result = await spec("cross-db")
  .seed("users.sql")
  .seed("events.sql", { service: "analytics-db" })
  .post("/users", "request.json")
  .run();

await result.table("users").toMatch({ columns: ["name"], rows: [["Alice"]] });
await result.table("events", { service: "analytics-db" }).toMatch({
  columns: ["type"],
  rows: [["user_created"]],
});
```

## Service factories

```typescript
import { postgres, redis } from "@jterrazz/test";

const db = postgres({ compose: "db" });
const cache = redis({ compose: "cache" });
```

Service handles read image and environment from `docker/compose.test.yaml`. After the runner starts, `.connectionString` is populated from the running container.

| Factory      | Options                   | Connection string                     |
| ------------ | ------------------------- | ------------------------------------- |
| `postgres()` | `compose`, `image`, `env` | `postgresql://user:pass@host:port/db` |
| `redis()`    | `compose`, `image`        | `redis://host:port`                   |

## Mocking utilities

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export        | Description                                  |
| ------------- | -------------------------------------------- |
| `mockOf<T>()` | Deep mock of any interface                   |
| `mockOfDate`  | Date mocking via `.set(date)` and `.reset()` |

## Conventions

### Docker

```
docker/
├── compose.test.yaml       # Source of truth for test infrastructure
├── postgres/
│   └── init.sql            # Auto-run on container start
```

### Test structure

```
tests/
├── e2e/                    # Full-stack specification tests
│   └── {feature}/
│       ├── {feature}.e2e.test.ts
│       ├── seeds/          # Database state setup
│       ├── fixtures/       # Files copied into CLI working dir
│       ├── requests/       # HTTP request bodies
│       ├── responses/      # Expected HTTP responses
│       └── expected/       # Expected CLI output
├── integration/            # Infrastructure tests (containers)
└── setup/                  # Specification runners, fixtures, helpers
    ├── fixtures/           # Shared fixture projects
    ├── helpers/            # Shared test utilities
    └── *.specification.ts  # Runner setup files
```

### File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

### Test writing

Every test uses `// Given` and `// Then` comments. Always both, never one without the other.

```typescript
test("creates a user and returns 201", async () => {
  // Given — two existing users
  const result = await spec("creates user")
    .seed("initial-users.sql")
    .post("/users", "new-user.json")
    .run();

  // Then — user created with all three in table
  result.status.toBe(201);
  await result.table("users").toMatch({
    columns: ["name"],
    rows: [["Alice"], ["Bob"], ["Charlie"]],
  });
});
```

`// When` is only used if the action isn't obvious. The spec builder chain (`.seed().post().run()` / `.project().exec().run()`) IS the when.

## Requirements

- **Docker** — testcontainers for `integration()`, docker compose for `e2e()`
- **vitest** — peer dependency
- **hono** — optional peer, only needed for `integration()` mode with in-process apps
