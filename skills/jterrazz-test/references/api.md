# API specs — `specification.api()`

Operative reference. Prose + examples: [docs/05-api.md](../../../docs/05-api.md). Assertions: [docs/08-assertions.md](../../../docs/08-assertions.md). Tokens: [references/tokens.md](tokens.md). Mocking: [references/contracts.md](contracts.md).

## Runner (in `*.specification.ts`, `afterAll(cleanup)`)

```typescript
export const { api, cleanup } = await specification.api({
    services: { db: postgres() }, // named record → reported as "db"
    server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
    // root: usually omitted
});
afterAll(cleanup);
```

Returns `{ api, cleanup, docker }`. The app runs IN THIS PROCESS, built by `server(services)` — which is why `.intercept()` and `.clock()` are real here. Checklist:

- `services` — named record. The key is the service's only name: it types `server`'s param, names the `database:` option, is what the startup report prints, and kebab-cased it is the folder the init script sits in (`analyticsDb` → `docker/analytics-db/init.sql`).
- `server: (services) => honoApp` — required (any object with a `request()` method works).
- `root` auto-discovered (walk up to the NEAREST directory carrying `package.json` — the package, not the repository); override only when the convention does not fit. It is the project root, NOT a fixtures root.

### The project

```typescript
import { api } from '@jterrazz/test/vitest';

projects: [api()]; // `specs/api/**/*.spec.ts`
```

## Setup (chainable)

| Method                                          | Description                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `.seed("file.sql", { database? })`              | Load SQL from `_seeds/` (SQL only). `database` = record key — MANDATORY with ≥ 2 DBs, FORBIDDEN with 1 (A7) |
| `.headers({ "Accept-Language": "fr" })`         | Merge HTTP headers on top of the `.http` file's (chain wins)                                                |
| `.intercept(contracts)` / `(request, response)` | Declare what the outside world replies — see [contracts.md](contracts.md). STRICT (D7)                      |

## Actions (terminal)

| Method                                     | Resolves to  | Notes                                                    |
| ------------------------------------------ | ------------ | -------------------------------------------------------- |
| `.request("create-user.http")`             | `HttpResult` | COMPLETE request from `_requests/<file>` — body sent raw |
| `.get(path)` / `.delete(path)`             | `HttpResult` | Inline                                                   |
| `.post(path, body?)` / `.put(path, body?)` | `HttpResult` | Inline body = plain object, JSON-serialized              |

## Assertions (via `expect()`)

```typescript
expect(result.status).toBe(201);
expect(result.response).toMatch('user-created.http'); // _expected/<name> — status + header SUBSET + body, {{token}}-aware
expect(result.response.body).toEqual({ error: 'User 999 not found' });
await expect(result.table('users', { database: 'db' })).toMatchRows({
    columns: ['name'],
    rows: [['Alice']],
});
await expect(result.table('users', { database: 'db' })).toBeEmpty();
```

- `.response` golden is the default (whole shape, tokens for volatile parts). A lone status probe (`d15w`) or an amas of `.response.body` probes (`d12w`) is a warning — golden it instead.
- `toMatch` always resolves against `_expected/<name>` (flat; a slash makes a subfolder; extension required). Only `.request()` reads `_requests/`.

## `.http` files

```http
### _requests/create-user.http — the COMPLETE request
POST /users
Content-Type: application/json

{ "name": "Alice" }
```

```http
### _expected/user-created.http — status + header SUBSET + body
HTTP/1.1 201 Created
Location: /users/{{uuid#user}}

{ "id": "{{uuid#user}}", "name": "Alice" }
```

## Folder layout

```
specs/api/
├── api.specification.ts        # runner at the facet ROOT
├── intercepts/                 # strict-contract specs (D7) — the subject runs in this process
└── <feature>/
    ├── <feature>.test.ts
    ├── _seeds/                  # *.sql ONLY
    ├── _requests/               # *.http — inputs (complete request)
    ├── contracts/              # <name>.contracts.ts facade + <provider>/<name>.ts units + data
    └── _expected/               # ALL expected fixtures, FLAT (incl. response *.http)
```
