# 04 — CLI specs (`specification.cli`)

`specification.cli(bin, options)` tests a command-line binary. Every spec runs the binary in a **fresh, empty temp directory**, captures stdout/stderr/exit code, and exposes the resulting filesystem — and, in Docker-aware mode, the containers the binary spawned. The CLI is always a local binary: there is no node/compose mode (rule A5).

Use it when the subject under test is a process invocation. If the process serves HTTP, test that surface with [api](02-api.md).

## Creating the runner

```typescript
// specs/cli/cli.specification.ts
import { resolve } from 'node:path';
import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

export const { cli, cleanup } = await specification.cli(
    resolve(import.meta.dirname, '../../bin/shoply.sh'),
);

afterAll(cleanup);
```

### Options

| Option      | Description                                                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`      | **Project-root override** only (rule A9): anchors compose detection + local-bin resolution. It is _not_ a fixtures root — `.fixture()` resolves paths on its own. Auto-discovery applies when omitted                                         |
| `services`  | Named record of infrastructure services (`postgres()`, `redis()`, `sqlite()`) — connection URLs are auto-injected into the child env (rule B6)                                                                                                |
| `docker`    | Opt-in Docker awareness: `{ envVar, nameLabel, testRunLabel }` — see [Docker-aware mode](#docker-aware-mode)                                                                                                                                  |
| `transform` | **Escape hatch only** (rule D6): a normalizer applied to streams before comparison, for application noise not covered by tokens. ANSI stripping is already the default; a transform that only re-implements standard tokens is a lint warning |

## `.exec()` — the single execution method

`.exec(args?, options?)` is the **only** way to run the binary — there is no `.spawn()` (rule B2). It covers short commands, long-running processes, and sequences. Called with **no arguments**, the binary runs bare (no CLI args) — clearer than the `.exec('')` idiom:

```typescript
const result = await cli.exec(); // invoke the binary with no arguments
```

Note the asymmetry with the array form: `.exec()` (no args) is a bare invocation, but `.exec([])` (empty array) throws — a command _sequence_ must name at least one command.

```typescript
test('shows help', async () => {
    // Given
    const result = await cli.exec('--help');

    // Then - full stdout snapshot; ANSI already stripped, dynamics covered by tokens
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch('help.txt');
});
```

### Long-running processes: `waitFor` / `timeout`

```typescript
test('dev server boots', async () => {
    // Given - long-running: resolved on pattern match, killed at timeout otherwise
    const result = await cli
        .fixture('$FIXTURES/base-shop/')
        .exec('dev --port 0', { waitFor: 'Listening on', timeout: 10_000 });

    // Then
    expect(result.stdout).toContain('Listening on');
});
```

- `waitFor` — a pattern; the promise resolves (exit code 0) as soon as it appears in **stdout or stderr** (both streams are watched). If the process exits before matching, the result carries a non-zero exit code (a clean exit-0 without the pattern is reported as `1`).
- `timeout` — milliseconds; the process is killed when it elapses without a match, with exit code `124`. **Default: 10 000 ms** when `waitFor` is set without a `timeout`.
- On resolution (match, exit, or timeout) the child is terminated with `SIGTERM`, escalating to `SIGKILL` after a 2 s grace period if it ignores the first signal.
- Termination targets the **whole process group**, not just the direct shell child: the process is spawned detached (its own group on POSIX) and signalled via the negative pid, so descendants — a `tsdown --watch` grandchild under a `dev` command, a background server the script forked — die with it instead of leaking past the spec. On platforms without group support (Windows), or when the group is already gone, it degrades to the direct child kill.
- Passing either option marks the run as long-running; combining them with the array (sequence) form is an error.

Quoting is identical between the one-shot and `waitFor` forms: both run the full command line through the shell (`spawnSync` vs `spawn`, `shell: true`), so a quoted argument behaves the same either way — there is no naive whitespace split.

### Sequences: array form

```typescript
test('build then start chain stops at first failure', async () => {
    // Given - a sequence in the SAME working directory
    const result = await cli.fixture('$FIXTURES/base-shop/').exec(['build', 'start --check']);

    // Then
    expect(result.exitCode).toBe(0);
});
```

Commands run sequentially in the same cwd; the sequence stops at the first failure. This is still one terminal action — one spec, one `.exec()` (rule B1). An empty array throws (`exec([]) requires at least one command`), and `{ waitFor, timeout }` cannot be combined with the array form.

## Working-directory semantics

Every spec gets a brand-new temp directory (`mkdtemp`) as its cwd. The runner never writes into your fixtures.

Two disjoint verbs shape a spec's state (rule C7): **`.fixture()` carries file state** (an isolated tree copied into the cwd), **`.seed()` carries database state** (SQL only). Any "transformation" you need is expressed declaratively, in the _shape_ of the fixture tree.

`.fixture(path)` resolves in one of two ways and copies with rsync's trailing-slash semantics:

| Path                     | Resolves to                                    | Copy effect                                     |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------- |
| `'config.toml'`          | `<domain>/fixtures/config.toml` (domain-local) | `<cwd>/config.toml`                             |
| `'$FIXTURES/base-shop/'` | `specs/fixtures/base-shop/` (shared pool)      | **contents spread** into `<cwd>` (trailing `/`) |
| `'$FIXTURES/base-shop'`  | `specs/fixtures/base-shop/` (shared pool)      | `<cwd>/base-shop/` (dir under its own name)     |

> **⚠️ Trailing slash = spread vs. nest.** For a directory fixture, the trailing `/` is load-bearing — it is exactly rsync's semantics, and it changes where files land:
>
> | Form                          | Copies                    | Result in the cwd            |
> | ----------------------------- | ------------------------- | ---------------------------- |
> | `.fixture('$FIXTURES/shop/')` | **contents** of `shop/`   | `<cwd>/package.json`, …      |
> | `.fixture('$FIXTURES/shop')`  | the `shop/` **directory** | `<cwd>/shop/package.json`, … |
>
> Almost always you want the **trailing slash** (spread the project into the cwd, so the tool runs at the root). Drop it only when the command expects the project one level down.

`$FIXTURES` points at `specs/fixtures/` (the nearest ancestor `specs/` dir + `fixtures/`); any other `$…` marker is an error. Chained `.fixture()` calls **layer** in order — a later fixture overwrites files from an earlier one.

| Setup                              | Effect on the cwd                                                    |
| ---------------------------------- | -------------------------------------------------------------------- |
| _(nothing)_                        | Empty directory                                                      |
| `.fixture('$FIXTURES/base-shop/')` | Spread a whole shared project into the cwd                           |
| `.fixture('config.toml')`          | Copy the feature-local `fixtures/config.toml` into the cwd           |
| `.seed('…')`                       | SQL into a service database (rule A7 governs the `database:` option) |

```typescript
test('scaffolds a new shop', async () => {
    // Given - empty cwd (every spec = fresh mkdtemp)
    const result = await cli.exec('create my-shop');

    // Then - precise files…
    expect(result.exitCode).toBe(0);
    expect(result.file('my-shop/shoply.yaml').exists).toBe(true);
    expect(result.file('my-shop/shoply.yaml').content).toContain('name: my-shop');
    expect(result.file('my-shop/.env').exists).toBe(false);

    // …or a tree snapshot (structured added/removed/changed diff)
    await expect(result.directory('my-shop')).toMatch('shop-scaffold');
});

test('upgrade rewrites the workspace predictably', async () => {
    // Given
    const result = await cli.fixture('$FIXTURES/base-shop/').exec('upgrade');

    // Then - snapshot of the ENTIRE cwd + flat read of the file list
    await expect(result.filesystem).toMatch('upgraded-shop');
    expect(await result.filesystem.files()).toContain('shoply.lock');
});

test('seeds a single fixture file', async () => {
    // Given
    const result = await cli.fixture('legacy-config.toml').exec('migrate-config');

    // Then
    expect(result.file('shoply.yaml').exists).toBe(true);
});
```

Tree snapshots are directories under `expected/` (`expected/shop-scaffold/`) — the one `toMatch` argument that takes no extension (rule C6).

## `.env()` — child process environment

```typescript
test('isolates HOME per spec', async () => {
    // Given - HOME on the temp cwd, TZ pinned, stray variable removed
    const result = await cli
        .env({ HOME: '$WORKDIR', TZ: 'UTC', SHOPLY_TOKEN: null })
        .exec('login --offline');

    // Then
    expect(result.file('.shoply/credentials').exists).toBe(true);
});
```

- `'$WORKDIR'` expands to the spec's temp cwd — pin `HOME`, caches, config dirs onto isolated ground.
- `null` **removes** a variable from the child env — shield the spec from the developer's shell.
- Repeated `.env()` calls merge; later keys win.

### Auto-injected connection URLs (rule B6)

When the runner has `services`, the framework injects into the child env, automatically:

| Variable       | Rule                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<KEY>_URL`    | One per record key, uppercased to CONSTANT_CASE at camelCase boundaries: `db:` → `DB_URL`, `analyticsDb:` → `ANALYTICS_DB_URL`, `cache:` → `CACHE_URL` |
| `DATABASE_URL` | Standard alias, only when the record has **exactly one** SQL database                                                                                  |
| `REDIS_URL`    | Standard alias, only when the record has **exactly one** redis                                                                                         |

`.env()` overrides any injected value; `null` removes it. Re-declaring what injection already provides (`.env({ DATABASE_URL: db.connectionString })`) is redundant — future lint warning.

```typescript
// One SQL database → DATABASE_URL and DB_URL both injected, no database: option (rule A7)
export const { cli: migrateCli, cleanup } = await specification.cli('shoply-migrate', {
    services: { db: postgres() },
});

test('migrates a legacy schema', async () => {
    // Given - DATABASE_URL / DB_URL injected automatically into the child env
    const result = await migrateCli.seed('legacy-schema.sql').exec('up');

    // Then
    expect(result.exitCode).toBe(0);
    await expect(result.table('schema_migrations')).toMatchRows({
        columns: ['version'],
        rows: [['20260716']],
    });
});
```

## File state is the shape of a fixture tree

CLI-mode `.seed()` is **SQL only** — it carries database state, nothing else (rule C7). To put files or config trees into the cwd, use `.fixture()` with a fixture laid out exactly as the cwd should look. There is no "seed handler" or path-prefix dispatch.

```typescript
// specs/cli/deploy/fixtures/two-shops/  ← committed, shaped like the target cwd
//   shoply.yaml
//   shops/alpha/config.yaml
//   shops/beta/config.yaml

test('deploys from a shaped workspace', async () => {
    // Given - the tree is spread into the cwd; layering a second fixture would
    // overwrite matching files (last write wins)
    const result = await cli.fixture('two-shops/').exec('deploy alpha');

    // Then
    expect(result.exitCode).toBe(0);
});
```

Prefer feature-local fixtures for one-off shapes; promote shared projects to `specs/fixtures/` and reach them via `$FIXTURES/`.

## Streams, JSON, grep

```typescript
test('fails on unknown command with a useful error', async () => {
    // Given
    const result = await cli.exec('frobnicate');

    // Then
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown command 'frobnicate'");
    expect(result.stdout.text).toBe(''); // .text = raw, never transformed
});

test('emits machine-readable config', async () => {
    // Given
    const result = await cli.exec('config --json');

    // Then
    expect(result.json.value).toMatchObject({ name: 'shoply' }); // read + native matcher
    expect(result.json).toMatch('config.json'); // expected/config.json
});

test('lints a shop and reports per-file blocks', async () => {
    // Given
    const result = await cli.fixture('$FIXTURES/base-shop/').exec('lint');

    // Then - snapshot the whole surface; grep is the scalpel for targeted probes
    expect(result.stdout).toMatch('lint-output.txt'); // full snapshot, tokens for volatile parts
    expect(result.stdout.grep('products/ok.yaml')).not.toContain('error'); // absence probe
});
```

`result.stdout` / `result.stderr` are `TextAccessor` subjects — the universal text handle (stdout, stderr, container logs, file text): ANSI-stripped for every comparison (rule D6), with `.text` exposing the raw capture. Text operations are **closed** over the type: `.grep(pattern)` returns a `TextAccessor` (not a string), so it chains (`result.stdout.grep(a).grep(b)`) and snapshots (`expect(result.stdout.grep('users.ts')).toMatch('block.txt')`). There is no `result.grep()` — the source is always explicit. `result.json` parses stdout as JSON (`.value` for the parsed object).

**Tool output → snapshot per scoped use case (rule D11).** For linter/compiler/CLI output, prefer a per-use-case fixture project + a full `expect(result.stdout).toMatch('<use-case>.txt')` snapshot (volatile parts covered by `{{duration}}` / `{{workdir}}` / `{{path}}` tokens, generated with `TEST_UPDATE=1`) over a cluster of greps. The fixture is the Given — no shared `beforeAll`. Keep `.grep()` for targeted presence/absence probes in large outputs. The full surface is in [assertions](05-assertions.md).

## Docker-aware mode

For CLIs that spawn Docker containers, declare the `docker` option (rule G3):

```typescript
export const {
    cli: deploy,
    cleanup,
    docker,
} = await specification.cli('shoply', {
    docker: {
        envVar: 'SHOPLY_TEST_RUN', // run id injected into the child env
        nameLabel: 'dev.shoply.shop.name', // label used as the .container(name) key
        testRunLabel: 'dev.shoply.test.run', // label the CLI must put on every container
    },
});
```

The contract with your binary: it must label every container it creates with `testRunLabel = <value of envVar>`. That is how the runner finds — and force-removes — the containers belonging to a run.

A Docker-aware runner **requires `await using`** on every result (rule B5), so leaked containers are cleaned by label filter at scope exit:

```typescript
test('deploy spawns a labelled container', async () => {
    // Given - await using ⇒ containers force-removed at scope exit (rule B5)
    await using result = await deploy.fixture('$FIXTURES/two-shops/').exec('deploy alpha');

    // Then - lazy access (zero Docker calls if you never touch .container)
    const shop = result.container('alpha');
    expect(shop.exists).toBe(true);
    await expect(shop).toBeRunning();

    // Reads INSIDE the container, same vocabulary as on the host
    expect(shop.file('/app/shoply.yaml').content).toContain('name: alpha');
    const inside = await shop.exec('ls /app');
    expect(inside.stdout).toContain('shoply.yaml');
    expect(shop.stdout).toContain('shop ready'); // container logs

    // Absent ≠ crash
    expect(result.container('nope').exists).toBe(false);
    expect(result.containerIds).toHaveLength(1);
});

test('destroy removes the container created in an earlier run', async () => {
    // Given - spawn then destroy: the whole runner shares one run-id scope
    await using first = await deploy.exec('deploy alpha');
    await using second = await deploy.exec('destroy alpha');

    // Then
    expect(second.exitCode).toBe(0);
    expect(second.container('alpha').exists).toBe(false);
});
```

Container accessor surface: `exists`, `running`/`toBeRunning`, `status`, `id`, `file(path)` (content read inside the container), `exec(cmd)` (returns stdout/stderr), `stdout`/`stderr` (container logs). Looking up an absent container returns `exists: false` instead of throwing. `result.containerIds` lists every container captured for the run.

The runner handle also destructures to `{ cli, cleanup, docker, orchestrator }`. The `docker(containerId)` reader is the escape hatch for reading an **arbitrary** container by raw id (e.g. one a follow-up command referenced): it lazily runs `docker inspect` and returns the same `ContainerAccessor` type, so `await expect(docker(id)).toBeRunning()` and the sync reads work identically. Unlike `result.container(name)` it does not need `nameLabel` — it looks up by id directly; an unknown id yields `exists: false`.

## Pitfalls

- **Reaching for `.spawn()`.** It does not exist — `.exec(args, { waitFor, timeout })` is the unified execution method (rule B2).
- **Asserting on raw ANSI or absolute paths in snapshots.** ANSI is stripped by default; paths and timestamps belong to `{{workdir}}`, `{{path}}`, `{{iso8601}}` tokens in `expected/*.txt` — `transform` is a last resort (rule D6).
- **Assigning a Docker-aware result without `await using`.** Error (rule B5) — that is the leak-cleanup mechanism.
- **Re-declaring injected URLs.** `.env({ DATABASE_URL: … })` duplicates rule B6's auto-injection — override only to _change_ it, `null` to remove it.
- **Writing into fixture folders from a test.** The cwd is a copy; feature-local `fixtures/` and the shared `specs/fixtures/` pool are templates and stay pristine.
- **Reaching for `.project()` or `seedHandlers`.** Both are gone — one verb copies files (`.fixture(path)`, feature-local or `$FIXTURES/`), and `.seed()` is SQL-only (rule C7).
- **Forgetting the extension in `toMatch('help')`.** The extension is part of the name (rule C6) — except for tree snapshots, which are directories.

## Related

[01 — Getting started](01-getting-started.md) · [05 — Assertions](05-assertions.md) · [06 — Tokens](06-tokens.md) · [08 — Services](08-services.md)
