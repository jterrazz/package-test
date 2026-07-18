# CLI specs — `specification.cli()`

Operative reference. Prose + examples: [docs/04-cli.md](../../docs/04-cli.md). Assertions: [docs/05-assertions.md](../../docs/05-assertions.md). Tokens: [references/tokens.md](tokens.md).

Runs a command binary against fixture projects in fresh, empty temp directories. Inherently e2e — no node/compose split.

## Runner (in `*.specification.ts`, `afterAll(cleanup)`)

```typescript
export const { cli, cleanup } = await specification.cli(
    resolve(import.meta.dirname, '../../bin/my-cli.sh'),
    { services: { db: postgres() } }, // optional
);
afterAll(cleanup);
```

`specification.cli(bin, { root?, services?, docker?, transform? })` → `{ cli, cleanup, docker, orchestrator }`.

- Exercise the **product command**, not a third-party binary — `specification.cli()` on a `node_modules/.bin` binary is a B9 warning. Drive `cli.exec('build')`, `cli.exec('check')`, … and assert via the real output. Suppress with a reason only when the product genuinely IS that binary.
- `transform` is a last-resort escape hatch for output noise not covered by tokens (D6) — a token-equivalent transform is a warning.

## Setup (chainable)

| Method                             | Description                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `.seed("file.sql", { database? })` | SQL from `seeds/` (A7 rules apply)                                                                                                             |
| `.fixture("file")`                 | Copy the feature-local `fixtures/file` into the cwd                                                                                            |
| `.fixture("$FIXTURES/name/")`      | Shared `specs/fixtures/name/`. Trailing `/` (rsync) = spread contents into cwd; no slash = nest under `name/`. Chained calls layer (last wins) |
| `.env({ KEY: "value" })`           | Child env vars. `null` unsets, `$WORKDIR` expands to the cwd, calls merge. Overrides B6 injection                                              |

There is no `.project()` and no seed handler — `.fixture()` is the one file-state verb, `.seed()` is SQL-only (C7).

## Action (terminal) — one execution method, no `.spawn()`

| Method                                | Notes                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `.exec("args")`                       | Blocking → `CliResult`                                                                                  |
| `.exec(["build", "start"])`           | Sequential in the same cwd; stops on first non-zero exit                                                |
| `.exec("dev", { waitFor, timeout? })` | Long-running — resolves at the `waitFor` pattern (exit 0), killed at `timeout` (default 10 s, exit 124) |

## Assertions

```typescript
expect(result.exitCode).toBe(0);
expect(result.stdout).toContain('Build completed'); // scalpel probe
expect(result.stdout).toMatch('help.txt'); // golden — expected/help.txt, {{token}}-aware
expect(result.file('dist/index.js').exists).toBe(true);
await expect(result.directory('out')).toMatch('scaffold'); // expected/scaffold/ (directory)
await expect(result.filesystem).toMatch('upgraded'); // whole cwd
```

- Text reaches you via a `TextAccessor` (`result.stdout` / `.stderr` / container logs / `file().grep()`). `.grep(pattern)` returns a `TextAccessor` (chainable, snapshot-able) — there is NO `result.grep()`.
- Golden the whole surface per scoped use case (D11); `.grep()` / `toContain` for targeted presence/absence only. ANSI is stripped before comparison (`.text` stays raw).

## Services → auto-injected child env (B6)

With `services`, connection URLs are injected into the child: `<KEY>_URL` (CONSTANT_CASE, camelCase-aware — `analyticsDb` → `ANALYTICS_DB_URL`), plus `DATABASE_URL` (exactly one SQL DB) and `REDIS_URL` (exactly one redis). `.env()` overrides; `null` removes. Do NOT re-declare an injected URL with `.env()` (B6 warning).

## Docker-aware CLIs

For a CLI that spawns containers, declare `docker: { envVar, nameLabel, testRunLabel }`; the runner injects a unique test-run id, the binary must stamp `testRunLabel=<id>` on its containers.

```typescript
await using result = await cli.fixture('$FIXTURES/two-shops/').exec('deploy alpha'); // B5: bind with `await using`
const shop = result.container('alpha'); // lazy — queries docker only on access
expect(shop.exists).toBe(true); // property reads are SYNC
await expect(shop).toBeRunning(); // the async matcher
expect(shop.file('/app/shoply.yaml').content).toContain('name: alpha');
```

`await using` (B5) force-removes leaked containers at scope exit. Absent names return `exists === false` (no throw); a test that never calls `.container()` never touches Docker.

## Folder layout

```
specs/cli/
├── cli.specification.ts        # runner(s) at the facet ROOT
└── <domain>/                   # a product command/area — the folder follows the assets
    ├── <aspect>.test.ts        # 1..n test files per domain
    ├── fixtures/               # domain-local, copied into the cwd via .fixture('name')
    ├── seeds/                  # *.sql ONLY
    └── expected/               # snapshots, FLAT ('help.txt', 'config.json', 'tree-name/')
```
