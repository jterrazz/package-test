# CLI specs (`specification.cli`)

`specification.cli(bin, options)` tests a command-line binary. Every spec runs the binary in a **fresh, empty temp directory**, captures stdout/stderr/exit code, and exposes the resulting filesystem — and, in Docker-aware mode, the containers the binary spawned. The CLI is always a local binary.

Use it when the subject under test is a process invocation. If the process serves HTTP, test that surface with [api](api-specs.md).

## What it specifies

A CLI spec answers one question: **given this file tree, this environment and this argv, what does the binary print, what does it exit with, and what does it leave on disk?** The subject is the built command met through a child process — never an imported function, which is a module test's ([Module tests](module-tests.md)). Most of them are written as documents rather than as code; [Spec documents](spec-documents.md#the-three-doors-one-runner) says when each door is right.

## The constructor

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

`bin` takes one of two forms. An absolute path — as above, or the built `dist/cli.js` of the package under test — runs that file. A bare name is looked up in the project's `node_modules/.bin/`, then in the `node_modules/.bin/` of the directory vitest runs from, and is otherwise handed to the shell, which finds it on `PATH`: `specification.cli('shoply')` runs an installed `shoply`. npm links the binaries of your dependencies there, never your own package's `bin`, so a project testing its own command passes the absolute path of the file its `bin` names. A relative path is neither: every spec runs in a fresh temp directory, so it resolves against that directory, not your project.

### Options

| Option      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`      | **Project-root override** only (rule `no-redundant-root`): anchors local-bin resolution and the artefact paths. It is _not_ a fixtures root — a fixture's path is read from the spec file. Auto-discovery applies when omitted                                                                                                                                                                                                                                                                  |
| `services`  | Named record of infrastructure services (`postgres()`, `redis()`, `sqlite()`) — connection URLs are auto-injected into the child env (rule `service-urls-injected`)                                                                                                                                                                                                                                                                                                                             |
| `docker`    | Opt-in Docker awareness: `{ envVar, nameLabel, testRunLabel }` — see [Docker-aware mode](#docker-aware-mode)                                                                                                                                                                                                                                                                                                                                                                                    |
| `defaults`  | Environment applied to **every** run of this binary — the variables the product needs to be deterministic at all (`TZ`, `NO_COLOR`, `LANG`, a config home under the spec's own workdir). Stated once per app; a chained `.env()` and a document's `env:` both win over it                                                                                                                                                                                                                       |
| `env`       | Named **environment sets** a spec document names by bare word (`env: [frozen]`) — see [Registration](#registration--once-per-app)                                                                                                                                                                                                                                                                                                                                                               |
| `serve`     | Named **servers** a spec document starts (`serve: [mcp]`): `{ command, ready, url, env }` — see [Registration](#registration--once-per-app)                                                                                                                                                                                                                                                                                                                                                     |
| `transform` | **Escape hatch only** (rule `no-transform-duplicating-tokens`): a normalizer applied to streams before comparison, for application noise not covered by tokens. ANSI stripping is already the default; a transform that only re-implements standard tokens is a lint error                                                                                                                                                                                                                      |
| `commands`  | The words the binary's commands are spelled with (`['db', 'migrate']`), read by the conventions checker and never by the run: a chain's subject is the leading words of its command line the list of ITS runner holds — `exec('db migrate --dry')` is filed under `cli/db/migrate/` (`one-subject-per-spec`, `spec-in-subject-folder`), whichever other runner the spec imports. Written in the call or bound to a `const` of the runner's file. Without it the first word alone is the subject |

## The chain

### `.exec()` — the single execution method

`.exec(args?, options?)` is the **only** way to run the binary — there is no `.spawn()`. It covers short commands, long-running processes, and sequences. Called with **no arguments**, the binary runs bare (no CLI args) — clearer than the `.exec('')` idiom:

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
    expect(result.stdout).toMatch(file('./_expected/help.txt'));
});
```

#### Long-running processes: `waitFor` / `timeout`

```typescript
test('dev server boots', async () => {
    // Given - long-running: resolved on pattern match, killed at timeout otherwise
    const result = await cli
        .fixture(directory('../../_shared/_fixtures/base-shop/'))
        .exec('dev --port 0', { waitFor: 'Listening on', timeout: 10_000 });

    // Then
    expect(result.stdout.text).toContain('Listening on');
});
```

- `waitFor` — a pattern; the promise resolves (exit code 0) as soon as it appears in **stdout or stderr** (both streams are watched). If the process exits before matching, the result carries a non-zero exit code (a clean exit-0 without the pattern is reported as `1`).
- `timeout` — milliseconds; the process is killed when it elapses without a match, with exit code `124`. **Default: 10 000 ms** when `waitFor` is set without a `timeout`.
- On resolution (match, exit, or timeout) the child is ended with the escalation every `process()` takes ([Services § `process()`](../reference/services.md#process--the-one-shape-an-external-process-takes)).
- Termination targets the **whole process group**, not just the direct shell child: the process is spawned detached (its own group on POSIX) and signalled via the negative pid, so descendants — a `tsdown --watch` grandchild under a `dev` command, a background server the script forked — die with it instead of leaking past the spec. On platforms without group support (Windows), or when the group is already gone, it degrades to the direct child kill.
- Passing either option marks the run as long-running; combining them with the array (sequence) form is an error.

#### `cwd` — a folder of the working directory

`{ cwd: 'packages/site' }` runs the command in a folder of the working directory, named relative to it — a workspace member a tool judges from inside, a clone whose parent holds what the tool must not read. The folder is one the fixtures laid; a path leaving the working directory, absolute or climbing out of it, is refused before anything runs, and so is a folder the working directory does not hold. `cwd` is no long-running option: it combines with a sequence, and with `waitFor`. The result still reads the working directory as a whole — `result.file('packages/site/out.txt')`.

Quoting is identical between the one-shot and `waitFor` forms: both run the full command line through the shell (`spawnSync` vs `spawn`, `shell: true`), so a quoted argument behaves the same either way — there is no naive whitespace split.

#### Sequences: array form

```typescript
test('build then start chain stops at first failure', async () => {
    // Given - a sequence in the SAME working directory
    const result = await cli
        .fixture(directory('../../_shared/_fixtures/base-shop/'))
        .exec(['build', 'start --check']);

    // Then
    expect(result.exitCode).toBe(0);
});
```

Commands run sequentially in the same cwd; the sequence stops at the first failure. This is still one terminal action — one spec, one `.exec()` (rule `one-terminal-action-per-chain`). An empty array throws (`exec([]) requires at least one command`), and `{ waitFor, timeout }` cannot be combined with the array form.

### Working-directory semantics

Every spec gets a brand-new temp directory (`mkdtemp`) as its cwd. The runner never writes into your fixtures.

That directory lives in the **OS temp dir**, inside the run's own temp root, and it stays there on purpose. It is scratch — created for one spec, removed once that spec's test has finished (at the run's end under `test.concurrent`, see [Set up a project](../start/set-up-a-project.md#where-a-run-writes)) — not something the project produced, so it does not belong under `.artifacts/` with the caches a next run reuses (see [Set up a project](../start/set-up-a-project.md#where-a-run-writes)). Writing it inside the project would also change what a spec sees: a binary that walks up looking for a `package.json` would find yours instead of nothing.

Two disjoint verbs shape a spec's state (rule `seeds-are-sql`): **`.fixture()` carries file state** (an isolated tree copied into the cwd), **`.seed()` carries database state** (SQL only). Any "transformation" you need is expressed declaratively, in the _shape_ of the fixture tree; only what git cannot carry is laid by a step ([`.prepare()`](#prepare--what-no-fixture-can-carry)).

A fixture is named by `file()` or `directory()`, with its path from the spec file spelled in full — the wrapper states what it names:

| Call                                                   | Names                          | Copy effect                                   |
| ------------------------------------------------------ | ------------------------------ | --------------------------------------------- |
| `.fixture(file('./_fixtures/config.toml'))`            | one file beside the spec       | `<cwd>/config.toml` (the file under its name) |
| `.fixture(directory('./_fixtures/base-shop/'))`        | a directory beside the spec    | its **contents spread** into `<cwd>`          |
| `.fixture(directory('../../_shared/_fixtures/shop/'))` | a directory of the shared pool | its **contents spread** into `<cwd>`          |

A directory's path ends in `/`, and the type refuses one that does not; a `file()` that names a directory on disk, or a `directory()` that names a file, is refused with the form to write (rule `disk-named-by-relative-path-at-runtime`). A command that expects the project one level down gets a fixture tree shaped that way: `./_fixtures/nested/shop/…`, spread. The shared pool is `specs/_shared/_fixtures/`, and a spec reaches it by the path that climbs to it — nothing hides behind a marker. Chained fixtures **layer** in order — a later one overwrites files from an earlier one.

| Setup                                                       | Effect on the cwd                                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| _(nothing)_                                                 | Empty directory                                                                                                                     |
| `.fixture(directory('../../_shared/_fixtures/base-shop/'))` | Spread a whole shared project into the cwd                                                                                          |
| `.fixture(file('./_fixtures/config.toml'))`                 | Copy the leaf's own `_fixtures/config.toml` into the cwd                                                                            |
| `.seed(file('./_seeds/users.sql'))`                         | SQL into a service database (the `database:` option: [Services § The `database:` rule](../reference/services.md#the-database-rule)) |

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
    await expect(result.directory('my-shop')).toMatch(directory('./_expected/shop-scaffold/'));
});

test('upgrade rewrites the workspace predictably', async () => {
    // Given
    const result = await cli
        .fixture(directory('../../_shared/_fixtures/base-shop/'))
        .exec('upgrade');

    // Then - snapshot of the ENTIRE cwd + flat read of the file list
    await expect(result.filesystem).toMatch(directory('./_expected/upgraded-shop/'));
    expect(await result.filesystem.files()).toContain('shoply.lock');
});

test('seeds a single fixture file', async () => {
    // Given
    const result = await cli.fixture(file('./_fixtures/legacy-config.toml')).exec('migrate-config');

    // Then
    expect(result.file('shoply.yaml').exists).toBe(true);
});
```

A tree golden is a directory, compared by `toMatch(directory('./_expected/shop-scaffold/'))` — its path ends in `/` where a file golden's carries its extension (rule `golden-path-has-extension`).

### `.env()` — child process environment

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
- `cli.with({ env })` is the environment a whole FILE shares: every chain of the view it hands back starts from it, and a chain's own `.env()` merges over it ([Conventions](../concepts/conventions.md#what-a-file-shares)). What every run of the binary needs, whichever file, is the runner's `defaults`.

#### Auto-injected connection URLs

When the runner has `services`, the framework injects into the child env, automatically:

| Variable       | Rule                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<KEY>_URL`    | One per record key, uppercased to CONSTANT_CASE at camelCase boundaries: `db:` → `DB_URL`, `analyticsDb:` → `ANALYTICS_DB_URL`, `cache:` → `CACHE_URL` |
| `DATABASE_URL` | Standard alias, only when the record has **exactly one** SQL database                                                                                  |
| `REDIS_URL`    | Standard alias, only when the record has **exactly one** redis                                                                                         |

`.env()` overrides any injected value; `null` removes it. Re-declaring what injection already provides (`.env({ DATABASE_URL: db.connectionString })`) is redundant — rule [`no-redundant-service-url`](../reference/linting.md#no-redundant-service-url) refuses it.

```typescript
// One SQL database → DATABASE_URL and DB_URL both injected, no database: option (rule `database-named-only-when-several`)
export const { cli: migrateCli, cleanup } = await specification.cli('shoply-migrate', {
    services: { db: postgres() },
});

test('migrates a legacy schema', async () => {
    // Given - DATABASE_URL / DB_URL injected automatically into the child env
    const result = await migrateCli.seed(file('./_seeds/legacy-schema.sql')).exec('up');

    // Then
    expect(result.exitCode).toBe(0);
    await expect(result.table('schema_migrations')).toMatch([['20260716']]);
});
```

### File state is the shape of a fixture tree

CLI-mode `.seed()` is **SQL only** — it carries database state, nothing else (rule `seeds-are-sql`). To put files or config trees into the cwd, use `.fixture(directory(…))` with a fixture laid out exactly as the cwd should look. There is no "seed handler" or path-prefix dispatch.

```typescript
// specs/cli/deploy/_fixtures/two-shops/  ← committed, shaped like the target cwd
//   shoply.yaml
//   shops/alpha/config.yaml
//   shops/beta/config.yaml

test('deploys from a shaped workspace', async () => {
    // Given - the tree is spread into the cwd; layering a second fixture would
    // overwrite matching files (last write wins)
    const result = await cli.fixture(directory('./_fixtures/two-shops/')).exec('deploy alpha');

    // Then
    expect(result.exitCode).toBe(0);
});
```

#### Where a fixture lives

A fixture tree sits beside the one leaf that reads it, `./_fixtures/<name>/`, or — when several leaves share it — in the `_fixtures/` of the lowest folder they share, `specs/_shared/_fixtures/` when they span facets, reached by the path that climbs to it. That law holds for every reserved folder, `_setup/` included, and its owner is [Conventions](../concepts/conventions.md#the-naming-recap), with the three rules that hold it (`no-reach-into-sibling-ground`, `no-duplicate-ground`, `ground-shared-or-inline`).

### `.link()` — a package the working directory resolves

A fixture tree carries no `node_modules`: git never tracks one. A binary whose subject imports a package — a checker that loads a plugin, a build that resolves a peer — needs that package where Node looks for it, and `.link(name, source?)` puts it there: `<cwd>/node_modules/<name>`, a symlink to the package, never a copy and never an install.

| Call                                                | Links                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `.link('@acme/sdk')`                                | the package the spec's own project installed, found as Node finds it from the spec |
| `.link('@acme/sdk', directory('./_fixtures/sdk/'))` | the package a directory holds — a stub install, a broken one, an older version     |

```typescript
test('loads the plugin the project installed', async () => {
    // Given - a project fixture, and the plugin it imports linked into its node_modules
    const result = await cli
        .fixture(directory('./_fixtures/shop/'))
        .link('@acme/sdk')
        .exec('check');

    // Then
    expect(result.exitCode).toBe(0);
});
```

A link is armed after every fixture, so it replaces a package a fixture laid under the same name. The name is a package name — `@scope/name` or `name` — and one name is linked once per chain; a bare name no `node_modules` above the spec holds, or a `directory()` naming nothing, is refused before the binary runs. So is a working directory whose `node_modules` (or scope folder) is a symlink — a fixture can carry one, a binary can lay one: the link would replace the real install it points to — or a file, which leaves the link no folder to be laid in.

### `.prepare()` — what no fixture can carry

A fixture tree is what git tracks, and some ground git never tracks: a `.git` for a tool that reads a repository, an empty folder, a file the repository's own `.gitignore` keeps out of the fixture, an index holding one file and not another. `.prepare(step)` runs a function of the working directory's absolute path once every fixture and link is laid, in the order the steps are stated, before the binary runs; a step may be async, and one that throws fails the chain before anything runs.

```typescript
test('refuses a tracked build artefact', async () => {
    // Given - a project, made a repository whose index holds a buildinfo its .gitignore excludes
    const result = await cli
        .fixture(directory('./_fixtures/project/'))
        .prepare((workdir) => {
            writeFileSync(join(workdir, 'tsconfig.tsbuildinfo'), '{}\n');
            execFileSync('git', ['init', '--quiet'], { cwd: workdir });
            execFileSync('git', ['add', '--force', 'tsconfig.tsbuildinfo'], { cwd: workdir });
        })
        .exec('check');

    // Then
    expect(result.exitCode).toBe(1);
});
```

A step is the Given of state no fixture can hold, never a second way to write one: a file a fixture could carry belongs in the fixture, where it is read in the tree rather than in code, and a package belongs to `.link()`.

### The chain never reaches a real system

A CLI spec is sandboxed the way an HTTP spec is, and for the same reason: what a chain proves must come out of its fixture, never out of the machine that happened to run it. A chain that shells out to a real `kubectl`, `helm` or `gh`, opens a network connection, or reads the operator's home directory is **a test escaping the sandbox, not extra realism** — it passes on the one laptop where those tools are installed and configured, fails everywhere else, and either way it proves something about that laptop rather than about the binary under test. The HTTP half of the same rule is `network-strict-after-first-stub`, in [stubs](../reference/stubs.md).

The framework supplies the ground; the chain states the sandbox, in three verbs:

| Verb                                                     | What it closes                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `.fixture(directory('../../_shared/_fixtures/<name>/'))` | spreads a `bin/` of stub binaries into the spec's temp cwd                                 |
| `.env({ PATH: '$WORKDIR/bin:/usr/bin:/bin' })`           | puts those stubs FIRST — the binary finds the stub, never the tool installed on the host   |
| `.env({ HOME: '$WORKDIR' })`                             | moves config dirs, caches and credential stores onto the temp cwd, off the operator's home |

`PATH` is not rewritten for you: `.fixture(directory(…))` lays the tree down, `.env()` decides what the child is allowed to find. Pin the tail of `PATH` too — inheriting the developer's own `PATH` re-opens the door the stub was there to close.

```typescript
test('reports what the cluster holds', async () => {
    // Given - stubs first on PATH, HOME on the temp cwd: nothing can reach out
    const result = await cli
        .fixture(directory('../../_shared/_fixtures/cluster-stub/'))
        .env({ HOME: '$WORKDIR', PATH: '$WORKDIR/bin:/usr/bin:/bin', TZ: 'UTC' })
        .exec('cluster pods');

    // Then
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(file('./_expected/pods.txt'));
});
```

#### The shape of a stub fixture

A stub fixture is a `bin/` holding one script per binary the run must not find for real:

```text
specs/_shared/_fixtures/cluster-stub/
└── bin/
    ├── kubectl
    └── helm
```

Each script answers **by argv** and refuses everything else. The executable bit survives the copy, so a stub committed `chmod +x` is executable in the cwd:

```bash
#!/bin/sh
# Every invocation this suite cans. Anything else is a chain reaching for an
# answer nobody wrote — fail loudly rather than improvise one.
case "$*" in
  "get pods -A -o json")
    cat <<'JSON'
{"items":[{"metadata":{"name":"api-abc12","namespace":"prod"},"status":{"phase":"Running"}}]}
JSON
    ;;
  *)
    echo "cluster-stub kubectl: unexpected invocation: $*" >&2
    exit 64
    ;;
esac
```

The catch-all matters as much as the canned cases: a stub that shrugs at an unknown invocation hands the chain an empty success, and the spec goes green on a command nobody described.

**One fixture per ANSWER of the system, not one per test.** A cluster with things in it, that same cluster holding nothing, and a cluster whose API server is down are three fixtures, not three settings of one — they are three answers to the same question, and choosing between them is choosing what the chain proves. So a new answer is a NEW fixture, never a flag threaded through an existing stub: fixtures layer (a drift stub over a healthy one), which is how one is extended without being made conditional.

**The data-driven form: the script routes, a FILE answers.** When the answer is a document — a JSON payload, a listing, a manifest — heredocs stop being readable and stop layering: two worlds that differ only in what the cluster holds have to differ in the script. So the `case` maps a question to an answer file under `answers/<system>/`, and the script's whole job is routing:

```bash
#!/bin/sh
# Route argv to the file that answers it. The ANSWERS are the fixture; this
# Script only says which one the question maps to.
answers="${0%/*}/../answers/cluster"
case "$*" in
  "get pods -A -o json") file="$answers/pods.json" ;;
  "get nodes -o json")   file="$answers/nodes.json" ;;
  *) echo "cluster-stub kubectl: unexpected invocation: $*" >&2; exit 64 ;;
esac
[ -f "$file" ] || { echo "cluster-stub kubectl: no answer file at $file" >&2; exit 64; }
cat "$file"
```

Two failures, both exit 64, and they say different things: **no route** names the argv nobody described, **a routed file that is absent** names the path the fixture was supposed to carry. Neither may degrade into an empty success — which is also why **an empty answer is an EMPTY file, never a missing one**: "the cluster holds nothing" is a fixture stating `[]`, and a file that is not there is a fixture that forgot to state anything.

Pick by what the stub is standing in for. **Data-driven** when the answer is a document two worlds may legitimately differ on — that difference is then a fixture layered over another, and the script never changes. **`case`** when the stub simulates an action (a write, an exit code, a banner) or answers one constant: a file per constant is a directory of one-liners, and indirection nobody reads.

A served stub — a `serve:` server in a spec document — routes the same way over `$TEST_WORKDIR`, which is where that document's `fixture:` landed: see [Registration — once per app](#registration--once-per-app).

## The result

A CLI result carries the streams, the exit code, the files the run left and — under Docker-aware mode — the containers it touched. Every accessor and every matcher it accepts is [Assertions](../reference/assertions.md)'s; what follows is the part only this facet has.

### Streams, JSON, grep

```typescript
test('fails on unknown command with a useful error', async () => {
    // Given
    const result = await cli.exec('frobnicate');

    // Then
    expect(result.exitCode).toBe(1);
    expect(result.stderr.text).toContain("Unknown command 'frobnicate'");
    expect(result.stdout.text).toBe(''); // .text: ANSI stripped, transform applied
});

test('emits machine-readable config', async () => {
    // Given
    const result = await cli.exec('config --json');

    // Then
    expect(result.json.value).toMatchObject({ name: 'shoply' }); // read + native matcher
    expect(result.json).toMatch(file('./_expected/config.json')); // _expected/config.json
});

test('lints a shop and reports per-file blocks', async () => {
    // Given
    const result = await cli.fixture(directory('../../_shared/_fixtures/base-shop/')).exec('lint');

    // Then - snapshot the whole surface; grep is the scalpel for targeted probes
    expect(result.stdout).toMatch(file('./_expected/lint-output.txt')); // full snapshot, tokens for volatile parts
    expect(result.stdout.grep('products/ok.yaml').text).not.toContain('error'); // absence probe
});
```

`result.stdout` / `result.stderr` are `TextAccessor` subjects — the universal text handle (stdout, stderr, container logs, file text): ANSI-stripped for every comparison ([Tokens § Where tokens work](../reference/tokens.md#where-tokens-work)): `.text` is that comparable text — the runner's `transform` applied too — and `.raw` the capture as it was. Text operations are **closed** over the type: `.grep(pattern)` cuts the blank-line-separated blocks of the capture, its colour codes stripped and BEFORE the transform — so a pattern the transform removes still finds its block — and returns a `TextAccessor` (not a string) whose `.text` reads through the same transform, so it chains (`result.stdout.grep(a).grep(b)`) and snapshots (`expect(result.stdout.grep('users.ts')).toMatch(file('./_expected/block.txt'))`). There is no `result.grep()` — the source is always explicit. `result.json` parses stdout as JSON (`.value` for the parsed object).

**Tool output → snapshot per scoped use case (rule `output-asserted-as-a-golden`).** For linter/compiler/CLI output, prefer a per-use-case fixture project + a full `expect(result.stdout).toMatch(file('./_expected/<use-case>.txt'))` snapshot (volatile parts covered by `{{duration}}` / `{{workdir}}` / `{{path}}` tokens, generated with `TEST_UPDATE=1`) over a cluster of greps. The fixture is the Given — no shared `beforeAll`. Keep `.grep()` for targeted presence/absence probes in large outputs. The full surface is in [assertions](../reference/assertions.md).

## Unique here

### Spec documents — `<case>.spec.yaml`

Most cli cases are documents: a session written as data — the ground, the runs, what each printed and left on disk — collected as a test file of its own by the `cli()` project. The format is [Spec documents](spec-documents.md): its keys, its paths, the three doors that run it, failure and update. What stays here is what only this constructor owns: the words a document names its ground by.

#### Registration — once per app

The document names its ground by WORD; the code says what those words mean, in the `specification.cli()` options:

```typescript
// apps/cli/specs/cli/cli.specification.ts, in a workspace
export const { cli, cleanup } = await specification.cli(bin, {
    env: {
        frozen: { HOME: '$WORKDIR', TZ: 'UTC' },
    },
    serve: {
        mcp: {
            // Relative to apps/cli/ — the project root, not the repo root
            command: 'bun specs/harness/mcp-server.ts',
            env: 'SHOPLY_MCP_ORIGIN',
            ready: /listening on port (?<port>\d+)/,
            url: (port) => `http://127.0.0.1:${port}/mcp`,
        },
    },
});
```

A `serve` entry is spawned with the document's extra `KEY: value` merged into its environment, and its **cwd is the project root** — rule `no-redundant-root`'s root, the nearest ancestor of the specification file carrying a `package.json`. **In a workspace that is the package's own directory, not the repository root**: a spec at `<repo>/apps/cli/specs/cli/cli.specification.ts` gives `<repo>/apps/cli/`, so `command` reads `'bun specs/harness/mcp-server.ts'` and not `'bun apps/cli/specs/harness/mcp-server.ts'`. Pass the runner's `root` option to move it.

`ready` is a regex over the child's output whose **first capture group** is the port the server chose (named or not — it is group 1 either way); the framework injects no `PORT`, the server announces one. `url(port)` builds the URL, and `env` names the variable it is bound to in every run's child.

**`TEST_WORKDIR` is seeded into every served child** — the document's working directory in the resolved form `{{workdir}}` holds and `$WORKDIR` expands to. The servers start after `fixture:` has been copied, so a stub reads the world the document laid down (`$TEST_WORKDIR/answers/dashboard/posts.json`) exactly as a stub binary reads `${0%/*}/../answers/`: a scenario is a layer of files, not a flag threaded through the server. The mapping form overrides it like any other key — `- mcp: { TEST_WORKDIR: /elsewhere }` points that one server somewhere else.

### Docker-aware mode

For CLIs that spawn Docker containers, declare the `docker` option (rule `containers-removed-with-the-run`). The specification refuses to start where no Docker daemon answers: a run that reads containers and could see none would pass on nothing.

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

A Docker-aware runner **requires `await using`** on every result (rule `docker-exec-bound-with-await-using` — the checker infers the runners from the `docker:` option), so leaked containers are cleaned by label filter at scope exit:

```typescript
test('deploy spawns a labelled container', async () => {
    // Given - await using ⇒ containers force-removed at scope exit (rule `docker-exec-bound-with-await-using`)
    await using result = await deploy
        .fixture(directory('../../_shared/_fixtures/two-shops/'))
        .exec('deploy alpha');

    // Then - lazy access (zero Docker calls if you never touch .container)
    const shop = result.container('alpha');
    expect(shop.exists).toBe(true);
    await expect(shop).toBeRunning();

    // Reads INSIDE the container, same vocabulary as on the host
    expect(shop.file('/app/shoply.yaml').content).toContain('name: alpha');
    const inside = await shop.exec('ls /app');
    expect(inside.stdout.text).toContain('shoply.yaml');
    expect(shop.stdout.text).toContain('shop ready'); // container logs

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

The runner handle also destructures to `{ cli, cleanup, docker }`. The `docker(containerId)` reader is the escape hatch for reading an **arbitrary** container by raw id (e.g. one a follow-up command referenced): it lazily runs `docker inspect` and returns the same `ContainerAccessor` type, so `await expect(docker(id)).toBeRunning()` and the sync reads work identically. Unlike `result.container(name)` it does not need `nameLabel` — it looks up by id directly; an unknown id yields `exists: false`.

## Pitfalls

- **Reaching for `.spawn()`.** It does not exist — `.exec(args, { waitFor, timeout })` is the unified execution method.
- **Asserting on raw ANSI or absolute paths in snapshots.** ANSI is stripped by default; paths and timestamps belong to `{{workdir}}`, `{{path}}`, `{{iso8601}}` tokens in `_expected/*.txt` — `transform` is a last resort (rule `no-transform-duplicating-tokens`).
- **Assigning a Docker-aware result without `await using`.** Error (rule `docker-exec-bound-with-await-using`) — that is the leak-cleanup mechanism.
- **Re-declaring injected URLs.** `.env({ DATABASE_URL: … })` duplicates rule `service-urls-injected`'s auto-injection, and [`no-redundant-service-url`](../reference/linting.md#no-redundant-service-url) refuses it — override only to _change_ it, `null` to remove it.
- **Letting the chain find the real binary.** Mounting a stub fixture without pinning `PATH` (or pinning it with the developer's own `PATH` on the tail) leaves the installed `kubectl`/`gh` reachable — the spec then tests the operator's machine. Pin `PATH` and `HOME` on `$WORKDIR`.
- **Writing into fixture folders from a test.** The cwd is a copy; feature-local `_fixtures/` and the shared `specs/_shared/_fixtures/` pool are templates and stay pristine.
- **Reaching for `.project()` or `seedHandlers`.** Both are gone — one verb copies files, `.fixture()`, handed a `file()` or a `directory()`, and `.seed()` is SQL-only (rule `seeds-are-sql`).
- **A bare fixture name.** `.fixture('shop/')` and `directory('shop/')` do not compile: the path is spelled from the spec — `./_fixtures/shop/` beside it, `../../_shared/_fixtures/shop/` in the pool (rule `disk-named-by-relative-path`).
- **Building a `node_modules` by hand.** `mkdirSync` and `symlinkSync` around a raw `spawnSync` is a chain the runner already is: `.link()` lays the package, and the spec stays one chain.
- **Forgetting the extension in `file('./_expected/help')`.** The extension is part of the path (rule `golden-path-has-extension`); a tree is `directory('./_expected/help/')`.

## Related

[Spec documents](spec-documents.md) · [Set up a project](../start/set-up-a-project.md) · [Assertions](../reference/assertions.md) · [Tokens](../reference/tokens.md) · [Services](../reference/services.md)
