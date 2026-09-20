# 17 — Services: databases, caches, and their init scripts

Infrastructure is declared as a **named record** of service factories on the runner. The record key is the ONLY name a service has: it is your test vocabulary in `.seed()` / `.table()` targeting, it types the `server`/`jobs` factory parameters, it is the name the startup report prints, and — kebab-cased — it is the folder the service reads its init script from. A handle carries no second name of its own.

## Service factories

All four import from the package root (rule F1):

```typescript
import { postgres, process, redis, sqlite } from '@jterrazz/test';
```

| Factory      | Backing                                            | Options                                                       | Connection string shape               |
| ------------ | -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `postgres()` | Docker container                                   | `image`, `env`                                                | `postgresql://user:pass@host:port/db` |
| `redis()`    | Docker container                                   | `image`                                                       | `redis://host:port`                   |
| `sqlite()`   | **No Docker** — a template file copied per worker  | `init` (SQL file) or `prismaSchema` (runs `prisma db push`)   | `file:/…/….sqlite`                    |
| `process()`  | **No Docker** — a child process the framework owns | `command`, `ready`, `port`, `cwd`, `env`, `before`, `timeout` | `http://127.0.0.1:port`               |

**Each factory names its own optional peer**, and names it at startup rather than at install time: `postgres()` and `redis()` need `testcontainers` (and `pg` / `redis` for the driver a table read uses), `sqlite()` needs `better-sqlite3`, and `process()` needs nothing but node. A project that declares none of them installs none of them — the seams are optional peers since 16.0, loaded lazily by the one module that owns each ([04 — Operating](04-operating.md#what-a-consumer-must-bring)). The refusal, when one is missing, names the facet that asked, the peer, the install command of the package manager the project's own lockfile names, and — under pnpm — the `onlyBuiltDependencies` line a native binding also needs before it is built at all.

`image` overrides the container image and `env` (postgres only) the environment variables; each factory carries a default for both, so a record that states neither still starts a real service. After the runner starts, each service handle exposes `.connectionString`, which is what you pass to your app:

```typescript
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
});
```

## `process()` — the one shape an external process takes

A site's dev server, an API the site calls, the bundler a simulator loads from: each of them is a command, a way of knowing it is ready, and a lifetime. `process()` is the one shape for all three, and the framework owns the lifetime — without it each would be declared somewhere else, and the last one would be a `beforeAll` spawning a child and an `afterAll` that sometimes forgets to kill it.

The options type is `ProcessOptions` — one shape for the one external process every facet starts.

| Option    | Means                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command` | the shell command that starts it, receiving the chosen port as `PORT`                                                                                                                   |
| `ready`   | a **path** polled until it answers (default `/`), or a **RegExp** over the child's output whose one capture group is the port                                                           |
| `port`    | a fixed port instead of a free one the OS assigns                                                                                                                                       |
| `cwd`     | a working directory relative to the project root                                                                                                                                        |
| `env`     | the child's environment — an object, or a function of the services started beside it                                                                                                    |
| `before`  | a one-shot command run ONCE per evaluation of the specification module — under vitest's default isolation, once per test file — which must exit 0: a build, a migration, a fixture load |
| `timeout` | the readiness budget, in milliseconds (default 30 000)                                                                                                                                  |

It sits in a `services` record like any other service, so it starts after the databases and can be handed their connection strings, and it is stopped with the specification:

```typescript
import { postgres, process, specification } from '@jterrazz/test';

const api = process({
    before: 'make build',
    command: 'bin/server web --port $PORT',
    env: ({ db }) => ({ DATABASE_URL: db.connectionString }),
    ready: '/health',
});

export const { cleanup, website } = await specification.website({
    server: (services) =>
        process({
            command: 'next dev',
            env: { NEXT_PUBLIC_API_URL: services.api.connectionString },
        }),
    services: { api, db: postgres() },
});
```

`website()` and `mobile()` take a `services` record for exactly this: a site started beside the API it calls, a simulator started beside its Metro bundler (`process({ command: 'expo start', ready: /Metro waiting on .*:(\d+)/ })`). What used to be a bundler bootstrap the repository maintained is a declaration.

**The run's id is minted, never sampled.** Every process of one specification is handed `TEST_RUN_ID` in its environment — one value per RUN, where a run is one evaluation of the specification module, so two test files importing the same specification get a child each with an id of its own. A test that needs a label unique to its run reads that variable; it never builds one from `Date.now()` or `Math.random()`, which rule D16 refuses under an oracle and which makes two runs of the same suite disagree.

## The services record — three jobs for one key

1. **Vocabulary.** The key is how tests target the service: `.seed('x.sql', { database: 'analyticsDb' })`, `result.table('events', { database: 'analyticsDb' })`. Typed — a typo is a compile error.
2. **Typing.** The `server` / `jobs` factory receives the exact same record, fully typed, once everything is started (rule A8).
3. **Identity.** The key is the name the service is known by: the startup report prints it, and its **kebab-case** conversion is the folder the init script is read from — `analyticsDb` reports as `analytics-db` and initialises from `docker/analytics-db/init.sql`, with no option to state anywhere:

    ```typescript
    services: {
        db: postgres(), // → "db"
        analyticsDb: postgres(), // → "analytics-db"
    }
    ```

In CLI mode, the record additionally drives env injection into the child process: `<KEY>_URL` per service — the key uppercased to **CONSTANT_CASE** at camelCase boundaries (`analyticsDb` → `ANALYTICS_DB_URL`) — plus `DATABASE_URL` / `REDIS_URL` when unambiguous (rule B6 — see [CLI specs](12-cli.md#auto-injected-connection-urls-rule-b6)).

### The `database:` rule (A7)

With **2 or more databases** in the record, `database:` is mandatory on every `.seed()` and `.table()`. With exactly **one**, it is forbidden (redundant). There is no in-between: the option is either always present or never present within a project.

```typescript
// one database → no database: anywhere
await migrateCli.seed('legacy-schema.sql').exec('up');
await expect(result.table('schema_migrations')).toMatchRows({ … });

// two databases → database: everywhere
await api.seed('catalog.sql', { database: 'db' }).request('new-order.http');
await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({ … });
```

## `docker/<service>/init.sql`

```
docker/
├── db/
│   └── init.sql            # schema for the "db" service — runs on service start
└── analytics-db/
    └── init.sql            # schema for the "analytics-db" service
```

- `docker/<service>/init.sql` executes when the corresponding service starts — matched by the **kebab-case of the record key**, so the analytics schema above belongs to `analytics-db/` (the folder `analyticsDb` names).
- A project with one database needs no folder of its own: a postgres handle falls back to `docker/postgres/init.sql` when nothing sits under its own name.
- Testcontainers starts each declared service from the handle's image and environment. There is no second definition of the stack to keep in step.

## A contract's `required` is verified per `.call()`

A chain's scope is ONE terminal action, and a contract's `required` is checked at the end of it — not at the end of the test, and not at the end of the file. A spec that declares a contract and then performs two actions has declared it for the first one: the second starts a fresh registration, and a `required` contract unmet by the action it belongs to fails that action's chain.

This is the same boundary rule B1 already states from the other side — one chain, one action — read from the contract's end. A test that wants a contract to hold across two actions writes two chains, each declaring what it expects to see.

## Per-worker isolation (rule G2)

Vitest runs test files in parallel workers; the framework isolates them automatically — no configuration, no sharding:

| Service      | Isolation strategy                  |
| ------------ | ----------------------------------- |
| `postgres()` | Cloned schema per worker            |
| `redis()`    | Dedicated database index per worker |
| `sqlite()`   | Template file copied per worker     |

On top of worker isolation, **every chain resets the databases** (rule B1): a spec starts from seeds, never from a previous spec's leftovers.

## Root auto-discovery (rule A9)

The framework locates the project root by walking **up from the specification file** to the **nearest** directory carrying `package.json`, so in a workspace the member being tested wins over the repository root above it. The `root` option is an override for the cases where the convention cannot work (e.g. fixtures deliberately kept outside the package) — pointing `root` at the directory the walk would find anyway is redundant (future lint warning).

## SQLite without Docker

For CLIs (or apps) on SQLite, tests run with zero Docker:

```typescript
export const { cli, cleanup } = await specification.cli('shoply', {
    services: {
        db: sqlite({ init: './schema.sql' }), // schema from a SQL file
        // or: db: sqlite({ prismaSchema: './prisma/schema.prisma' })
    },
});
```

`sqlite()` builds a template database once (from `init` SQL or by running `prisma db push` on `prismaSchema`), then hands each worker its own copy. `.seed()` and `result.table()` work identically to Postgres.

`prismaSchema` is resolved against the **current working directory** and passed to the CLI as `npx prisma db push --force-reset --schema <absolute path>` — the schema is named explicitly, so it does not have to be the one Prisma would discover from a `prisma.config.ts` at the cwd. Declare no `prismaSchema` and the bare invocation runs, leaving discovery to Prisma.

### Where the template lives

The template is a **project** artefact: `<root>/.artifacts/vitest/sqlite/template-<sha8>.sqlite`, under the root A9 discovered ([above](#root-auto-discovery-rule-a9)) and covered by the same `.gitignore` line as everything else in `.artifacts/` ([02 — Developing](02-developing.md#artefacts-live-under-artifacts)).

It used to live in the machine-global OS tmpdir, where two checkouts of one repository shared a single file: whichever ran first built it, the other silently inherited that schema, and a branch that changed the schema poisoned the branch beside it. A path under the project root cannot be reached from another checkout at all. Deleting `.artifacts/` is how you force a cold rebuild.

The file name stays **keyed on the schema** — the digest taken over the kind of schema (`init` / `prismaSchema`), its resolved path and its content. Within one project that is what makes reuse mean "the same schema": edit a schema and the next run builds a new template instead of reading the old one, whose header is perfectly valid and whose tables are wrong.

### One worker builds, the others wait

Workers race for a cold cache, so the build is serialised by a lock beside the template — and a worker that loses the race **waits** for the winner rather than building too. It is taken with an exclusive create, so exactly one worker can win it; the check-then-write it replaced let several believe they had won, and the concurrent `prisma db push` calls that followed died on `database is locked`. A suite kept sequential (`fileParallelism: false`) only for that reason can go parallel again.

Two more properties fall out of it: the winner builds on a private path and **renames** the finished file into place, so a reader never sees a half-built template (the SQLite header is written long before the tables are); and a lock nobody has touched for two minutes is treated as a crashed holder's and broken, so a killed worker cannot wedge the suite.

## Pitfalls

- **Naming the `init.sql` folder after the raw record key.** The folder is the key's **kebab-case** form: key `analyticsDb` reads `docker/analytics-db/init.sql`, not `docker/analyticsDb/`.
- **Sharing state across specs "because the container is shared".** The container is shared; the data is not — chains reset databases (rule B1), and workers are isolated (rule G2).
- **Passing `root` that auto-discovery would have found.** Redundant override (rule A9).
- **Reading a green local run as proof that `prismaSchema` is wired.** The template is cached across runs, so a checkout that built it once never re-runs `db push` — a schema path that would fail on a fresh clone (or in CI) stays invisible. Delete `.artifacts/vitest/sqlite/` to test the cold path.
- **Counting `sqlite()` + `redis()` as "2 databases" for rule A7.** The rule counts **databases**; with one SQL database and one redis, `database:` stays forbidden on `.seed()`/`.table()` and `DATABASE_URL`/`REDIS_URL` are both unambiguous for CLI injection (rule B6).

## Related

[10 — API specs](10-api.md) · [11 — Jobs specs](11-jobs.md) · [12 — CLI specs](12-cli.md) · [18 — Conventions](18-conventions.md)
