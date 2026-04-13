# `@jterrazz/test` — API cheat sheet

> For full reference with type signatures and examples, see <https://jterrazz.github.io/package-test/reference/>. This file is the agent-facing condensed view.

## Imports

```typescript
import { spec, app, command, stack } from '@jterrazz/test';
import { postgres, redis } from '@jterrazz/test/services';
import { mockOf, mockOfDate } from '@jterrazz/test/mock';
```

## Builder shape

```
runner("label") -> setup -> action -> assertions
```

## Runner creation

| Pattern                                       | Description                                    |
| --------------------------------------------- | ---------------------------------------------- |
| `spec(app(() => myApp), { services, root })`  | Integration — testcontainers + in-process Hono |
| `spec(stack(root))`                           | E2E — docker compose up + real HTTP            |
| `spec(command('my-cli'), { root, services })` | CLI — child process in a fresh temp dir        |

## Setup methods (cross-mode)

| Method                                   | Description                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `.seed("file.sql")`                      | Load SQL from `seeds/file.sql` into the default database                                                                |
| `.seed("file.sql", { service: "name" })` | Load SQL into a specific database by compose name                                                                       |
| `.fixture("file")`                       | Copy `fixtures/file` into the CLI working dir before exec                                                               |
| `.project("name")`                       | Copy `fixtures/name/` into a fresh temp dir and run there                                                               |
| `.mock("file.json")`                     | Register mocked external API response (MSW, planned)                                                                    |
| `.env({ KEY: "value" })`                 | Set env vars on the CLI child process. `null` unsets. `$WORKDIR` expands to the temp working dir. Multiple calls merge. |

## Action methods (one per spec, mutually exclusive)

**HTTP** (requires `spec(app(...))` or `spec(stack(...))`):

| Method                     | Description                                   |
| -------------------------- | --------------------------------------------- |
| `.get(path)`               | HTTP GET                                      |
| `.post(path, "body.json")` | HTTP POST with body from `requests/body.json` |
| `.put(path, "body.json")`  | HTTP PUT                                      |
| `.delete(path)`            | HTTP DELETE                                   |

**CLI** (requires `spec(command(...))`):

| Method                                 | Description                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `.exec("args")`                        | Run command (blocking, via execSync)                                                                                |
| `.exec(["build", "start"])`            | Run commands sequentially in same temp directory; stops on first failure                                            |
| `.spawn("args", { waitFor, timeout })` | Long-lived process — resolves on pattern match (exit 0), process exit without match (exit 1), or timeout (exit 124) |

## Working directory

Every CLI spec runs in a **fresh empty `mkdtemp` directory**. `.project("name")` pre-populates it; `.fixture("file")` seeds individual files; a bare `runner("x").exec("...")` runs in a pristine empty dir. The runner never writes into `fixturesRoot`.

## Assertions

**Raw values (vitest expect):**

| Expression                                   | Description                 |
| -------------------------------------------- | --------------------------- |
| `expect(result.exitCode).toBe(0)`            | CLI exit code               |
| `expect(result.status).toBe(201)`            | HTTP status code            |
| `expect(result.stdout).toContain("hello")`   | CLI stdout contains string  |
| `expect(result.stderr).not.toContain("err")` | CLI stderr does not contain |

**Files** (`result.file(path)` returns `{ exists, content }`):

| Expression                                                        | Description           |
| ----------------------------------------------------------------- | --------------------- |
| `expect(result.file("dist/index.js").exists).toBe(true)`          | File exists           |
| `expect(result.file("dist/index.js").content).toContain("Hello")` | File content contains |
| `expect(result.file("dist/index.cjs").exists).toBe(false)`        | File does not exist   |

**Directories** (`result.directory(path)` — for codegen / scaffolding output):

| Expression                                                           | Description                                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `await result.directory("out").toMatchFixture("go-api")`             | Snapshot tree against `expected/go-api/`. Structured diff on mismatch (added / removed / changed, with line-level diff for changed). |
| `await result.directory().toMatchFixture("name", { ignore: [...] })` | Pass extra ignores. Defaults already skip `.git`, `.DS_Store`, `node_modules`, `.next`, `dist`, `.turbo`, `.cache`.                  |
| `await result.directory("out").files()`                              | Sorted recursive file list for ad-hoc presence/absence checks.                                                                       |

Update fixtures with `JTERRAZZ_TEST_UPDATE=1`, `UPDATE_SNAPSHOTS=1`, or `vitest -u`. Fixtures live at `{test-file-dir}/expected/{name}/`.

**Response (HTTP body):**

| Expression                                      | Description                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `result.response.toMatchFile("expected.json")`  | Compare body to `responses/expected.json`; structured diff on mismatch |
| `expect(result.response.body).toEqual({ ... })` | Raw body for vitest assertions                                         |

**Tables (database — async):**

| Expression                                                                      | Description                        |
| ------------------------------------------------------------------------------- | ---------------------------------- |
| `await result.table("users").toMatch({ columns: ["name"], rows: [["Alice"]] })` | Assert table contents              |
| `await result.table("events", { service: "analytics-db" }).toMatch({ ... })`    | Assert against a specific database |
| `await result.table("users").toBeEmpty()`                                       | Assert empty table                 |

**Grep** (scoped text matching — instance method on result):

```typescript
expect(result.grep('unused-var.ts')).toContain('no-unused-vars');
expect(result.grep('valid/sorted.ts')).not.toContain('sort-imports');
```

`result.grep(pattern)` filters multi-line stdout to the block matching `pattern`, returning a string for vitest assertions. Useful for linter / compiler output where errors come in blocks separated by blank lines.

**Docker** (container assertions — via runner):

```typescript
const container = runner.docker('my-container-id');
// Use container for filesystem / mount / network assertions
```

## Service factories

```typescript
import { postgres, redis } from '@jterrazz/test/services';
const db = postgres({ compose: 'db' });
const cache = redis({ compose: 'cache' });
```

| Factory      | Options                   | Connection string format              |
| ------------ | ------------------------- | ------------------------------------- |
| `postgres()` | `compose`, `image`, `env` | `postgresql://user:pass@host:port/db` |
| `redis()`    | `compose`, `image`        | `redis://host:port`                   |

Service handles read image and environment from `docker/compose.test.yaml`. After the runner starts, `.connectionString` is populated from the running container.

## Multi-database support

When multiple databases are declared, `seed()` and `result.table()` accept `{ service: "name" }` to target by compose name. Without `service`, both default to the first declared database.

```typescript
const db = postgres({ compose: "db" });
const analyticsDb = postgres({ compose: "analytics-db" });

const runner = await spec(app(() => createApp({ ... })), { services: [db, analyticsDb] });

const result = await runner("cross-db")
  .seed("users.sql")
  .seed("events.sql", { service: "analytics-db" })
  .post("/users", "request.json")
  .run();

await result.table("users").toMatch({ columns: ["name"], rows: [["Alice"]] });
await result.table("events", { service: "analytics-db" }).toMatch({ columns: ["type"], rows: [["user_created"]] });
```

## Mocking utilities (unit tests, not specs)

```typescript
import { mockOf, mockOfDate } from '@jterrazz/test/mock';
```

| Export        | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| `mockOf<T>()` | Deep mock of any interface (wraps `vitest-mock-extended`)       |
| `mockOfDate`  | Date mocking via `.set(date)` and `.reset()` (wraps `mockdate`) |

## Docker convention

```
docker/
├── compose.test.yaml       # Source of truth for test infrastructure
├── postgres/
│   └── init.sql            # Auto-run on container start
└── {service-name}/
    └── init.sql            # Per-service init script (matched by compose name)
```

## Requirements

- **Docker** — testcontainers for `spec(app(...))`, docker compose for `spec(stack(...))`
- **vitest** — peer dependency
- **hono** — optional peer, only needed for `spec(app(...))` mode with in-process apps
