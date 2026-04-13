# `cli()` mode

Runs a CLI binary in a fresh, empty temp directory on every invocation. Designed for testing scaffolding tools, code generators, and any CLI that writes files into its cwd.

## Setup

```typescript
// tests/setup/cli.specification.ts
import { resolve } from 'node:path';
import { cli } from '@jterrazz/test';

export const spec = await cli({
    command: resolve(import.meta.dirname, '../../bin/my-cli.sh'),
    root: '../fixtures',
});
```

The `root` is the base directory for `.project("name")` lookups — it's never used as the working directory for exec.

## Working-directory semantics

Every spec runs in a **fresh, empty temp directory** by default. You can pre-populate it three ways:

```typescript
// (1) Empty — the default
await spec('fresh').exec('scaffold my-app').run();

// (2) Copy a whole fixture project as the starting state
await spec('existing').project('my-app-fixture').exec('build').run();

// (3) Copy specific files into the temp dir
await spec('with fixture').fixture('invalid.ts').exec('lint').run();
```

The runner **never writes into `fixturesRoot`** — even a bare `spec("x").exec("...")` gets a fresh mkdtemp directory. This is ideal for scaffolding CLIs that would otherwise pollute your committed fixtures.

## Environment variables

Use `.env({...})` to inject env vars into the child process. `null` unsets a variable. `$WORKDIR` expands to the temp working directory — useful for full `HOME` isolation:

```typescript
await spec('sync --all').env({ HOME: '$WORKDIR', TZ: 'UTC' }).exec('sync --all').run();
```

## Directory snapshots

The big win for scaffolding tests: snapshot an entire generated tree against a committed fixture, with structured diffs on mismatch.

```typescript
test('scaffolds a Go API project', async () => {
    // Given — fresh tempdir, scaffold writes files into it
    const result = await spec('go-api').exec('scaffold --type go-api --name my-service .').run();

    expect(result.exitCode).toBe(0);

    // Then — the tree matches the committed fixture
    await result.directory('.').toMatchFixture('go-api');
});
```

The fixture lives at `tests/e2e/{feature}/expected/go-api/`. Update fixtures with:

```bash
JTERRAZZ_TEST_UPDATE=1 vitest
# or
vitest -u
```

On mismatch, you get a structured diff:

```
Directory mismatch: go-api
  3 differences: 1 added, 0 removed, 2 changed

  + added    extra-file.txt                    (not in fixture)
  ~ changed  go.mod                             (1 line differs)
      line 5:
        fixture:   module example.com/old
        generated: module example.com/new
```

Default ignores: `.git`, `.DS_Store`, `node_modules`, `.next`, `dist`, `.turbo`, `.cache`. Pass extra ignores per-call:

```typescript
await result.directory('.').toMatchFixture('my-fixture', {
    ignore: ['.copier-answers.yml', '.gitkeep'],
});
```

## Multi-step execution

Run multiple commands sequentially in the same working directory. Stops on first failure:

```typescript
await spec('build then start').project('my-app').exec(['build', 'start']).run();
```

## Long-running processes

Use `.spawn()` for dev servers, watch modes, etc. Resolves on stdout/stderr pattern match or timeout:

```typescript
await spec('dev server')
    .project('my-app')
    .spawn('dev', { waitFor: 'listening on port', timeout: 10_000 })
    .run();
```

## See also

- [`cli()` API reference](/reference/functions/cli)
- [`DirectoryAccessor`](/reference/interfaces/DirectoryAccessor) — snapshot methods
- [`SpawnOptions`](/reference/interfaces/SpawnOptions) — long-running process config
