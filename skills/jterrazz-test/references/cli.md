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

`specification.cli(bin, { root?, services?, docker?, transform?, env?, serve? })` → `{ cli, cleanup, docker, orchestrator }`. `env` / `serve` are the two registries a [literate spec](#literate-specs--casecli) names by word.

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

## Sandbox — the chain reaches nothing real

Reaching a real `kubectl` / `helm` / `gh`, the network, or the operator's `$HOME` is a test escaping the sandbox, not extra realism — D7's rule for HTTP, with no mechanism to enforce it here: the chain states it, in three verbs.

```typescript
await cli
    .fixture('$FIXTURES/cluster-stub/') // bin/<binary> stubs into the temp cwd
    .env({ HOME: '$WORKDIR', PATH: '$WORKDIR/bin:/usr/bin:/bin' }) // stubs first; pin the tail
    .exec('cluster pods');
```

A stub is `fixtures/<name>/bin/<binary>`: a `case "$*"` script answering by argv, with a catch-all that exits non-zero on any invocation nobody canned. **One fixture per ANSWER of the system** (a cluster populated / empty / unreachable) — a new answer is a new fixture, never a flag on an existing stub. Chained fixtures layer, which is how one is extended.

## Action (terminal) — one execution method, no `.spawn()`

| Method                                | Notes                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `.exec("args")`                       | Blocking → `CliResult`                                                                                               |
| `.exec(["build", "start"])`           | Sequential in the same cwd; stops on first non-zero exit                                                             |
| `.exec("dev", { waitFor, timeout? })` | Long-running — resolves at the `waitFor` pattern (exit 0), killed at `timeout` (default 10 s, exit 124)              |
| `.run("case.cli")`                    | Runs a [literate spec](#literate-specs--casecli): its header and EVERY block asserted → the last block's `CliResult` |

## Literate specs — `<case>.cli`

One scenario per file, **beside the spec** (never under `expected/`, which holds goldens). The header is prose, the blocks are the session.

```
test: refuses to guess when it is run outside the checkout   # the vitest title
given: a workdir with no home/ + apps/ pair above it         # B4, mandatory
then: the error names where the command has to be run        # B4, mandatory
fixture: $FIXTURES/repositories-stub/                        # repeats, layers, .fixture() semantics
env: frozen SHOPLY_ORIGIN=http://127.0.0.1:9                 # bare word = registered set; KEY=value; $WORKDIR expands
serve: mcp MCP_STUB_WITHHOLD=get-article                     # repeats; a server registered in code

$ shoply repositories
exit: 1
--- stderr
Error: no directory with home/ and apps/ above the current directory
```

- Header keys are CLOSED (`test`, `given`, `then`, `fixture`, `env`, `serve`); `#` lines are comments; anything else is an error naming the line (checker passes `b4-cli-header`, `d4b-cli-shape`).
- `exit: <integer>` is mandatory and is the first line after `$`. Then stdout verbatim, then optionally `--- stderr` and stderr verbatim. A block ends at the next `$ ` or EOF; the blank line before a `$` is the separator, not output.
- Both streams are compared totally — no `--- stderr` asserts an EMPTY stderr. `{{token}}` works in both streams (D4), never in the header. Use `{{string}}` for wording that varies within a LINE; `{{any}}` only for a span that crosses lines.
- On a mismatch the diff marks only the real cause: a token line that matched renders as equal, and the stack carries one frame — the block's line in the `.cli`.
- All blocks share ONE cwd and the same servers, and **every** block is asserted — unlike `.exec([...])`, a non-zero exit does not stop the sequence.
- `TEST_UPDATE=1` rewrites only what follows each `$`; the header comes back byte-identical.

Registration, once per app:

```typescript
await specification.cli(bin, {
    env: { frozen: { HOME: '$WORKDIR', TZ: 'UTC' } },
    serve: {
        mcp: {
            command: 'bun specs/harness/mcp-server.ts',
            // cwd = the PROJECT root (A9: nearest package.json above the spec file) —
            // In a workspace that is apps/<pkg>/, not the repo root
            env: 'SHOPLY_MCP_ORIGIN', // the var the URL is bound to in every block
            ready: /listening on port (?<port>\d+)/, // group 1 = the port the server announces
            url: (port) => `http://127.0.0.1:${port}/mcp`,
        },
    },
});
```

Three doors, one engine:

| Door       | How                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **plugin** | `literate({ specification: './specs/cli/cli.specification.ts' })` from `@jterrazz/test/vitest` in `vitest.config.ts` — the `.cli` file IS the test file |
| **bridge** | `const result = await cli.run('case.cli')` from a `.test.ts` — runs the whole file, returns the LAST block's `CliResult` for one extra assertion        |
| **chain**  | unchanged — reach for it for containers, parallel fan-out, long-running processes, structural JSON, database state                                      |

`cli.run(file, { frozen: true })` opts a deliberately-wrong `.cli` out of the update rewrite (the `.cli` mirror of `toMatch(name, { frozen: true })`).

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
    ├── <case>.cli              # literate specs, BESIDE the tests (never under expected/)
    ├── fixtures/               # domain-local, copied into the cwd via .fixture('name')
    ├── seeds/                  # *.sql ONLY
    └── expected/               # snapshots, FLAT ('help.txt', 'config.json', 'tree-name/')
```
