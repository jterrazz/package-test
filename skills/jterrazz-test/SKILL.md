---
name: jterrazz-test
description: Testing framework for the @jterrazz ecosystem — declarative service factories, Docker-based infrastructure, specification runners for APIs and CLIs, and mocking utilities. Activates when writing tests, setting up test infrastructure, or configuring specification runners.
---

# @jterrazz/test

Part of the @jterrazz ecosystem. Defines how all projects test.

## Specification runners

Three modes, same builder API. The framework handles containers, wiring, and temp directories.

### `integration()` — testcontainers + in-process app

Starts real containers via testcontainers. App runs in-process (Hono). Fastest feedback loop.

```typescript
import { afterAll } from "vitest";
import { integration, postgres, redis } from "@jterrazz/test";
import { createApp } from "../../src/app.js";

const db = postgres({ compose: "db" });
const cache = redis({ compose: "cache" });

export const spec = await integration({
  services: [db, cache],
  app: () => createApp({ databaseUrl: db.connectionString }),
  root: "../../",
});

afterAll(() => spec.cleanup());
```

| Option     | Type              | Description                                                   |
| ---------- | ----------------- | ------------------------------------------------------------- |
| `services` | `ServiceHandle[]` | Declared services — started via testcontainers                |
| `app`      | `() => HonoApp`   | Factory that returns a Hono app — called after services start |
| `root`     | `string?`         | Project root for compose detection (relative paths supported) |

### `e2e()` — docker compose up + real HTTP

Starts the full `docker/compose.test.yaml` stack. App URL and databases auto-detected.

```typescript
import { afterAll } from "vitest";
import { e2e } from "@jterrazz/test";

export const spec = await e2e({
  root: "../../",
});

afterAll(() => spec.cleanup());
```

| Option | Type      | Description                                            |
| ------ | --------- | ------------------------------------------------------ |
| `root` | `string?` | Project root — must contain `docker/compose.test.yaml` |

### `cli()` — local command execution

Runs CLI commands against fixture projects in isolated temp directories.

```typescript
import { resolve } from "node:path";
import { cli } from "@jterrazz/test";

export const spec = await cli({
  command: resolve(import.meta.dirname, "../../bin/my-cli.sh"),
  root: "../fixtures",
});
```

| Option     | Type               | Description                                                         |
| ---------- | ------------------ | ------------------------------------------------------------------- |
| `command`  | `string`           | CLI command (resolved from `node_modules/.bin` or absolute path)    |
| `root`     | `string?`          | Base dir for `.project()` fixture lookup (relative paths supported) |
| `services` | `ServiceHandle[]?` | Optional infrastructure services (started via testcontainers)       |

### Runner pattern with describe.each

Run the same tests in both integration and e2e modes:

```typescript
// tests/setup/runners.ts
import { integrationSpec } from "./integration.specification.js";
import { e2eSpec } from "./e2e.specification.js";

export const runners = [
  { name: "integration", spec: integrationSpec },
  { name: "e2e", spec: e2eSpec },
];

// tests/e2e/users/users.e2e.test.ts
import { runners } from "../../setup/runners.js";

describe.each(runners)("$name — users", ({ spec }) => {
  test("creates a user", async () => { ... });
});
```

## Builder API

Every test follows: `spec("label") → setup → action → assertions`.

### Setup (cross-mode)

| Method                                   | Description                                                           |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `.seed("file.sql")`                      | Load SQL from `seeds/file.sql` into the default database              |
| `.seed("file.sql", { service: "name" })` | Load SQL into a specific database by compose name                     |
| `.fixture("file")`                       | Copy `fixtures/file` into the CLI working directory before exec       |
| `.project("name")`                       | Use `fixtures/name/` as the CLI working directory (creates temp copy) |
| `.mock("file.json")`                     | Register mocked external API response (MSW, planned)                  |

### Actions (one per spec, mutually exclusive)

**HTTP actions** (requires `integration()` or `e2e()` runner):

| Method                     | Description                                   |
| -------------------------- | --------------------------------------------- |
| `.get(path)`               | HTTP GET request                              |
| `.post(path, "body.json")` | HTTP POST with body from `requests/body.json` |
| `.put(path, "body.json")`  | HTTP PUT with body from `requests/body.json`  |
| `.delete(path)`            | HTTP DELETE request                           |

**CLI actions** (requires `cli()` runner):

| Method                                 | Description                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `.exec("args")`                        | Run command (blocking, via execSync)                                                                                     |
| `.exec(["build", "start"])`            | Run commands sequentially in same temp directory, stops on first failure                                                 |
| `.spawn("args", { waitFor, timeout })` | Run long-lived process — resolves on pattern match (exit 0), process exits without match (exit 1), or timeout (exit 124) |

### Assertions

Result properties are raw values — use vitest `expect()` for assertions. Database and response file assertions use custom async methods.

**Raw values (vitest expect):**

| Expression                                   | Description                 |
| -------------------------------------------- | --------------------------- |
| `expect(result.exitCode).toBe(0)`            | CLI exit code               |
| `expect(result.status).toBe(201)`            | HTTP status code            |
| `expect(result.stdout).toContain("hello")`   | CLI stdout contains string  |
| `expect(result.stderr).not.toContain("err")` | CLI stderr does not contain |

**Files (result.file returns {exists, content}):**

| Expression                                                        | Description                 |
| ----------------------------------------------------------------- | --------------------------- |
| `expect(result.file("dist/index.js").exists).toBe(true)`          | Assert file exists          |
| `expect(result.file("dist/index.js").content).toContain("Hello")` | Assert file contains string |
| `expect(result.file("dist/index.cjs").exists).toBe(false)`        | Assert file does not exist  |

**Grep (scoped text matching):**

```typescript
import { grep } from "@jterrazz/test";

expect(grep(result.stdout, "unused-var.ts")).toContain("no-unused-vars");
expect(grep(result.stdout, "valid/sorted.ts")).not.toContain("sort-imports");
```

`grep(output, pattern)` filters multi-line output to the block matching `pattern`, returning a string for vitest assertions.

**Response (HTTP body):**

| Expression                                      | Description                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `result.response.toMatchFile("expected.json")`  | Custom — compares body to `responses/expected.json`, shows diff on mismatch |
| `expect(result.response.body).toEqual({ ... })` | Raw body object for vitest assertions                                       |

**Tables (custom async — database queries):**

| Expression                                                                      | Description                    |
| ------------------------------------------------------------------------------- | ------------------------------ |
| `await result.table("users").toMatch({ columns: ["name"], rows: [["Alice"]] })` | Assert database table contents |
| `await result.table("events", { service: "analytics-db" }).toMatch({ ... })`    | Assert on a specific database  |
| `await result.table("users").toBeEmpty()`                                       | Assert database table is empty |

### Multi-database support

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

expect(result.status).toBe(201);
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

| Factory      | Options                   | Connection string format              |
| ------------ | ------------------------- | ------------------------------------- |
| `postgres()` | `compose`, `image`, `env` | `postgresql://user:pass@host:port/db` |
| `redis()`    | `compose`, `image`        | `redis://host:port`                   |

## Mocking utilities (unit tests)

```typescript
import { mockOf, mockOfDate } from "@jterrazz/test";
```

| Export        | Description                                                   |
| ------------- | ------------------------------------------------------------- |
| `mockOf<T>()` | Deep mock of any interface (wraps vitest-mock-extended)       |
| `mockOfDate`  | Date mocking via `.set(date)` and `.reset()` (wraps mockdate) |

## Docker convention

```
docker/
├── compose.test.yaml       # Source of truth for test infrastructure
├── postgres/
│   └── init.sql            # Auto-run on container start
├── {service-name}/
│   └── init.sql            # Per-service init script (matched by compose name)
```

## Test structure

```
tests/
├── e2e/                    # Full-stack specification tests
│   └── {feature}/
│       ├── {feature}.e2e.test.ts
│       ├── seeds/          # Database state setup (.sql)
│       ├── fixtures/       # Files copied into CLI working dir
│       ├── requests/       # HTTP request bodies (.json)
│       ├── responses/      # Expected HTTP responses (.json)
│       └── expected/       # Expected CLI output (.txt)
├── integration/            # Infrastructure tests (containers)
└── setup/                  # Specification runners, fixtures, helpers
    ├── fixtures/           # Shared fixture projects (for .project())
    ├── helpers/            # Shared test utilities
    └── *.specification.ts  # Runner setup files
```

## File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

## Test writing convention

Every test uses `// Given` and `// Then` comments. Always both, never one without the other.

```typescript
test("creates a user and returns 201", async () => {
  // Given — two existing users
  const result = await spec("creates user")
    .seed("initial-users.sql")
    .post("/users", "new-user.json")
    .run();

  // Then — user created with all three in table
  expect(result.status).toBe(201);
  await result.table("users").toMatch({
    columns: ["name"],
    rows: [["Alice"], ["Bob"], ["Charlie"]],
  });
});
```

```typescript
test("builds the project", async () => {
  // Given — sample app project
  const result = await spec("build").project("sample-app").exec("build").run();

  // Then — ESM output with source maps
  expect(result.exitCode).toBe(0);
  expect(result.file("dist/index.js").exists).toBe(true);
  expect(result.file("dist/index.js.map").exists).toBe(true);
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

## Requirements

- **Docker** — testcontainers for `integration()`, docker compose for `e2e()`
- **vitest** — peer dependency
- **hono** — optional peer, only needed for `integration()` mode with in-process apps
