# `@jterrazz/test` - API cheat sheet

> For the full generated reference, see <https://jterrazz.github.io/package-test/llms-full.txt>. This file is the agent-facing condensed view.

## Imports — single entry point

```typescript
import {
    anthropic,
    defineContract,
    http,
    match,
    mockOf,
    mockOfDate,
    openai,
    postgres,
    redis,
    specification,
    sqlite,
    text,
} from '@jterrazz/test';
```

Subpaths do not exist (`@jterrazz/test/services` etc. are gone).

## Spec shape

```
api/jobs/cli -> setup (chainable) -> action (terminal, resolves to typed result)
              -> assertions via expect() matchers on read-only accessors
```

No `.run()`, no label — the vitest test name is the spec's description; every builder method on the facet starts a fresh spec, and databases reset at the start of every chain.

## Runner creation (in `*.specification.ts` files, `afterAll(cleanup)`)

| Pattern                                                             | Returns                                  | Description                                         |
| ------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| `specification.api({ services, server, mode?, root? })`             | `{ api, cleanup, docker, orchestrator }` | HTTP app — node mode (default) or compose mode      |
| `specification.jobs({ services, jobs, root? })`                     | `{ jobs, cleanup, orchestrator }`        | Background jobs — in-process by definition, no mode |
| `specification.cli(bin, { root?, services?, docker?, transform? })` | `{ cli, cleanup, docker, orchestrator }` | Command binary — child process in a fresh temp dir  |

- `mode` (`'node' | 'compose'`) exists ONLY on `.api()`. Resolution: param > `TEST_MODE` env > `'node'`. The switch lives in `vitest.config.ts` (`env: { TEST_MODE: 'compose' }`), never in the specification file.
- `server: (services) => honoApp` — required in node mode, ignored in compose mode.
- `jobs: (services) => JobHandle[]` (or static array); `JobHandle = { name, execute: () => Promise<void> }`.
- `services` is a **named record** — `{ db: postgres(), analyticsDb: postgres() }`. Keys type the factory params, name the `database:` option, and drive the compose binding: exact name, else kebab-case of the key (`analyticsDb` → `analytics-db`); both present → ambiguity error; `composeService` is the escape hatch.
- `root` is auto-discovered (walk up to `docker/compose.test.yaml`, else `package.json`); pass it only as an override. It means the **project root** (compose detection + local-bin resolution) — NOT a fixtures root.
- Destructure with the canonical names — `{ api }`, `{ jobs }`, `{ cli }` — no aliasing.

## Setup methods (chainable)

| Method                                   | Facets    | Description                                                                                                                                                          |
| ---------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.seed("file.sql", { database: "key" })` | all       | Load SQL from `seeds/` (SQL ONLY). `database` = record key — MANDATORY with ≥ 2 databases, FORBIDDEN with 1 (A7)                                                     |
| `.fixture("file")`                       | cli       | Copy the feature-local `fixtures/file` into the working dir before exec                                                                                              |
| `.fixture("$FIXTURES/name/")`            | cli       | Shared `specs/fixtures/name/` project. Trailing `/` (rsync semantics) = **spread contents into cwd** (usual); no slash = **nest under `name/`**. Chained calls layer |
| `.env({ KEY: "value" })`                 | cli       | Set child env vars. `null` unsets. `$WORKDIR` expands to the temp cwd. Calls merge. Overrides B6 auto-injection.                                                     |
| `.headers({ "Accept-Language": "fr" })`  | api       | Set HTTP request headers. Merge on top of `.http` file headers (chain wins).                                                                                         |
| `.intercept(contract)`                   | api, jobs | Intercept with a declared contract                                                                                                                                   |
| `.intercept([contract, …])`              | api, jobs | Array of contracts, registered in order (same-trigger entries queue FIFO — identical to consecutive calls)                                                           |
| `.intercept(trigger, response)`          | api, jobs | Inline intercept (response may be an `intercepts/<provider>/<file>.json` fixture path)                                                                               |
| `.intercept(trigger, (request) => resp)` | api, jobs | Dynamic response — `(request: MatchableRequest) => InterceptResponse`, evaluated per consumed request (also valid as a contract's `response`)                        |

## Action methods (terminal)

**api:**

| Method                                     | Resolves to  | Notes                                                   |
| ------------------------------------------ | ------------ | ------------------------------------------------------- |
| `.request("create-user.http")`             | `HttpResult` | COMPLETE request from `requests/<file>` — body sent raw |
| `.get(path)` / `.delete(path)`             | `HttpResult` | Inline                                                  |
| `.post(path, body?)` / `.put(path, body?)` | `HttpResult` | Inline body = plain object, JSON-serialized             |

**jobs:**

| Method             | Resolves to  |
| ------------------ | ------------ |
| `.trigger("name")` | `BaseResult` |

**cli** (single execution method — `.spawn()` does not exist):

| Method                                | Resolves to | Notes                                                                                         |
| ------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `.exec("args")`                       | `CliResult` | Blocking                                                                                      |
| `.exec(["build", "start"])`           | `CliResult` | Sequential in the same temp dir; stops on first failure                                       |
| `.exec("dev", { waitFor, timeout? })` | `CliResult` | Long-running — resolves at the pattern (exit 0), killed at `timeout` (default 10 s, exit 124) |

## Auto-injected child env (cli + services, rule B6)

`<KEY>_URL` for every service in the record — the key in CONSTANT_CASE with camelCase boundaries split (`db` → `DB_URL`, `analyticsDb` → `ANALYTICS_DB_URL`, `cache` → `CACHE_URL`) — plus the unambiguous aliases: `DATABASE_URL` (exactly one SQL database), `REDIS_URL` (exactly one redis). `.env()` overrides; `null` removes.

## Assertions — ALL via `expect()` (accessors are read-only)

`await` exactly the IO matchers: `toMatchRows`, `toBeEmpty`, `toBeRunning`, and `toMatch` on tree subjects.

| Expression                                                                               | Subject             | Fixture root                                                                       |
| ---------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `expect(result.status).toBe(201)` / `expect(result.exitCode)...`                         | scalar              | —                                                                                  |
| `expect(result.response).toMatch('created.http')`                                        | response            | `expected/<name>` — status + header subset + body                                  |
| `expect(result.response.body).toEqual({...})`                                            | raw body            | —                                                                                  |
| `expect(result.stdout).toContain('hello')`                                               | stream              | — (ANSI stripped by default; `.text` raw)                                          |
| `expect(result.stdout).toMatch('help.txt')`                                              | stream              | `expected/<name>` — `{{token}}`-aware                                              |
| `expect(result.json.value).toMatchObject({...})`                                         | parsed JSON         | —                                                                                  |
| `expect(result.json).toMatch('config.json')`                                             | JSON                | `expected/<name>` — `{{token}}`-aware                                              |
| `expect(result.file('x').exists).toBe(true)` / `.content`                                | file (sync)         | —                                                                                  |
| `await expect(result.directory('out')).toMatch('scaffold')`                              | tree                | `expected/<name>/` (directory)                                                     |
| `await expect(result.filesystem).toMatch('upgraded')`                                    | whole cwd           | `expected/<name>/`                                                                 |
| `await expect(result.table('users', { database: 'db' })).toMatchRows({ columns, rows })` | table               | — (cells accept `match.*`)                                                         |
| `await expect(result.table('users', { database: 'db' })).toBeEmpty()`                    | table               | —                                                                                  |
| `await expect(result.container('alpha')).toBeRunning()`                                  | container           | —                                                                                  |
| `expect(result.stdout).toMatch('check-output.txt')`                                      | text (TextAccessor) | `expected/<name>` (tokens for volatile parts)                                      |
| `expect(result.stdout.grep('error.ts')).toContain('no-unused-vars')`                     | text (TextAccessor) | `.grep()` returns a TextAccessor — chainable/snapshot-able                         |
| `expect(result.file('out.ts').grep('foo')).toMatch('block.txt')`                         | text (TextAccessor) | file text → grep → snapshot                                                        |
| `expect(text(errorMessage)).toMatch('errors/parse-error.txt')`                           | text (TextAccessor) | `text(str)` wraps ANY string (error msg / report) → golden it, don't probe-cluster |

- `result.stdout` / `result.stderr` / container logs / `file().grep()` are all `TextAccessor` (the universal text handle). `.grep(pattern)` returns a `TextAccessor` (never a bare string) → composable + snapshot-able. There is NO `result.grep()` — write `result.stdout.grep(...)`.
- `text(value)` (imported from `@jterrazz/test`) wraps an arbitrary string into a `TextAccessor` bound to the calling test's dir — ANSI-stripped by default (raw on `.text`), `{{token}}`-aware, `.grep()`-composable. Use it to golden OUR error messages / checker output / reports instead of a `try/catch` + N×`toContain` probe cluster.
- Tool output (linter/compiler/CLI): snapshot the WHOLE surface per scoped use case (`expect(result.stdout).toMatch('<use-case>.txt')`, tokens for volatile parts, `TEST_UPDATE=1`) — one fixture project per case, no shared `beforeAll`. `.grep()` is the scalpel for targeted probes only.
- `expected/` is FLAT; a slash in the name creates a subfolder. The extension is part of the name and required — except tree snapshots (directories).
- Update snapshots with `TEST_UPDATE=1` or `vitest -u` — update writes TOKENS: existing placeholders are preserved, `{{workdir}}` substituted automatically.
- Container property reads (`exists`, `running`, `status`, `file().content`, logs) are SYNC — the documented exception; only matchers are async.

## Dynamic values — `{{token}}` grammar + `match.*`

Same vocabulary in `expected/*.http` (body AND headers), `expected/*.json`, text snapshots, tree-file contents, and code:

`uuid` `ulid` `iso8601` `date` `time` `duration` `number` `int` `float` `semver` `sha` `hex` `base64` `port` `ip` `url` `email` `path` `workdir` `string` `any`

- Every token is capturable: `{{uuid#order}}` — first occurrence captures, later ones must be EQUAL. Ref scope = one spec.
- Code-side: `match.uuid()`, `match.ref('order')`, `match.ref('intent', { not: 'order' })` (inequality), `match.regex(/…/)`.
- `{{workdir}}` = the EXACT cwd of the current spec (equality, not a pattern).

## `.http` files

```http
### requests/create-user.http — the COMPLETE request
POST /users
Content-Type: application/json

{ "name": "Alice" }
```

```http
### expected/user-created.http — status + header SUBSET + body
HTTP/1.1 201 Created
Location: /users/{{uuid#user}}

{ "id": "{{uuid#user}}", "name": "Alice" }
```

## Intercept contracts

One file per interaction, FLAT under `contracts/` with a provider suffix: `contracts/<name>.<provider>.ts`, `provider ∈ { openai, anthropic, http }`:

```typescript
// contracts/classify-product.openai.ts
import { defineContract, openai } from '@jterrazz/test';

export default defineContract({
    trigger: openai.responses({ user: /Product Classification/, tools: ['classify'] }),
    response: openai.reply({ category: 'ELECTRONICS' }),
});
```

```typescript
import classifyProduct from './contracts/classify-product.openai.js';
const result = await jobs.intercept(classifyProduct).trigger('nightly-report');
```

| Helper                                                                      | Kind     | Notes                                                                           |
| --------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `defineContract({ trigger, response })`                                     | contract | Named interaction artifact                                                      |
| `openai.chat(filter?)`                                                      | trigger  | Chat Completions API; filter: `model`, `system`, `user`, `tools`, `temperature` |
| `openai.responses(filter?, url?)`                                           | trigger  | Responses API; filter: `model`, `system`, `user`, `tools` (NO `temperature`)    |
| `openai.reply(data)` / `.error(status)` / `.timeout()` / `.malformed(text)` | response | Envelope / failures                                                             |
| `anthropic.messages(filter?, url?)`                                         | trigger  | Messages API; gateway support; object fixtures pass through verbatim            |
| `anthropic.reply(data)` / `.error(status)` / `.timeout()`                   | response | Envelope / failures                                                             |
| `http.get/post/put/delete/any(url, filter?)`                                | trigger  | Any URL, string or RegExp; filter: `{ body?, headers?, query? }` subset match   |
| `http.json(data, status?)` / `http.error(status, msg?)`                     | response | Plain JSON                                                                      |
| `(request) => http.json({ ... })`                                           | response | Dynamic — computed per consumed request from `{ body, headers, url }`           |

Intercepts queue FIFO per trigger. `msw` ships as a direct dependency (no separate install). No `claude` alias — use `anthropic`.

**Strict (rule D7):** once a chain declares one `.intercept()`, every outgoing request must match a registered, unconsumed intercept — an unmatched or queue-exhausted request fails the spec (`Unmatched outgoing HTTP request during spec: <METHOD> <url>` + registered triggers and their consumption state). A chain with zero intercepts does not mount MSW (network not guarded). `.intercept()` is node-only — a compose-mode `specification.api()` runner throws (`intercepts are in-process (MSW) and not available in compose mode`); keep intercept specs in node-only vitest projects.

## Docker-aware CLIs

```typescript
export const { cli, cleanup, docker } = await specification.cli('my-cli', {
    docker: {
        envVar: 'MYCLI_TEST_RUN', // child env var receiving the test-run id
        nameLabel: 'com.mycli.world.name', // label used as .container(name) lookup key
        testRunLabel: 'com.mycli.test.run', // label the CLI must stamp with the id from envVar
    },
});

// ALWAYS `await using` (rule B5) so leaked containers are removed at scope exit
await using result = await cli.exec('spawn test-a');

const world = result.container('test-a'); // lazy: first access queries docker ps + inspect
world.exists;
world.running;
world.status;
world.id; // sync reads
expect(world.file('/workspace/out.txt').content).toContain('hello'); // docker exec cat
const inside = await world.exec('ls /workspace'); // CliResult from inside the container
expect(world.stdout).toContain('ready'); // container logs
await expect(world).toBeRunning(); // the async matcher
result.containerIds; // all captured container ids
```

Absent names return an accessor with `exists === false` (no throw). Tests that never call `.container(...)` never touch the Docker daemon. `docker(id)` on the handle reads an arbitrary container by id with the same accessor type.

## Service factories

| Factory      | Options                          | Connection string format              | Isolation per vitest worker    |
| ------------ | -------------------------------- | ------------------------------------- | ------------------------------ |
| `postgres()` | `composeService`, `image`, `env` | `postgresql://user:pass@host:port/db` | cloned schema                  |
| `redis()`    | `composeService`, `image`        | `redis://host:port`                   | database index 1-15            |
| `sqlite()`   | `init` or `prismaSchema`         | `file:/tmp/....sqlite`                | template file copy (no Docker) |

Container-backed handles read image/env from `docker/compose.test.yaml` — from the service the record key derives (exact name, else kebab-case), or via `composeService`. In compose mode each vitest worker gets a dedicated compose project.

## Mocking utilities (unit tests, not specs)

| Export        | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| `mockOf<T>()` | Deep mock of any interface (wraps `vitest-mock-extended`)       |
| `mockOfDate`  | Date mocking via `.set(date)` and `.reset()` (wraps `mockdate`) |

## Framework env vars (rule E1)

`TEST_MODE` (`node` default | `compose`) and `TEST_UPDATE` (`1`). Nothing else is read.

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

- **Docker** - testcontainers (node mode), docker compose (compose mode); not needed for `sqlite()` or plain cli specs
- **vitest** - peer dependency
- **msw** - bundled as a direct dependency (powers `.intercept()`); no separate install
- **hono** (or any web framework) - supplied by your project for in-process apps; the adapter only needs a `request()` method, so it is not a peer

## Lint plugin (`@jterrazz/test/oxlint`)

The statically-checkable conventions ship as an oxlint JS plugin (the one sanctioned subpath — tool-facing, referenced only from `oxlint.config.ts`):

```typescript
import { defineConfig } from 'oxlint';

import { recommendedRules } from '@jterrazz/test/oxlint';

export default defineConfig({
    jsPlugins: ['@jterrazz/test/oxlint'],
    rules: {
        ...recommendedRules, // errors + `*w-*` redundancy warnings
        'jterrazz/b5-await-using': ['error', { runners: ['dockerCli'] }], // your docker-aware runner names
    },
});
```

Rule ids are `jterrazz/<convention>-<name>` (`jterrazz/b4-given-then`, `jterrazz/c7-seeds-sql-only`, …). The full mechanized catalogue — every rule, its channel and its normative text — is generated from the code into `CONVENTIONS-CATALOG.md` (the hand-maintained `CONVENTIONS.md` is now a principles-only constitution). The D4 token grammar in data fixtures (`requests/**`, `expected/**`) is checked by a separate step: `node node_modules/@jterrazz/test/dist/checker.js specs` (chain it into your lint script). See `docs/10-linting.md`.
