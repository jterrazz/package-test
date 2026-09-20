# 05 — API specs (`specification.api`)

`specification.api()` tests an HTTP API through real requests. Your app runs **in this process**, built by the `server` factory from the services the runner started in real containers — so a request reaches it without a socket, and a contract, a clock and a golden all mean something because the app shares this process's world.

Use it when the subject under test is an HTTP surface. For background pipelines use [jobs](06-jobs.md); for binaries use [cli](07-cli.md).

## Creating the runner

```typescript
// specs/api/api.specification.ts
import { afterAll } from 'vitest';
import { specification, postgres, redis } from '@jterrazz/test';
import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({
    services: {
        db: postgres(), // → reported as "db", init from docker/db/
        analyticsDb: postgres(), // → "analytics-db", init from docker/analytics-db/
        cache: redis(), // → "cache"
    },
    server: ({ db, analyticsDb, cache }) =>
        createApp({
            databaseUrl: db.connectionString,
            analyticsDatabaseUrl: analyticsDb.connectionString,
            redisUrl: cache.connectionString,
        }),
    // root: absent → auto-discovery (see below)
});

afterAll(cleanup);
```

### Options

| Option     | Required                     | Description                                                                                                                             |
| ---------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `services` | yes (if the app needs infra) | Named record of service factories (`postgres()`, `redis()`, `sqlite()`). Keys are your test vocabulary — see [services](11-services.md) |
| `server`   | yes                          | `(services) => app` — receives the started services record, fully typed (rule A8)                                                       |
| `root`     | no                           | Override for root resolution — reserved for cases where the convention is not enough (rule A9)                                          |

### Root resolution (rule A9)

Without `root`, the framework walks **up from the specification file** to the **nearest** directory carrying `package.json` — the package being tested, not the repository around it. Passing a `root` that points at the directory the walk would have found anyway is redundant (future lint warning).

## The app runs here

| Aspect             | What it means                                                              |
| ------------------ | -------------------------------------------------------------------------- |
| Your app           | In-process, built by `server(services)` — no container, no socket          |
| Services           | Real containers, started by testcontainers from each handle's own defaults |
| What it proves     | Application logic against real databases, caches and processes             |
| Parallel isolation | Per-worker schema / db-index / file copy (rule G2)                         |

Because the app shares this process, three things the framework offers are real here and nowhere else: `.intercept()` (msw runs in-process), `.clock()` (it pins the `Date` the app reads), and a golden of the response the app actually built. What the SHIPPED artefact does — its Dockerfile, its wiring, its networking — is a deployment probe, and this facet does not claim it.

`docker/<service>/init.sql` runs when the corresponding service starts, under the kebab-case of its record key. See [services](11-services.md).

## `.http` request files — full format

Requests live in `_requests/`, one file per request, extension `.http` (rule C2). A request file is the **complete** request: method + path on the first line, then headers, then a blank line, then the body.

```http
### _requests/create-user.http
POST /users
Content-Type: application/json
Accept-Language: fr

{ "name": "Alice" }
```

Format rules:

- First line: `METHOD /path` — the file must start with it (rule C2). The path is relative to the app under test.
- Header lines: `Name: value`, one per line, immediately after the request line.
- Blank line, then the body (optional — a GET usually has none).
- Executed with `api.request('create-user.http')` — the argument is the file name inside the feature's `_requests/` folder.

Expected responses live in `_expected/`, like every other expected fixture, same extension, and start with a status line (rule C3):

```http
### _expected/user-created.http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /users/{{uuid#user}}

{ "id": "{{uuid#user}}", "name": "Alice" }
```

- First line: `HTTP/1.1 <status>` — mandatory.
- Headers are matched as a **subset**: listed headers must match, unlisted headers are unconstrained (rule C3).
- Body and headers both accept `{{token}}` placeholders, including `#ref` captures — `{{uuid#user}}` above must be the _same_ UUID in the `Location` header and the body. See [tokens](09-tokens.md).

## Actions (terminal)

Exactly one per chain (rule B1/B2). Each executes the spec and resolves to the result.

| Action                  | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `.request('file.http')` | Execute the complete request from `_requests/file.http`       |
| `.get(path)`            | Inline GET — for simple cases where a file would be excessive |
| `.post(path, body?)`    | Inline POST                                                   |
| `.put(path, body?)`     | Inline PUT                                                    |
| `.delete(path)`         | Inline DELETE                                                 |

The inline `body?` of `.post()` / `.put()` is a plain object, JSON-serialized with a `Content-Type: application/json` default header. There is no filename form inline — file-based requests always go through `.request('file.http')`, whose body section is sent **raw**: the surrounding blank lines are trimmed, but everything between is preserved byte-for-byte (interior double spaces, indentation, and non-JSON text are intact).

There is no `.run()` and no label argument: the vitest test name is the spec's only description (rule B3).

```typescript
test('returns 404 with a useful body', async () => {
    // Given - empty database
    const result = await api.get('/users/999');

    // Then - inline assertions when a fixture file would be excessive
    expect(result.status).toBe(404);
    expect(result.response.body).toEqual({ error: 'User 999 not found' });
});
```

## Setups (chainable)

| Setup                             | Description                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `.seed('file.sql')`               | Load `_seeds/file.sql` into the database                                                                                        |
| `.seed('file.sql', { database })` | Target a database by its record key — **mandatory with ≥ 2 databases, forbidden with 1** (rule A7)                              |
| `.headers({ 'Name': 'value' })`   | Set request headers; repeated calls merge                                                                                       |
| `.intercept(contract)`            | Mock an outgoing HTTP call with a declared [contract](10-contracts.md)                                                          |
| `.intercept(trigger, response)`   | Inline intercept for one-off cases                                                                                              |
| `.clock('2026-03-04T09:30:00Z')`  | Pin the app's `Date` for this chain, released when the action resolves ([12](12-conventions.md#time--one-primitive-two-depths)) |

Contracts are **strict** (rule D7): once a chain declares one, every outgoing request must match a declared, non-exhausted contract or the spec fails with an explicit "Unmatched outgoing HTTP request" error (see [contracts](10-contracts.md#strict-by-construction-rule-d7)). `.intercept()` and `.clock()` both work because the app runs in THIS process: msw intercepts its outgoing requests, and the pinned `Date` is the one it reads.

```typescript
test('serves french content', async () => {
    // Given - headers inline
    const result = await api.headers({ 'Accept-Language': 'fr' }).get('/welcome');

    // Then
    expect(result.response.body).toEqual({ message: 'Bienvenue' });
});
```

### Isolation between specs (rules B1, B7)

Databases are **reset at the start of every chain**. A spec never depends on a previous spec, and there is no "flow" mode — sequential scenarios are expressed through seeds:

```typescript
test('starts clean between specs', async () => {
    // Given - nothing (every chain resets the databases: one spec = ONE action)
    const result = await api.get('/orders');

    // Then
    await expect(result.table('orders', { database: 'db' })).toBeEmpty();
});
```

## Result surface

The result of an API action exposes read-only accessors (rule D1); all assertions go through `expect()`:

| Member                      | Type             | Description                                                                      |
| --------------------------- | ---------------- | -------------------------------------------------------------------------------- |
| `result.status`             | `number`         | HTTP status code — assert with native `expect(...).toBe(...)`                    |
| `result.response`           | response subject | Full response (status + headers + body) — subject for `toMatch`                  |
| `result.response.body`      | parsed body      | Raw body for native assertions (`toEqual`, `toMatchObject`)                      |
| `result.table(name, opts?)` | table subject    | Database table — subject for `toMatchRows` / `toBeEmpty` (async, `await expect`) |

`expect(result.response).toMatch('user-created.http')` resolves against `_expected/`, like every other subject (rule D3) — there is no per-subject resolution. The full matcher reference is in [assertions](08-assertions.md).

Beyond the result, the `specification.api()` handle destructures to `{ api, cleanup, docker }`. The `docker(containerId)` reader lazily runs `docker inspect` and returns a `ContainerAccessor` for an arbitrary container id — usable with `await expect(docker(id)).toBeRunning()` and the sync read accessors (`.exists`, `.status`, `.file(path)`, logs). An unknown id yields `exists: false` instead of throwing. (`specification.jobs()` has no `docker` member — jobs never spawn containers.)

## Full example — multi-database order flow

```http
### _requests/new-order.http
POST /orders
Content-Type: application/json

{ "sku": "KB-42", "quantity": 1 }
```

```http
### _expected/order-created.http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /orders/{{uuid#order}}

{
    "id": "{{uuid#order}}",
    "status": "pending",
    "total": "{{number}}",
    "createdAt": "{{iso8601}}",
    "paymentIntent": { "orderId": "{{uuid#order}}", "expiresAt": "{{iso8601}}" }
}
```

```typescript
// specs/api/orders/orders.spec.ts
import { expect, test } from 'vitest';
import { match } from '@jterrazz/test';
import { api } from '../api.specification.js';

test('ingests an order event into analytics', async () => {
    // Given - catalog in the main database, analytics empty
    const result = await api.seed('catalog.sql', { database: 'db' }).request('new-order.http');

    // Then - one row per database, targeted by record key
    await expect(result.table('orders', { database: 'db' })).toMatchRows({
        columns: ['status'],
        rows: [['pending']],
    });
    await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
        columns: ['type'],
        rows: [['order_created']],
    });
});

test('returns the created order with consistent ids', async () => {
    // Given
    const result = await api.seed('catalog.sql', { database: 'db' }).request('new-order.http');

    // Then - {{uuid#order}} appears 3 times (Location header included) → all equal
    expect(result.response).toMatch('order-created.http');
});

test('links the analytics event to the created order', async () => {
    // Given
    const result = await api.seed('catalog.sql', { database: 'db' }).request('new-order.http');

    // Then - same id on both sides, without ever knowing its value
    await expect(result.table('orders', { database: 'db' })).toMatchRows({
        columns: ['id', 'status'],
        rows: [[match.ref('order'), 'pending']],
    });
    await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
        columns: ['order_id', 'type'],
        rows: [[match.ref('order'), 'order_created']],
    });
});
```

> This project declares two databases, so `database:` is mandatory on every `.seed()` and `.table()` (rule A7). With a single database you would write `api.seed('catalog.sql')` and `result.table('orders')` — and adding `database:` would be forbidden as redundant.

## Pitfalls

- **Omitting `database:` with ≥ 2 databases, or passing it with 1** — both are convention violations (rule A7).
- **Expecting unlisted response headers to be constrained.** Response `_expected/*.http` header matching is subset-only; if a header must be _absent_, that is not expressible in the file — assert on it in code.
- **Chaining two actions** (`api.get(...).get(...)`) or reusing state across tests. One chain = one terminal action; databases reset per chain (rules B1, B7).
- **Forgetting that `.intercept()` is strict.** After the first `.intercept()`, an unmatched or queue-exhausted outgoing request fails the spec (rule D7).
- **Putting the request body in the test file when it has any substance.** Requests of more than a line or two belong in `_requests/*.http` — inline `.post()` is for trivial cases.

## Related

[06 — Jobs specs](06-jobs.md) · [08 — Assertions](08-assertions.md) · [09 — Tokens](09-tokens.md) · [10 — Contracts](10-contracts.md) · [11 — Services](11-services.md)
