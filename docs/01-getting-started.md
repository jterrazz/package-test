# 01 — Getting started

This chapter takes you from `npm install` to two passing specs: one HTTP API spec backed by a real Postgres container, and one CLI spec running a binary in a fresh temp directory. It also explains the two framework environment variables (`TEST_MODE`, `TEST_UPDATE`) and where the node/compose switch lives.

## Install

```bash
npm install -D @jterrazz/test vitest
```

Peer dependencies:

| Package  | Required | Needed for                                                    |
| -------- | -------- | ------------------------------------------------------------- |
| `vitest` | yes      | Everything — the framework registers its matchers into vitest |

`msw` (outgoing HTTP interception for `.intercept()`) ships as a direct dependency — no separate install. In-process API specs (`specification.api()` in node mode) pass your web app to `server`; the adapter only needs an object with a `request()` method, so bring your own web framework (e.g. `hono`) in your project.

**Docker** must be running for container-backed services (`postgres()`, `redis()`) and for compose mode. `sqlite()` and plain CLI specs need no Docker.

Everything imports from the single package root — subpaths do not exist (rule F1):

```typescript
import {
    specification,
    postgres,
    redis,
    sqlite,
    defineContract,
    openai,
    anthropic,
    http,
    match,
    mockOf,
    mockOfDate,
} from '@jterrazz/test';
```

## The shape of every test

A **specification file** (`*.specification.ts`, under `specs/`) creates a runner once per suite. A **test file** imports the runner and writes specs. Every spec is one chain: zero or more setups, then exactly one terminal action, resolving to a typed result you assert on with `expect()`.

```
specification.api(…)  → { api, cleanup, docker, orchestrator }
specification.jobs(…) → { jobs, cleanup, orchestrator }         // no docker — jobs never spawn containers
specification.cli(…)  → { cli, cleanup, docker, orchestrator }
```

The destructured names are canonical — no aliasing (`{ api: myApi }` is an error, rule A3) — and every specification file registers `afterAll(cleanup)` (rule A4).

## First API spec

```typescript
// specs/api/api.specification.ts
import { afterAll } from 'vitest';
import { specification, postgres } from '@jterrazz/test';
import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({
    services: {
        db: postgres(), // binds to the compose service named "db"
    },
    server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
    // mode: never hardcoded here — see "TEST_MODE" below
    // root: absent — auto-discovered by walking up to docker/compose.test.yaml
});

afterAll(cleanup);
```

```http
### specs/api/users/requests/create-user.http — the COMPLETE request
POST /users
Content-Type: application/json

{ "name": "Alice" }
```

```http
### specs/api/users/expected/user-created.http — status + header subset + body
HTTP/1.1 201 Created
Content-Type: application/json

{ "id": "{{uuid}}", "name": "Alice" }
```

```typescript
// specs/api/users/users.test.ts
import { expect, test } from 'vitest';
import { api } from '../api.specification.js';

test('creates a user', async () => {
    // Given - empty database
    const result = await api.request('create-user.http');

    // Then - response matches the fixture; row landed in the database
    expect(result.response).toMatch('user-created.http');
    await expect(result.table('users')).toMatchRows({
        columns: ['name'],
        rows: [['Alice']],
    });
});
```

`{{uuid}}` is a placeholder from the unified [token grammar](06-tokens.md) — the response body must contain _a_ UUID there, whatever its value.

## First CLI spec

```typescript
// specs/cli/cli.specification.ts
import { resolve } from 'node:path';
import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

export const { cli, cleanup } = await specification.cli(
    resolve(import.meta.dirname, '../../bin/my-cli.sh'),
);

afterAll(cleanup);
```

```typescript
// specs/cli/help/help.test.ts
import { expect, test } from 'vitest';
import { cli } from '../cli.specification.js';

test('shows help', async () => {
    // Given
    const result = await cli.exec('--help');

    // Then - full snapshot of stdout against expected/help.txt
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('help.txt');
});
```

```
### specs/cli/help/expected/help.txt — tokens work in text snapshots too
my-cli v{{semver}}
Started at {{iso8601}} in {{workdir}}
Done in {{duration}}
```

Each CLI spec runs in a fresh, empty temp directory. ANSI escape sequences are stripped before comparison by default (rule D6) — you never snapshot color codes.

## vitest projects config

`mode` (node vs compose) is a property of `specification.api()` only, and it is **never hardcoded in a specification file** (rule A5). The switch lives in `vitest.config.ts` via the `TEST_MODE` environment variable:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            { test: { name: 'fast', include: ['src/**/*.test.ts', 'specs/cli/**/*.test.ts'] } },
            { test: { name: 'api', include: ['specs/api/**/*.test.ts'] } }, // node mode
            {
                test: {
                    name: 'api-stack',
                    include: ['specs/api/**/*.test.ts'],
                    env: { TEST_MODE: 'compose' }, // compose mode
                },
            },
        ],
    },
});
```

The same HTTP test files run twice: once in-process (fast feedback), once against the real compose stack (end-to-end confidence). Zero switching logic in the specs themselves.

## Framework environment variables

You set exactly two variables, both prefixed `TEST_` (rule E1). The framework also reads vitest's own `VITEST_POOL_ID` (set by vitest, not you) to isolate each parallel worker's database schema/index:

| Variable      | Values                        | Meaning                                                                                   |
| ------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| `TEST_MODE`   | `node` (default) \| `compose` | Execution mode for `specification.api()`. Priority: `mode` param > `TEST_MODE` > `'node'` |
| `TEST_UPDATE` | `1`                           | Rewrite snapshot fixtures from actual output (same effect as `vitest -u`)                 |

```bash
npx vitest --run                      # node mode, assert against fixtures
TEST_MODE=compose npx vitest --run    # compose mode
TEST_UPDATE=1 npx vitest --run        # update fixtures (tokens preserved — see chapter 06)
npx vitest --run -u                   # same as TEST_UPDATE=1
```

In update mode the framework writes **tokens, not values**: segments already covered by a placeholder are preserved, and values it knows to be dynamic (`{{workdir}}`) are substituted automatically (rule D5).

## Directory layout at a glance

```
specs/
├── api/
│   ├── api.specification.ts
│   └── users/
│       ├── users.test.ts          # <aspect>.test.ts inside its domain (rule C1)
│       ├── seeds/                 # *.sql
│       ├── requests/              # *.http — complete requests (inputs)
│       ├── contracts/             # <name>.<provider>.ts — declared external interactions
│       ├── intercepts/            # <provider>/<name>.json — inline intercept fixtures
│       └── expected/              # all expected fixtures, flat — incl. response *.http (a slash in the name creates a subfolder)
└── cli/
    ├── cli.specification.ts       # runner at the facet root (rule C1)
    └── help/
        └── help.test.ts
```

## Pitfalls

- **Hardcoding `mode: 'compose'` in a specification file.** Forbidden when `server` is defined (rule A5) — put the switch in `vitest.config.ts`. The only exception: a non-Node app (no `server` possible), where `mode: 'compose'` is mandatory and permanent.
- **Renaming the destructured runner** (`const { api: usersApi } = …`). The canonical names `api`, `jobs`, `cli` are enforced (rule A3).
- **Forgetting `afterAll(cleanup)`.** Infrastructure leaks across suites; rule A4 requires it in every specification file.
- **Importing from a subpath** (`@jterrazz/test/services`). Subpaths do not exist in v9 — everything comes from `@jterrazz/test` (rule F1).
- **Writing `// Given` without `// Then`** (or vice versa). Every test carries both comments (rule B4); `// When` only when the action is not obvious — the chain _is_ the when.

## Related

[02 — API specs](02-api.md) · [04 — CLI specs](04-cli.md) · [05 — Assertions](05-assertions.md) · [09 — Conventions](09-conventions.md)
