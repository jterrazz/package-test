# @jterrazz/test

Declarative testing framework for APIs and CLIs. Same fluent builder API, three execution modes.

```bash
npm install -D @jterrazz/test vitest
```

## Quick start

### API testing (HTTP)

```typescript
// tests/setup/integration.specification.ts
import { afterAll } from 'vitest';
import { spec, app } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';
import { createApp } from '../../src/app.js';

const db = postgres({ compose: 'db' });

export const run = await spec(
    app(() => createApp({ databaseUrl: db.connectionString })),
    {
        services: [db],
        root: '../../',
    },
);

afterAll(() => run.cleanup());
```

```typescript
// tests/e2e/users/users.e2e.test.ts
import { run } from '../../setup/integration.specification.js';

test('creates a user', async () => {
    // Given — one existing user
    const result = await run('creates user')
        .seed('initial-users.sql')
        .post('/users', 'new-user.json')
        .run();

    // Then — user created
    expect(result.status).toBe(201);
    await result.table('users').toMatch({
        columns: ['name'],
        rows: [['Alice'], ['Bob']],
    });
});
```

### CLI testing

```typescript
// tests/setup/cli.specification.ts
import { resolve } from 'node:path';
import { spec, command } from '@jterrazz/test';

export const run = await spec(command(resolve(import.meta.dirname, '../../bin/my-cli.sh')), {
    root: '../fixtures',
});
```

```typescript
// tests/e2e/build/build.e2e.test.ts
import { run } from '../../setup/cli.specification.js';

test('builds the project', async () => {
    // Given — sample app project
    const result = await run('build').project('sample-app').exec('build').run();

    // Then — ESM output with source maps
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Build completed');
    expect(result.file('dist/index.js').exists).toBe(true);
    expect(result.file('dist/index.cjs').exists).toBe(false);
    expect(result.file('dist/index.js').content).toContain('Hello');
});
```

## Specification runners

Three modes, same builder API. Each handles infrastructure and cleanup automatically.

### `spec(app(...))` — testcontainers + in-process app

Starts real containers via testcontainers. App runs in-process (Hono). Fastest feedback loop.

```typescript
import { spec, app } from '@jterrazz/test';
import { postgres, redis } from '@jterrazz/test/services';

const db = postgres({ compose: 'db' });
const cache = redis({ compose: 'cache' });

export const run = await spec(
    app(() => createApp({ databaseUrl: db.connectionString })),
    {
        services: [db, cache],
        root: '../../',
    },
);
```

### `spec(stack(...))` — docker compose up + real HTTP

Starts the full `docker/compose.test.yaml` stack. App URL and databases auto-detected.

```typescript
import { spec, stack } from '@jterrazz/test';

export const run = await spec(stack('../../'));
```

### `spec(command(...))` — local command execution

Runs CLI commands against fixture projects in temp directories. Optionally starts infrastructure.

```typescript
import { spec, command } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';

export const run = await spec(command(resolve(import.meta.dirname, '../../bin/my-cli.sh')), {
    root: '../fixtures',
});

// With infrastructure (CLI that needs a database)
const db = postgres({ compose: 'db' });

export const run = await spec(command('my-migrate-tool'), {
    root: '../fixtures',
    services: [db],
});
```

## Builder API

Every test follows the same pattern: `run("label") -> setup -> action -> assertions`.

### Setup (cross-mode)

| Method                                   | Description                                               |
| ---------------------------------------- | --------------------------------------------------------- |
| `.seed("file.sql")`                      | Load SQL from `seeds/file.sql` into the default database  |
| `.seed("file.sql", { service: "name" })` | Load SQL into a specific database                         |
| `.fixture("file")`                       | Copy `fixtures/file` into the CLI working directory       |
| `.project("name")`                       | Copy `fixtures/name/` into a fresh temp dir and run there |

### Actions (one per spec, mutually exclusive)

**HTTP:**

| Method                     | Description                                   |
| -------------------------- | --------------------------------------------- |
| `.get(path)`               | HTTP GET request                              |
| `.post(path, "body.json")` | HTTP POST with body from `requests/body.json` |
| `.put(path, "body.json")`  | HTTP PUT with body from `requests/body.json`  |
| `.delete(path)`            | HTTP DELETE request                           |

**CLI:**

| Method                                 | Description                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `.exec("args")`                        | Run command (blocking)                                                                |
| `.exec(["build", "start"])`            | Run commands sequentially in same directory                                           |
| `.spawn("args", { waitFor, timeout })` | Run long-lived process, resolve on pattern match or timeout                           |
| `.env({ KEY: "value" })`               | Set env vars on the child process (`null` unsets, `$WORKDIR` expands to the temp cwd) |

Every CLI spec runs in a **fresh, empty temp directory** by default. `.project("name")` starts from a copy of `fixtures/name/`; `.fixture("file")` seeds specific files into the temp dir.

### Assertions

Result properties are raw values -- use vitest `expect()` for assertions. Database and response file assertions use custom async methods.

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

**Directories (CLI scaffolding / codegen output):**

| Expression                                                        | Description                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `await result.directory("out").toMatchFixture("go-api")`          | Snapshot the tree against `expected/go-api/`, structured diff on mismatch      |
| `await result.directory().toMatchFixture("scaffold", { ignore })` | Pass extra ignore patterns; defaults already skip `.git`, `node_modules`, etc. |
| `await result.directory("out").files()`                           | List all files (recursive, sorted) for ad-hoc assertions                       |

Run with `JTERRAZZ_TEST_UPDATE=1` (or vitest `-u`) to overwrite fixtures with the current output.

**Grep (scoped text matching):**

```typescript
expect(result.grep('unused-var.ts')).toContain('no-unused-vars');
expect(result.grep('valid/sorted.ts')).not.toContain('sort-imports');
```

`result.grep(pattern)` filters multi-line output to the block matching `pattern`, returning a string for vitest assertions.

**Response (HTTP body):**

| Expression                                      | Description                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `result.response.toMatchFile("expected.json")`  | Custom -- compares body to `responses/expected.json`, shows diff on mismatch |
| `expect(result.response.body).toEqual({ ... })` | Raw body object for vitest assertions                                        |

**Tables (custom async -- database queries):**

| Expression                                                                      | Description                    |
| ------------------------------------------------------------------------------- | ------------------------------ |
| `await result.table("users").toMatch({ columns: ["name"], rows: [["Alice"]] })` | Assert database table contents |
| `await result.table("events", { service: "analytics-db" }).toMatch({ ... })`    | Assert on a specific database  |
| `await result.table("users").toBeEmpty()`                                       | Assert database table is empty |

**Docker (container assertions):**

| Expression          | Description                     |
| ------------------- | ------------------------------- |
| `runner.docker(id)` | Access a docker container by id |

## Multi-database support

When multiple databases are declared, `seed()` and `result.table()` accept `{ service: "name" }` to target a specific database by its compose name. Without `service`, both default to the first postgres.

```typescript
import { spec, app } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';

const db = postgres({ compose: "db" });
const analyticsDb = postgres({ compose: "analytics-db" });

const run = await spec(app(() => createApp({ ... })), {
  services: [db, analyticsDb],
  root: '../../',
});

const result = await run("cross-db")
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
import { postgres, redis } from '@jterrazz/test/services';

const db = postgres({ compose: 'db' });
const cache = redis({ compose: 'cache' });
```

Service handles read image and environment from `docker/compose.test.yaml`. After the runner starts, `.connectionString` is populated from the running container.

| Factory      | Options                   | Connection string                     |
| ------------ | ------------------------- | ------------------------------------- |
| `postgres()` | `compose`, `image`, `env` | `postgresql://user:pass@host:port/db` |
| `redis()`    | `compose`, `image`        | `redis://host:port`                   |

## Mocking utilities

```typescript
import { mockOf, mockOfDate } from '@jterrazz/test/mock';
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
test('creates a user and returns 201', async () => {
    // Given — two existing users
    const result = await run('creates user')
        .seed('initial-users.sql')
        .post('/users', 'new-user.json')
        .run();

    // Then — user created with all three in table
    expect(result.status).toBe(201);
    await result.table('users').toMatch({
        columns: ['name'],
        rows: [['Alice'], ['Bob'], ['Charlie']],
    });
});
```

`// When` is only used if the action isn't obvious. The spec builder chain (`.seed().post().run()` / `.project().exec().run()`) IS the when.

## Requirements

- **Docker** -- testcontainers for `spec(app(...))`, docker compose for `spec(stack(...))`
- **vitest** -- peer dependency
- **hono** -- optional peer, only needed for `spec(app(...))` mode with in-process apps
