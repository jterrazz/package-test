# 10 — API specs (`specification.api`)

`specification.api()` tests an HTTP API through real requests. Your app runs **in this process**, built by the `server` factory from the services the runner started in real containers — so a request reaches it without a socket, and a stub, a clock and a golden all mean something because the app shares this process's world.

Use it when the subject under test is an HTTP surface. For background pipelines use [job](11-job.md); for binaries use [cli](12-cli.md).

## What it specifies

An api spec answers one question: **given this state and this request, what does the HTTP app answer, and what does it leave behind?** The subject is the assembled app met through its own entry — the handler chain, the middleware, the serialisation, the database writes — and the request is a complete HTTP exchange, written as a file a person can read. A single handler function called directly is a module test's ([05](05-module-tests.md)); a repository against a real database with no HTTP in sight is an integration spec's ([06](06-integration.md)).

### The app runs in THIS process

| Aspect             | What it means                                                               |
| ------------------ | --------------------------------------------------------------------------- |
| Your app           | In-process, built by `server(services)` — no container, no socket           |
| Services           | Real containers, started by testcontainers from each handle's own defaults  |
| What it proves     | Application logic against real databases, caches and processes              |
| Parallel isolation | Per-worker schema / db-index / file copy (rule `state-isolated-per-worker`) |

Because the app shares this process, three things the framework offers are real here and nowhere else: `.intercept()` (msw runs in-process), `.clock()` (it pins the `Date` the app reads), and a golden of the response the app actually built. What the SHIPPED artefact does — its Dockerfile, its wiring, its networking — is a deployment probe, and this facet does not claim it.

`docker/<service>/init.sql` runs when the corresponding service starts, under the kebab-case of its record key. See [services](17-services.md).

## The constructor

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
| `services` | yes (if the app needs infra) | Named record of service factories (`postgres()`, `redis()`, `sqlite()`). Keys are your test vocabulary — see [services](17-services.md) |
| `server`   | yes                          | `(services) => app` — receives the started services record, fully typed (rule `server-sees-declared-services`)                          |
| `root`     | no                           | Override for root resolution — reserved for cases where the convention is not enough (rule `no-redundant-root`)                         |

### Root resolution

Without `root`, the framework finds the package being tested by walking up from the specification file. The walk, the tree it reads and when a `root` is redundant are [17 — Services § Root auto-discovery](17-services.md#root-auto-discovery)'s.

## The chain

### Setups (chainable)

| Setup                                           | Description                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.seed(file('./seeds/file.sql'))`               | Load that `.sql` file, named by its path from the spec file — beside the test that reads it, or at the level of the tests that share it (rule `ground-shared-or-inline`) |
| `.seed(file('./seeds/file.sql'), { database })` | Target a database by its record key — **mandatory with ≥ 2 databases, forbidden with 1** (rule `database-named-only-when-several`)                                       |
| `.headers({ 'Name': 'value' })`                 | Set request headers; repeated calls merge                                                                                                                                |
| `.intercept(stub)`                              | Mock an outgoing HTTP call with a declared [stub](16-stubs.md)                                                                                                           |
| `.intercept(trigger, response)`                 | Inline intercept for one-off cases                                                                                                                                       |
| `.clock('2026-03-04T09:30:00Z')`                | Pin the app's `Date` for this chain, released when the action resolves ([18](18-conventions.md#time--one-primitive-two-depths))                                          |
| `api.with({ clock, headers })`                  | A view of the facet whose every chain starts with what the whole file shares ([18](18-conventions.md#what-a-file-shares))                                                |

Stubs are **strict** (rule `network-strict-after-first-stub`): once a chain declares one, every outgoing request must match a declared, non-exhausted stub or the spec fails with an explicit refusal naming "an unmatched outgoing request" (see [stubs](16-stubs.md#strict-by-construction)). `.intercept()` and `.clock()` both work because the app runs in THIS process: msw intercepts its outgoing requests, and the pinned `Date` is the one it reads.

```typescript
test('serves french content', async () => {
    // Given - headers inline
    const result = await api.headers({ 'Accept-Language': 'fr' }).get('/welcome');

    // Then
    expect(result.response.body).toEqual({ message: 'Bienvenue' });
});
```

#### Isolation between specs (rules `one-terminal-action-per-chain`, `sequence-expressed-by-seeding`)

Databases are **reset at the start of every chain**. A spec never depends on a previous spec, and there is no "flow" mode — sequential scenarios are expressed through seeds:

```typescript
test('starts clean between specs', async () => {
    // Given - nothing (every chain resets the databases: one spec = ONE action)
    const result = await api.get('/orders');

    // Then
    await expect(result.table('orders', { database: 'db' })).toBeEmpty();
});
```

### Actions (terminal)

Exactly one per chain (rule `one-terminal-action-per-chain`). Each executes the spec and resolves to the result.

| Action                                   | Description                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| ``.request(`POST /users …`)``            | Execute the complete request written in the test, `.http` text, dedented              |
| `.request(file('./requests/file.http'))` | Execute the complete request that `.http` file describes — when several tests send it |
| `.get(path, { params }?)`                | Inline GET — for simple cases where a file would be excessive                         |
| `.post(path, body?, { params }?)`        | Inline POST                                                                           |
| `.put(path, body?, { params }?)`         | Inline PUT                                                                            |
| `.delete(path, { params }?)`             | Inline DELETE                                                                         |

The `body?` of `.post()` / `.put()` is a plain object, JSON-serialized with a `Content-Type: application/json` default header — or a body file from `requests/`, `.post(path, file('./requests/order.json'))`: a `.json` is parsed and sent as that value, any other extension is sent as its text. A complete request — method, headers and body — goes through `.request(file('./requests/file.http'))`, whose body section is sent **raw**: its surrounding whitespace is trimmed, but everything between is preserved byte-for-byte (interior double spaces, indentation, and non-JSON text are intact).

A route with parameters is written as the app declares it, its values beside it: `.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })`. The template types the params — every `:name` it holds takes a value, and no other name does (rule `route-written-as-template`) — and the chain sends the path filled, each value URI-encoded, the query kept. The template is what the test's reader, the subject reader (`one-subject-per-spec`, `spec-in-subject-folder`) and route coverage read, so none of them has to guess that `btc` is a value. A path with no parameter takes no options, or `{ params: {} }` to state that it is the route itself.

There is no label argument: the vitest test name is the spec's only description (rule `no-chain-label`).

```typescript
test('returns 404 with a useful body', async () => {
    // Given - empty database
    const result = await api.get('/users/999');

    // Then - the whole response, written in place
    expect(result.response).toMatch(`
        HTTP/1.1 404 Not Found

        {"error": "User 999 not found"}
    `);
});
```

### `.http` request files — full format

Requests live in `requests/`, one file per request, extension `.http`; the body files a verb sends live beside them, each named with its extension (rule `request-file-extension-known`). A request file is the **complete** request: method + path on the first line, then headers, then a blank line, then the body.

```http
### requests/create-user.http
POST /users
Content-Type: application/json
Accept-Language: fr

{ "name": "Alice" }
```

Format rules:

- First line: `METHOD /path` — the file must start with it (rule `request-file-extension-known`). The path is relative to the app under test.
- Header lines: `Name: value`, one per line, immediately after the request line.
- Blank line, then the body (optional — a GET usually has none).
- Executed with `api.request(file('./requests/create-user.http'))` — the argument is the file's path from the spec file, spelled in full; the type refuses a bare name (rule `disk-named-by-relative-path`).

Expected responses live in `expected/`, like every other golden, same extension, and start with a status line (rule `expected-headers-are-a-subset`):

```http
### expected/user-created.http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /users/{{uuid#user}}

{ "id": "{{uuid#user}}", "name": "Alice" }
```

- First line: `HTTP/1.1 <status>` — mandatory.
- Headers are matched as a **subset**: listed headers must match, unlisted headers are unconstrained (rule `expected-headers-are-a-subset`).
- Body and headers both accept `{{token}}` placeholders, including `#ref` captures — `{{uuid#user}}` above must be the _same_ UUID in the `Location` header and the body. See [tokens](15-tokens.md).
- The body is read by its `content-type` — the file's own, or the actual response's when the file states none — with its surrounding whitespace trimmed on both sides. A text type (`text/*`, `+xml`, `application/xml`, `application/x-ndjson`, …) is the text it is, even a `42` or a `true`: an HTML page, an event stream, a plain message. A binary type — `audio/*`, `font/*`, `image/*`, `video/*`, and under `application/` exactly `gzip`, `octet-stream`, `pdf`, `protobuf`, `vnd.google.protobuf`, `wasm`, `x-gzip`, `x-protobuf`, `x-tar` and `zip` — is not read: its body is `null`, so its `.http` states the status and the headers and no body. Any other type — a JSON type, one the lists above do not name (`application/graphql`, `multipart/*`), or no type at all — is the JSON value its text parses to, or its text when it does not parse.

## The result

The result of an API action exposes read-only accessors (rule `result-accessor-is-read-only`); all assertions go through `expect()`:

| Member                      | Type             | Description                                                                                                             |
| --------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `result.status`             | `number`         | HTTP status code — assert with native `expect(...).toBe(...)`                                                           |
| `result.response`           | response subject | Full response (status + headers + body) — compared whole, `toMatch(<.http text>)` or `toMatch(file(…))`                 |
| `result.response.body`      | body             | The JSON value, or the text of a text body or one that is not JSON; `null` when empty or binary — for native assertions |
| `result.table(name, opts?)` | table subject    | Database table — compared whole, `toMatch(<rows>)` / `toBeEmpty()` (async, `await expect`)                              |

`expect(result.response).toMatch(file('./expected/user-created.http'))` reads the path it is given, like every other golden matcher (rule `golden-read-from-its-path`) — nothing resolves against a folder the line does not name. The full matcher reference is in [assertions](14-assertions.md).

Beyond the result, the `specification.api()` handle destructures to `{ api, cleanup, docker }`. The `docker(containerId)` reader lazily runs `docker inspect` and returns a `ContainerAccessor` for an arbitrary container id — usable with `await expect(docker(id)).toBeRunning()` and the sync read accessors (`.exists`, `.status`, `.file(path)`, logs). An unknown id yields `exists: false` instead of throwing. (`specification.job()` has no `docker` member — jobs never spawn containers.)

## Unique here

### Full example — a multi-database order flow

```http
### requests/new-order.http
POST /orders
Content-Type: application/json

{ "sku": "KB-42", "quantity": 1 }
```

```http
### expected/order-created.http
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
// specs/api/orders/create/analytics.spec.ts — POST /orders, what it writes where
import { describe, expect, test } from 'vitest';
import { file, match } from '@jterrazz/test';
import { api } from '../../api.specification.js';

describe('analytics', () => {
    test('ingests an order event into analytics', async () => {
        // Given - catalog in the main database, analytics empty
        const result = await api
            .seed(file('./seeds/catalog.sql'), { database: 'db' })
            .request(file('./requests/new-order.http'));

        // Then - one row per database, targeted by record key
        await expect(result.table('orders', { database: 'db' })).toMatch([
            ['{{uuid}}', 'pending', '{{number}}', '{{iso8601}}'],
        ]);
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, '{{uuid}}', 'order_created'],
        ]);
    });

    test('returns the created order with consistent ids', async () => {
        // Given
        const result = await api
            .seed(file('./seeds/catalog.sql'), { database: 'db' })
            .request(file('./requests/new-order.http'));

        // Then - {{uuid#order}} appears 3 times (Location header included) → all equal
        expect(result.response).toMatch(file('./expected/order-created.http'));
    });
});

test('links the analytics event to the created order', async () => {
    // Given
    const result = await api
        .seed(file('./seeds/catalog.sql'), { database: 'db' })
        .request(file('./requests/new-order.http'));

    // Then - same id on both sides, without ever knowing its value
    await expect(result.table('orders', { database: 'db' })).toMatch([
        [match.ref('order'), 'pending', '{{number}}', '{{iso8601}}'],
    ]);
    await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
        [1, match.ref('order'), 'order_created'],
    ]);
});
```

> This project declares two databases, so `database:` is mandatory on every `.seed()` and `.table()` (rule `database-named-only-when-several`). With a single database you would write `api.seed(file('./seeds/catalog.sql'))` and `result.table('orders')` — and adding `database:` would be forbidden as redundant.

### A case, written whole

A case is a TypeScript spec whose oracle is the WHOLE result, written where the test reads it: the given is the chain's setups — a seed is always a `.sql` file named with `file()`, beside the test when it alone reads it — the action is the request, and the response is compared whole to its `.http` text in place, tokens allowed ([14](14-assertions.md#one-verb-compares-a-whole-result-and-its-argument-says-where-the-expectation-lives)):

```typescript
test('the users seeded are the users listed, in the order they were inserted', async () => {
    // Given - two users, from the seed beside the test
    const result = await api.seed(file('./seeds/alice-and-bob.sql')).get('/users');

    // Then - the whole response, and the table it read
    expect(result.response).toMatch(`
        HTTP/1.1 200 OK
        content-type: application/json

        {"users": [{"name": "Alice", "email": "alice@test.com"}, {"name": "Bob", "email": "bob@test.com"}]}
    `);
    await expect(result.table('users')).toMatch([
        [1, 'Alice', 'alice@test.com'],
        [2, 'Bob', 'bob@test.com'],
    ]);
});
```

A journey — a request carrying what an earlier response returned — is code: read the value from the first result, send it in the next chain. `TEST_UPDATE=1` writes an empty `toMatch('')` with what came back ([15](15-tokens.md#a-value-written-in-place-is-rewritten-in-the-test)).

### Route coverage

Line coverage says which lines of the app ran; it cannot say which routes no case asked for. The api project measures it at run time: every request a test sends is recorded, and after the last test the run names each route the app declares that no request reached. The measure is the `api()` project's global setup; a project written by hand measures nothing.

```
api routes: all 12 declared routes reached
```

#### What is measured

- **The table is the app's own** — Hono's `app.routes`, read from the app each `specification.api()` started — so it is the table that served the tests, never a copy that can drift from it.
- **A middleware is left out.** An entry whose handler takes `next` is one, by Hono's own rule. A route `app.all()` declares is judged like any other, reached by a request of any method.
- **A path parameter** (`:id`) takes any one segment, a `*` tail the rest of the path.
- **A request written as a template is matched by its template**: a parameter where the route declares one, each literal segment as itself — so `.get('/users/:id', { params: { id: 'me' } })` reaches `GET /users/:id` and never a `GET /users/me` the filled path also fits.

#### The ratchet

A route no test reached fails the run, each one named. The count is a ratchet, held under `jterrazz.baseline.json › test › routes/unreached`: `TEST_UPDATE=1` records where the run stands, and the checker's own recordings keep that key. The entry is exact in both directions — a run that reaches more routes than it held fails too, since the debt fell, until `TEST_UPDATE=1` records the lower count.

#### When a run is not judged

A run is judged, and `TEST_UPDATE=1` records, only when it is green and whole. Otherwise it prints a line and records nothing:

| The run                                                                       | Prints                                                   | Why                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a file of it failed                                                           | `api routes: not judged`, with the count of failed files | a failed file may not have sent its requests; `TEST_UPDATE=1` refuses and keeps the entry                                                                                        |
| a shard (`vitest --shard`)                                                    | `api routes: not judged`                                 | its requests are a part of the run's; it writes its ledgers to `.artifacts/vitest/routes/shard-<index>-<count>/`                                                                 |
| a merge (`vitest --merge-reports`)                                            | nothing                                                  | a merge runs no global setup; this package's own split judges its routes after the merge, over every shard's ledgers ([03 — Testing § What CI runs](03-testing.md#what-ci-runs)) |
| partial — some test files (`vitest --changed`, a file filter) or tests (`-t`) | `api routes: not judged — a partial run …`               | it reached only some routes; a shard that `-t` filters marks its ledger folder partial, so its split is not judged at the merge                                                  |

#### An app that is not Hono

A `server` that returns anything but the Hono app itself exposes no table the facet reads, and fails the run, since a measure against no table would read as every route reached. It states its routes instead, as an OpenAPI document (JSON or YAML) named in `jterrazz.config.ts`:

```typescript
// jterrazz.config.ts
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({ test: { routes: './openapi.yaml' } });
```

#### A route taken on any method

A route the app takes on any method — `app.all('/mcp', …)` — is one the member names in `jterrazz.config.ts`, `test: { methodless: ['/mcp'] }`, so the checker files its specs under its path whatever verb they send ([18 — Conventions § The subject, and its standard name](18-conventions.md#the-subject-and-its-standard-name)). The run holds that list to the app's own table, and fails naming each mismatch — under `TEST_UPDATE=1` too, since the list is written by hand and nothing records it:

- a route the table takes on any method that the list misses;
- a path the list names that the table takes on its own methods only, or holds nowhere.

The list is judged whenever the app exposes a route table of its own, an OpenAPI document declared or not; a `server` that is not the Hono app exposes none, and leaves the list unjudged.

The app runs in THIS process, always: there is no second mode, no container binding and no `TEST_MODE`. Why compose mode left, and what was weighed against keeping it: [ADR-007](decisions/007-compose-mode-leaves-the-package.md).

## Pitfalls

- **Omitting `database:` with ≥ 2 databases, or passing it with 1** — both are convention violations (rule `database-named-only-when-several`).
- **Expecting unlisted response headers to be constrained.** Response `expected/*.http` header matching is subset-only; if a header must be _absent_, that is not expressible in the file — assert on it in code.
- **Chaining two actions** (`api.get(...).get(...)`) or reusing state across tests. One chain = one terminal action; databases reset per chain (rules `one-terminal-action-per-chain`, `sequence-expressed-by-seeding`).
- **Forgetting that `.intercept()` is strict.** After the first `.intercept()`, an unmatched or queue-exhausted outgoing request fails the spec (rule `network-strict-after-first-stub`).
- **Putting the request body in the test file when it has any substance.** Requests of more than a line or two belong in `requests/*.http` — inline `.post()` is for trivial cases.

## Related

[11 — Job specs](11-job.md) · [14 — Assertions](14-assertions.md) · [15 — Tokens](15-tokens.md) · [16 — Stubs](16-stubs.md) · [17 — Services](17-services.md)
