# 17 — Services: databases, caches, and their init scripts

Infrastructure is declared as a **named record** of service factories on the runner. The record key is the ONLY name a service has: it is your test vocabulary in `.seed()` / `.table()` targeting, it types the `server`/`jobs` factory parameters, it is the name the startup report prints, and — kebab-cased — it is the folder the service reads its init script from. A handle carries no second name of its own.

## Service factories

All four import from the package root (rule `no-unpublished-subpath`):

```typescript
import { postgres, process, redis, sqlite } from '@jterrazz/test';
```

| Factory      | Backing                                            | Options                                                       | Connection string shape               |
| ------------ | -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `postgres()` | Docker container                                   | `image`, `env`                                                | `postgresql://user:pass@host:port/db` |
| `redis()`    | Docker container                                   | `image`                                                       | `redis://host:port`                   |
| `sqlite()`   | **No Docker** — a template file copied per worker  | `init` (SQL file) or `prismaSchema` (runs `prisma db push`)   | `file:/…/….sqlite`                    |
| `process()`  | **No Docker** — a child process the framework owns | `command`, `ready`, `port`, `cwd`, `env`, `before`, `timeout` | `http://127.0.0.1:port`               |

**Each factory names its own optional peer**, and names it at startup rather than at install time: `postgres()` and `redis()` need `testcontainers` (and `pg` / `redis` for the driver a table read uses), `sqlite()` needs `better-sqlite3`, and `process()` needs nothing but node. A project that declares none of them installs none of them — the drivers are optional peers since 16.0, each loaded lazily by the one adapter under `world/services/` that owns it ([04 — Operating](04-operating.md#what-a-consumer-must-bring)). The refusal, when one is missing, names the service that asked, the peer, the install command of the package manager the project's own lockfile names, and — under pnpm — the `onlyBuiltDependencies` line a native binding also needs before it is built at all.

`image` overrides the container image and `env` (postgres only) the environment variables; each factory carries a default for both, so a record that states neither still starts a real service.

The default image is the slim one, pinned by digest: `postgres:17-alpine` and `redis:7-alpine`, each at the digest of its multi-platform index, held in one constant (`src/world/services/containers/service-images.ts`). Every machine and every run starts the same bytes; a bare tag would move under the suite, and bumping the pin is a deliberate edit of that constant.

A postgres container is disposable, and it is started as one: its data directory is a memory disk (`tmpfs` on `/var/lib/postgresql/data`), and the server runs with `fsync`, `synchronous_commit` and `full_page_writes` off — every write that exists only to survive a crash is skipped. A handle states this as its `containerOptions` (a `command` and `tmpfs` mounts), which the container is started with; a handle of your own may state them too.

After the runner starts, each service handle exposes `.connectionString`, which is what you pass to your app:

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

**Its URL is known once it is ready.** `url` read at declaration time is refused: a process started beside others reads theirs from the started services record — `env: (services) => …`, `server: (services) => …`.

**The framework ends what it started.** A process is spawned detached — its own process group on POSIX — and on teardown the whole group is sent `SIGTERM`, escalating to `SIGKILL` after a 2 s grace, so what the command forked (a watcher, a background server) dies with it instead of outliving the run. A run that dies before its teardown — killed, `SIGKILL` included — ends the group all the same: a watchdog outside the group holds a pipe from the run, and when the pipe closes it sends the group the same `SIGTERM`, then `SIGKILL`. A website's server and a mobile run's Appium server are ended the same way, by the same code.

`website()` and `mobile()` take a `services` record for exactly this: a site started beside the API it calls, a simulator started beside its Metro bundler (`process({ command: 'expo start', ready: /Metro waiting on .*:(\d+)/ })`). What used to be a bundler bootstrap the repository maintained is a declaration.

**The run's id is minted, never sampled.** Every process of one specification is handed `TEST_RUN_ID` in its environment — one value per RUN, where a run is one evaluation of the specification module, so two test files importing the same specification get a child each with an id of its own. A test that needs a label unique to its run reads that variable; it never builds one from `Date.now()` or `Math.random()`, which rule `no-sampled-value-in-expectation` refuses under an oracle and which makes two runs of the same suite disagree.

## The services record — three jobs for one key

1. **Vocabulary.** The key is how tests target the service: `.seed(file('./_seeds/x.sql'), { database: 'analyticsDb' })`, `result.table('events', { database: 'analyticsDb' })`. Typed — a typo is a compile error.
2. **Typing.** The `server` / `jobs` factory receives the exact same record, fully typed, once everything is started (rule `server-sees-declared-services`).
3. **Identity.** The key is the name the service is known by: the startup report prints it, and its **kebab-case** conversion is the folder the init script is read from — `analyticsDb` reports as `analytics-db` and initialises from `docker/analytics-db/init.sql`, with no option to state anywhere:

    ```typescript
    services: {
        db: postgres(), // → "db"
        analyticsDb: postgres(), // → "analytics-db"
    }
    ```

In CLI mode, the record additionally drives env injection into the child process: `<KEY>_URL` per service — the key uppercased to **CONSTANT_CASE** at camelCase boundaries (`analyticsDb` → `ANALYTICS_DB_URL`) — plus `DATABASE_URL` / `REDIS_URL` when unambiguous (rule `service-urls-injected` — see [CLI specs](12-cli.md#auto-injected-connection-urls)).

### The `database:` rule

With **2 or more databases** in the record, `database:` is mandatory on every `.seed()` and `.table()`. With exactly **one**, it is forbidden (redundant). There is no in-between: the option is either always present or never present within a project. A `.seed()` or a `.table()` in a project that declares no database is refused, and so is a `database:` naming no key of the record.

```typescript
// one database → no database: anywhere
await migrateCli.seed(file('./_seeds/legacy-schema.sql')).exec('up');
await expect(result.table('schema_migrations')).toMatch([…]);

// two databases → database: everywhere
await api.seed(file('./_seeds/catalog.sql'), { database: 'db' }).request(file('./_requests/new-order.http'));
await expect(result.table('events', { database: 'analyticsDb' })).toMatch([…]);
```

## `docker/<service>/init.sql`

```text
docker/
├── db/
│   └── init.sql            # schema for the "db" service — builds its template database
└── analytics-db/
    └── init.sql            # schema for the "analytics-db" service
```

- `docker/<service>/init.sql` builds the service's **template database** — matched by the **kebab-case of the record key**, so the analytics schema above belongs to `analytics-db/` (the folder `analyticsDb` names).
- The template is built ONCE per container: its name is the script's digest, one worker builds it under an advisory lock while the others wait and then find it, and each worker then takes `CREATE DATABASE … TEMPLATE` — a copy of the finished schema, whatever the script did to build it. A script that fails leaves no template behind, and the error names the script.
- A project with one database needs no folder of its own: a postgres handle falls back to `docker/postgres/init.sql` when nothing sits under its own name.
- Testcontainers starts each declared service from the handle's image and environment. There is no second definition of the stack to keep in step.

## One container per run

A container-backed service is started once per RUN, not once per file or per project. The `api()`, `job()` and `integration()` projects each carry a global setup, and every one of them joins the same run-level server: it serves the run's containers on one loopback port and provides that address to every project's workers. The first file that declares a service starts its container; every later file of the run, in any project and any worker, is handed the same one; the last project to tear down stops them. So a run of `api()` and `integration()` that both declare `postgres()` starts one postgres container, and each project's files still take databases of their own. Two declarations alike — same image, port, environment and container options — are one container, so `db: postgres()` and `analyticsDb: postgres()` share one server, and each takes a database of its own ([below](#per-worker-isolation)). Every `redis()` is the same request too, so `cache: redis()` and `queue: redis()` share one container, started with `--databases 256`, and each takes an index of its own — one's reset flushes that index alone and never reaches the other's keys.

A project written by hand, or a facet whose helper carries no such setup (`cli()`, `website()`, `mobile()`), is handed no run container. There, every service a specification declares starts a container of its own and stops it with the file: `cache: redis()` and `queue: redis()` are two containers, each still on an index of its own, and two alike `postgres()` are two servers. The sharing above is the services setup's.

The setup reaches Docker in the background and pulls each pinned default image the daemon lacks, so the first file waits on a pull at most once. When no Docker daemon answers, every file that declares a service fails with one sentence that names Docker, and a project whose specs declare no service never needs Docker at all.

### Reused across runs, locally

`TESTCONTAINERS_REUSE_ENABLE=true` keeps the containers alive between runs: the next run finds them by the hash of their definition instead of starting them, and a postgres finds its templates already built. It is off unless asked for, and off on CI whatever the variable says — a CI run starts from nothing and leaves nothing. A reused container is one run's at a time: two runs at once on one machine share it, and each would drop the other's worker databases.

Every container the package starts carries the label `com.jterrazz.test=true`, and a reused one `com.jterrazz.test.reuse=true` besides, since it outlives the run by design and nothing reaps it.

The containers of a run that is not reused are removed at teardown. A run that dies leaves them to testcontainers' reaper (Ryuk), and every run on a machine shares one reaper session while any of them holds it: the session's containers are removed only once its LAST client is gone. A run killed mid-way is therefore reaped only when every run sharing the reaper has ended — and with runs in parallel, that can be hours.

The owner sweep covers the time in between. Every container the package starts that is not reused carries `com.jterrazz.test.owner=<host>:<pid>`, the process that started it; every services setup sweeps first, beside the image pulls, and removes a container whose owner names this host and a pid no process answers — running or not, whatever reaper still holds its session.

The sweep runs only when a services setup starts, so it bounds a killed run's leftovers without removing them at once. They stay until the next services setup on the machine starts or the reaper's last client is gone, whichever comes first. Nothing sweeps when the setup tears down.

The host in the label is `os.hostname()`, which on macOS follows the network the machine is on. A container labelled under an earlier network's name names no host the sweep recognises, so it is never swept and is left to the reaper, or to `docker rm` by the label below. The sweep fails safe: it removes only what it can prove is dead.

The same sweep covers a reaper that is gone. It runs with auto-remove, so a runtime that stops every container, or a `docker stop` of them all, takes it away and leaves the session's containers stopped behind it. A container that carries a testcontainers session, has ended, and whose session no running reaper holds is removed too — whichever package or version started it.

The probe, from a built tree: a run that holds the reaper, a run killed with its redis running, and an ended container of a session nobody holds — the next setup's sweep leaves none of them.

```bash
image=redis:7-alpine
node --input-type=module -e "const { GenericContainer } = await import('testcontainers'); await new GenericContainer('$image').start(); setInterval(() => {}, 1000)" &
holder=$!
sleep 10   # until the holder's container runs
node --input-type=module -e "
const { default: setup } = await import('./dist/services-setup.js');
let url; await setup({ provide: (_, served) => { url = served; } }, async () => {});
await fetch(url + '/containers', { method: 'POST', body: JSON.stringify({ image: '$image', port: 6379 }) });
process.kill(process.pid, 'SIGKILL');"
docker run -d --label org.testcontainers.session-id=probe-gone "$image" true
docker ps -a --filter label=com.jterrazz.test.owner   # the killed run's redis, running
node --input-type=module -e "await (await import('./dist/services-setup.js')).prepareDocker()"
docker ps -a --filter label=com.jterrazz.test.owner   # empty
docker ps -a --filter label=org.testcontainers.session-id=probe-gone   # empty
kill $holder
```

The label lists every container the package started, and the reused ones, which carry no session and no sweep touches, are removed by hand:

```bash
docker ps -a --filter label=com.jterrazz.test=true
docker rm -f $(docker ps -aq --filter label=com.jterrazz.test.reuse=true)
```

## Per-worker isolation

Vitest runs test files in parallel workers; the framework isolates them automatically — no configuration, no sharding. Vitest draws every worker of a run from one pool, so two workers running at once never share a pool id, whichever project each serves: the bands below hold across the projects that share [one container](#one-container-per-run).

| Service      | Isolation strategy                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres()` | A database per worker, cloned from the template its init script built — the connection string's path                                      |
| `redis()`    | A database index per (worker, service) pair — pool id `w`'s services take `4w − 3` to `4w` — acquired empty, the connection string's path |
| `sqlite()`   | Template file copied per worker                                                                                                           |

The handle's `connectionString` is its own isolation's — a postgres worker's database, a redis (worker, service) pair's index: the app built from it writes where the reset flushes, and a client opened on the container's bare address reaches the container's own database, which no worker uses and no reset flushes.

A redis container's 256 indexes are its own `0` and four per worker, so it serves pool ids 1 to 63 holding four redis services each; a process outside a vitest pool is worker `0` and shares pool id 1's band, since it never runs beside a pool against the run's container. A fifth service in one worker, or a pool id past 63, is refused before it connects, with the way out in the sentence. Two handles of one (worker, service) pair share its index, and the index stays theirs until the last of them releases it.

On top of worker isolation, **every chain resets the databases** (rule `sequence-expressed-by-seeding`): a spec starts from seeds, never from a previous spec's leftovers. The reset truncates every table and restarts every generated id, and a postgres worker's database is a whole clone, sequences included: the first row a chain inserts is id `1` in every worker, so an id is a value a test may state.

## Root auto-discovery

The framework locates the project root by walking **up from the specification file** to the **nearest** directory carrying `package.json`, so in a workspace the member being tested wins over the repository root above it. Inside a git work tree it reads the tree git does not ignore — a `.gitignore`d `package.json` marks no root, a new one nobody added does — which is the tree `no-redundant-root` reads too, so the lint and the run derive one root. The `root` option is an override for the cases where the convention cannot work (e.g. fixtures deliberately kept outside the package) — pointing `root` at the directory the walk would find anyway is redundant, and `no-redundant-root` refuses it.

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

The template is a **project** artefact: `<root>/.artifacts/vitest/sqlite/template-<sha8>.sqlite`, under the root `no-redundant-root` discovered ([above](#root-auto-discovery)) and covered by the same `.gitignore` line as everything else in `.artifacts/` ([02 — Developing](02-developing.md#artefacts-live-under-artifacts)).

It used to live in the machine-global OS tmpdir, where two checkouts of one repository shared a single file: whichever ran first built it, the other silently inherited that schema, and a branch that changed the schema poisoned the branch beside it. A path under the project root cannot be reached from another checkout at all. Deleting `.artifacts/` is how you force a cold rebuild.

The file name stays **keyed on the schema** — the digest taken over the kind of schema (`init` / `prismaSchema`), its resolved path and its content. Within one project that is what makes reuse mean "the same schema": edit a schema and the next run builds a new template instead of reading the old one, whose header is perfectly valid and whose tables are wrong.

### One worker builds, the others wait

Workers race for a cold cache, so the build is serialised by a lock beside the template — and a worker that loses the race **waits** for the winner rather than building too. It is taken with an exclusive create, so exactly one worker can win it; the check-then-write it replaced let several believe they had won, and the concurrent `prisma db push` calls that followed died on `database is locked`. A suite kept sequential (`fileParallelism: false`) only for that reason can go parallel again.

Two more properties fall out of it: the winner builds on a private path and **renames** the finished file into place, so a reader never sees a half-built template (the SQLite header is written long before the tables are); and a lock nobody has touched for two minutes is treated as a crashed holder's and broken, so a killed worker cannot wedge the suite.

## Pitfalls

- **Naming the `init.sql` folder after the raw record key.** The folder is the key's **kebab-case** form: key `analyticsDb` reads `docker/analytics-db/init.sql`, not `docker/analyticsDb/`.
- **Sharing state across specs "because the container is shared".** The container is shared; the data is not — chains reset databases (rule `sequence-expressed-by-seeding`), and workers are isolated (rule `state-isolated-per-worker`).
- **Passing `root` that auto-discovery would have found.** Redundant override (rule `no-redundant-root`).
- **Reading a green local run as proof that `prismaSchema` is wired.** The template is cached across runs, so a checkout that built it once never re-runs `db push` — a schema path that would fail on a fresh clone (or in CI) stays invisible. Delete `.artifacts/vitest/sqlite/` to test the cold path.
- **Counting `sqlite()` + `redis()` as "2 databases" for rule `database-named-only-when-several`.** The rule counts **databases**; with one SQL database and one redis, `database:` stays forbidden on `.seed()`/`.table()` and `DATABASE_URL`/`REDIS_URL` are both unambiguous for CLI injection (rule `service-urls-injected`).

## Related

[10 — API specs](10-api.md) · [11 — Job specs](11-job.md) · [12 — CLI specs](12-cli.md) · [18 — Conventions](18-conventions.md)
