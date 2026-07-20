# @jterrazz/test

Declarative testing framework for APIs, jobs, CLIs, and websites. Four constructors — `specification.api()`, `specification.jobs()`, `specification.cli()`, `specification.website()` — and specs that read as sentences: given → action → assertions. The vitest test name is the spec's description; all assertions go through `expect()` with auto-registered, subject-typed matchers.

```bash
npm install -D @jterrazz/test vitest
```

Everything imports from `@jterrazz/test` — the one exception is the tool-facing `@jterrazz/test/oxlint` subpath (the zero-runtime lint plugin and its config fragment), which never loads any test runtime.

## Quick start

### API testing (HTTP)

```typescript
// specs/api/api.specification.ts
import { afterAll } from 'vitest';
import { postgres, specification } from '@jterrazz/test';
import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({
    services: { db: postgres() }, // → compose service "db"
    server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
});

afterAll(cleanup);
```

```typescript
// specs/api/users/users.test.ts
import { expect, test } from 'vitest';
import { api } from '../api.specification.js';

test('creates a user', async () => {
    // Given - the complete request from requests/create-user.http
    const result = await api.request('create-user.http');

    // Then - status + headers + body from expected/user-created.http; row in db
    expect(result.response).toMatch('user-created.http');
    await expect(result.table('users')).toMatchRows({
        columns: ['name'],
        rows: [['Alice']],
    });
});
```

### CLI testing

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
// specs/cli/build/build.test.ts
import { expect, test } from 'vitest';
import { cli } from '../cli.specification.js';

test('builds the project', async () => {
    // Given - sample app project spread into the cwd
    const result = await cli.fixture('$FIXTURES/sample-app/').exec('build');

    // Then - ESM output, no CJS
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Build completed');
    expect(result.file('dist/index.js').exists).toBe(true);
    expect(result.file('dist/index.cjs').exists).toBe(false);
});
```

### Website testing (browser)

```typescript
// specs/website/website.specification.ts
import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, website } = await specification.website({
    server: { command: 'node specs/fixtures/website-app/server.mjs', ready: '/' },
});

afterAll(cleanup);
```

```typescript
// specs/website/visit/head.test.ts
import { expect, test } from 'vitest';
import { website } from '../website.specification.js';

test('captures the full head surface of a rendered page', async () => {
    // Given - the fixture homepage
    const result = await website.visit('/');

    // Then - one golden covers title, canonical, alternates, and metas
    expect(result.status).toBe(200);
    expect(result.head).toMatch('home.head.json');
});
```

Actions are **terminal**: `.request()`, `.get()`, `.trigger()`, `.exec()`, `.fetch()`, `.visit()` execute the spec and resolve to a precisely typed result. There is no `.run()`, no label, and no `.spawn()`.

## The four constructors

One constructor per tested interface, each returning a record destructured with its canonical name:

| Constructor                       | Returns                                  | Terminal actions                                             |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| `specification.api(options)`      | `{ api, cleanup, docker, orchestrator }` | `.request(file)`, `.get()`, `.post()`, `.put()`, `.delete()` |
| `specification.jobs(options)`     | `{ jobs, cleanup, orchestrator }`        | `.trigger(name)`                                             |
| `specification.cli(bin, options)` | `{ cli, cleanup, docker, orchestrator }` | `.exec(args, { waitFor?, timeout? }?)`                       |
| `specification.website(options)`  | `{ website, cleanup, url }`              | `.fetch(path)`, `.visit(path, scenario?)`                    |

### `specification.api({ services, server, mode?, root? })`

One definition, two execution modes — the switch lives in `vitest.config.ts`, never in the specification file:

- **`node`** (default): starts the declared services via testcontainers and runs the app in-process (Hono). Fastest feedback loop.
- **`compose`**: runs `docker compose up` on `docker/compose.test.yaml` and sends real HTTP to the app service (`server` is ignored). Proves the shipped artifact.

Resolution: `options.mode` > `TEST_MODE` env var > `'node'`. Only `.api()` has a mode.

```typescript
// vitest.config.ts — the mode switch lives HERE
export default defineConfig({
    test: {
        projects: [
            { test: { name: 'http', include: ['specs/api/**/*.test.ts'] } },
            {
                test: {
                    name: 'http-stack',
                    include: ['specs/api/**/*.test.ts'],
                    env: { TEST_MODE: 'compose' },
                },
            },
        ],
    },
});
```

`services` is a named record. Keys type the `server` factory parameters, name databases for `.seed()`/`.table()` (`{ database: 'analyticsDb' }`), and drive the compose binding — a handle with no `composeService` option links to the compose service named exactly like its key, else the kebab-case conversion of the key (`analyticsDb` → `analytics-db`). If both names exist the binding is ambiguous and throws; `composeService` is the escape hatch for non-derivable names.

### `specification.jobs({ services, jobs, root? })`

Background jobs run in-process by definition — no HTTP server, no mode:

```typescript
export const { jobs, cleanup } = await specification.jobs({
    services: { db: postgres() },
    jobs: ({ db }) => [nightlyReport(db)], // (services) => JobHandle[], or a static array
});

// In a test:
const result = await jobs.seed('pending.sql').trigger('nightly-report');
```

A `JobHandle` is `{ name: string; execute: () => Promise<void> }`.

### `specification.cli(bin, { root?, services?, docker?, transform? })`

Runs a command binary against fixture projects in fresh temp directories. With `services`, connection URLs are injected into the child env automatically: `<KEY>_URL` per record key (CONSTANT_CASE at camelCase boundaries — `analyticsDb` → `ANALYTICS_DB_URL`), plus `DATABASE_URL` (exactly one SQL database) and `REDIS_URL` (exactly one redis). `.env()` overrides; `null` unsets.

```typescript
export const { cli, cleanup } = await specification.cli('my-migrate-tool', {
    services: { db: postgres() },
});

// DATABASE_URL / DB_URL are already in the child env:
const result = await cli.seed('legacy-schema.sql').exec('up');
```

### `specification.website({ server?, url?, external?, root? })`

Tests a rendered website: `.fetch(path)` for a raw HTTP exchange (redirects never followed), `.visit(path, scenario?)` for a page rendered in a real chromium. Exactly one of `server` (start the site locally — a free port injected as `PORT`, polled on `ready`) or `url` (target a running site) is required.

```typescript
export const { website, cleanup } = await specification.website({
    server: { command: 'node specs/fixtures/website-app/server.mjs', ready: '/' },
});

// Raw exchange — status + headers, redirects surface as 3xx
const redirect = await website.fetch('/old');

// Rendered page, optionally driven by a scenario (the When)
const page = await website.visit('/', async (visitor) => {
    await visitor.click(link('Articles'));
});
```

The handle destructures to `{ website, cleanup, url }` — no `docker`, no `orchestrator`. `.visit()` needs playwright (`npm install -D playwright && npx playwright install chromium`) — an optional peer dependency, only loaded when a spec actually renders a page. Full reference: [docs/11-website.md](docs/11-website.md).

### Root auto-discovery

When `root` is absent, the framework walks up from the specification file to the first directory containing `docker/compose.test.yaml`, else the first containing `package.json`. Pass `root` only when the convention does not fit. `root` is strictly the **project root** (compose detection + local-bin resolution, or the cwd of a `specification.website()` server command) — it is not a fixtures root; `.fixture()` resolves its own paths.

## Builder API

### Setup (chainable)

| Method                                  | Facets       | Description                                                                                            |
| --------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| `.seed("file.sql", { database? })`      | all          | Load SQL from `seeds/` — `database` is the record key (mandatory with ≥ 2 databases, forbidden with 1) |
| `.fixture("file")`                      | cli          | Copy the feature-local `fixtures/file` into the working directory                                      |
| `.fixture("$FIXTURES/name/")`           | cli          | Spread the shared `specs/fixtures/name/` project into the cwd (trailing `/` = contents; layers)        |
| `.env({ KEY: "value" })`                | cli          | Set env vars on the child (`null` unsets, `$WORKDIR` expands, calls merge)                             |
| `.headers({ "Accept-Language": "fr" })` | api, website | Set HTTP request headers (merge on top of `.http` file headers, or on the browser context)             |
| `.intercept(contract)`                  | api, jobs    | Intercept an outgoing HTTP call with a declared contract                                               |
| `.intercept(trigger, response)`         | api, jobs    | Inline intercept for one-off cases                                                                     |

### Actions (terminal)

| Method                                     | Facet   | Resolves to   | Description                                                                           |
| ------------------------------------------ | ------- | ------------- | ------------------------------------------------------------------------------------- |
| `.request("create-user.http")`             | api     | `HttpResult`  | Send the COMPLETE request from `requests/<file>` (method, path, headers, raw body)    |
| `.get(path)` / `.delete(path)`             | api     | `HttpResult`  | Inline requests for simple cases                                                      |
| `.post(path, body?)` / `.put(path, body?)` | api     | `HttpResult`  | Inline body: plain object, JSON-serialized                                            |
| `.trigger("name")`                         | jobs    | `BaseResult`  | Execute a registered job                                                              |
| `.exec("args")`                            | cli     | `CliResult`   | Run the command                                                                       |
| `.exec(["build", "start"])`                | cli     | `CliResult`   | Sequence in the same cwd; stops on first non-zero exit                                |
| `.exec("dev", { waitFor, timeout? })`      | cli     | `CliResult`   | Long-running: resolves at the pattern, killed at `timeout` (default 10 s)             |
| `.fetch(path)`                             | website | `FetchResult` | One raw HTTP exchange — redirects surface as 3xx, never followed                      |
| `.visit(path, scenario?)`                  | website | `PageResult`  | Render the page in a shared chromium; with a scenario, the capture is the final state |

One chain = one terminal action; databases reset at the start of every chain. Every cli spec runs in a fresh, empty temp directory.

## Assertions — everything through `expect()`

Accessors are **read-only**; the framework registers subject-typed matchers on vitest's `expect` automatically. `await` is required exactly where IO happens (tables, trees, containers).

```typescript
// HTTP
expect(result.status).toBe(201);
expect(result.response).toMatch('user-created.http'); // expected/<name> — status + header subset + body
expect(result.response.body).toEqual({ error: 'User 999 not found' });

// Tables (async — queries the database)
await expect(result.table('orders', { database: 'db' })).toMatchRows({
    columns: ['id', 'status', 'created_at'],
    rows: [[match.uuid(), 'pending', match.iso8601()]],
});
await expect(result.table('orders', { database: 'db' })).toBeEmpty();

// Streams (ANSI stripped by default; .text stays raw)
expect(result.stdout).toContain('Build completed');
expect(result.stdout).toMatch('help.txt'); // expected/help.txt — {{token}}-aware
expect(result.json).toMatch('config.json'); // expected/config.json
expect(result.json.value).toMatchObject({ name: 'shoply' });

// Files & trees
expect(result.file('my-shop/shoply.yaml').content).toContain('name: my-shop');
await expect(result.directory('my-shop')).toMatch('shop-scaffold'); // expected/shop-scaffold/
await expect(result.filesystem).toMatch('upgraded-shop'); // whole cwd

// Containers (docker-aware cli)
await expect(result.container('alpha')).toBeRunning();
```

`toMatch` always resolves against `expected/<name>` — every subject, no exceptions (only `.request()` reads `requests/`). The folder is flat: a slash in the name creates a subfolder; the extension is part of the name and required, except for tree snapshots which are directories.

**Updating snapshots:** `TEST_UPDATE=1` or `vitest -u`. Update mode writes **tokens**, not values — segments covered by an existing placeholder are preserved, and `{{workdir}}` is substituted automatically.

## Dynamic values — one `{{token}}` grammar

The same vocabulary works in `expected/*.http` (body AND headers), `expected/*.json`, text snapshots, and tree-snapshot file contents — and in code via `match.*`:

`uuid` `ulid` `iso8601` `date` `time` `duration` `number` `int` `float` `semver` `sha` `hex` `base64` `port` `ip` `url` `email` `path` `workdir` `string` `any`

Each token is capturable via `{{type#ref}}`: the first occurrence captures, later occurrences must be equal (scope: one spec). Code-side: `match.ref('order')`, `match.ref('intent', { not: 'order' })`, `match.regex(/…/)`.

```http
### expected/order-created.http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /orders/{{uuid#order}}

{
    "id": "{{uuid#order}}",
    "total": "{{number}}",
    "createdAt": "{{iso8601}}"
}
```

See [docs/06-tokens.md](docs/06-tokens.md) for the canonical accepted form of every token.

## Intercept contracts

External interactions (LLM providers, third-party APIs) are declared as **contracts**: one file per interaction under `contracts/`, flat, with a provider suffix — `contracts/<name>.<provider>.ts`, `provider ∈ { openai, anthropic, http }`:

```typescript
// contracts/classify-product.openai.ts
import { defineContract, openai } from '@jterrazz/test';

export default defineContract({
    trigger: openai.responses({ user: /Product Classification/, tools: ['classify'] }),
    response: openai.reply({ category: 'ELECTRONICS', confidence: 0.97 }),
});
```

```typescript
const result = await jobs.intercept(classifyProduct).trigger('nightly-report');
```

Inline `.intercept(trigger, response)` and JSON fixtures (`intercepts/<provider>/<name>.json`) remain for one-off cases. Failure simulation: `openai.error(429)`, `anthropic.timeout()`, `openai.malformed('not json')`. Intercepts queue FIFO per trigger. MSW ships as a direct dependency — no separate install.

## Docker-aware CLIs

For CLIs that spawn containers, declare `docker: { envVar, nameLabel, testRunLabel }`. The runner injects a unique test-run id into the child env; the tested binary must label its containers with `testRunLabel=<id>`. Results expose lazy `.container(name)` accessors — and must be bound with `await using` so leaked containers are force-removed at scope exit:

```typescript
test('deploy spawns a labelled container', async () => {
    // Given
    await using result = await cli.fixture('$FIXTURES/two-shops/').exec('deploy alpha');

    // Then - property reads are sync; only the matcher is async
    const shop = result.container('alpha');
    expect(shop.exists).toBe(true);
    await expect(shop).toBeRunning();
    expect(shop.file('/app/shoply.yaml').content).toContain('name: alpha');
});
```

## Service factories

| Factory      | Options                          | Connection string                     |
| ------------ | -------------------------------- | ------------------------------------- |
| `postgres()` | `composeService`, `image`, `env` | `postgresql://user:pass@host:port/db` |
| `redis()`    | `composeService`, `image`        | `redis://host:port`                   |
| `sqlite()`   | `init` or `prismaSchema`         | `file:/tmp/....sqlite`                |

`docker/compose.test.yaml` is the single source of truth for test infrastructure; `docker/<service>/init.sql` runs when the corresponding service starts. Parallel isolation is automatic per vitest worker: postgres clones a schema, redis assigns a database index, sqlite copies the template file, compose mode gets a dedicated project.

## Mocking utilities

```typescript
import { mockOf, mockOfDate } from '@jterrazz/test';
```

| Export        | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| `mockOf<T>()` | Deep mock of any interface (wraps `vitest-mock-extended`)    |
| `mockOfDate`  | Freeze/reset the global Date via `.set(date)` and `.reset()` |

## Conventions

Normative rules live in the constitution ([docs/09-conventions.md](docs/09-conventions.md)); the generated per-rule catalogue is [docs/10-linting.md](docs/10-linting.md). A facet (`specs/<facet>/`) carries its runner(s) at its root and holds domain folders; the folder follows the assets:

```
specs/<facet>/                  # api | jobs | cli | integrations | lint
├── <facet>.specification.ts    # runner(s) at the facet ROOT (rule C1)
└── <domain>/                   # a product command/area — 1..n test files
    ├── <aspect>.test.ts
    ├── seeds/          # *.sql ONLY — database state
    ├── requests/       # *.http — inputs: COMPLETE request (method, path, headers, body)
    ├── contracts/      # <name>.<provider>.ts — declared external interactions
    ├── intercepts/     # <provider>/<name>.json — inline intercept fixtures
    ├── fixtures/       # domain-local files/dirs copied into the cwd (cli) — shared pool lives at specs/fixtures/
    └── expected/       # ALL expected fixtures, FLAT (incl. response *.http) — a slash in the name creates a subfolder
```

A test with its OWN asset dirs gets its own domain folder; tests without local assets group as sibling `<aspect>.test.ts` files inside a named group folder (the folder follows the assets). `.fixture(path)` is the one verb that copies into the cwd: domain-local (`fixtures/…`) or shared (`$FIXTURES/…` → `specs/fixtures/…`), with rsync trailing-slash semantics and layering. `.seed()` is SQL-only.

Every test contains `// Given -` and `// Then -` comments (always both; `// When -` only if the action is not obvious — the chain IS the when). User-facing framework env vars: `TEST_MODE` and `TEST_UPDATE` — the only ones you set; the framework also reads vitest's `VITEST_POOL_ID` for per-worker isolation.

### Convention enforcement — the shipped lint plugin

These conventions are not just prose: the package ships an oxlint plugin (`@jterrazz/test/oxlint`) with ~40 AST rules, plus a `jterrazz-test-check` binary (the conventions checker) that reads the data fixtures and cross-file relationships oxlint cannot. Wire the plugin into your `oxlint.config.ts` and run `jterrazz-test-check specs` in CI — the full four-channel catalogue (each rule, its channel and rationale) is generated into [docs/10-linting.md](docs/10-linting.md).

## Requirements

- **Docker** - testcontainers for node mode, docker compose for compose mode; not needed for `sqlite()`, plain cli specs, or website specs
- **vitest** - peer dependency
- **playwright** - optional peer dependency, only needed for `.visit()`: `npm install -D playwright && npx playwright install chromium`
- **msw** - bundled as a direct dependency (powers `.intercept()`); no separate install
- **hono** (or any web framework) - supplied by your project for in-process apps; the adapter only needs an object with a `request()` method, so it is not a peer

## Docs

- Guide (chapters): [docs/README.md](docs/README.md) — getting started, API/jobs/CLI/website specs, assertions, tokens, contracts, services, conventions, linting
- API reference: committed under [docs/reference/](docs/reference/) — compiled from source by `npm run docs`
- Agent skill: [skills/jterrazz-test/](skills/jterrazz-test/) — mental model, per-facet references, generated rule reference
