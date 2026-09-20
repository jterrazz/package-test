# 14 — Assertions: the reference

Every assertion goes through `expect()` (rule D1). The framework auto-registers its matchers into vitest and types them **by subject**: a table subject only offers table matchers, a stream subject only stream matchers — the wrong pairing is a compile error. Result accessors are read-only; there are no assertion methods on accessors (`result.stdout.toContain(…)` does not exist — the methods live on `expect()`).

This chapter is the exhaustive matrix: every matcher, for every valid subject, with its sync/async rule and its resolution target.

## The two global rules

### Sync vs async (rule D2)

`await expect(…)` is used **only** for matchers that perform IO, and this table is the whole list — the types say the same thing, so a mistaken `await` is a toolchain error (`typescript(await-thenable)`) in a consumer and a missed one is an assertion that never runs:

| IO matcher subjects                                                 | Why                                  |
| ------------------------------------------------------------------- | ------------------------------------ |
| `result.table(…)`, and `toBeEmpty()` on it                          | Runs a SQL query                     |
| `result.filesystem` / `result.directory(…)`                         | Walks the disk                       |
| container subjects                                                  | Talks to the Docker daemon           |
| every accessor of a COMPONENT result (`tree`, `html`, `content`, …) | The capture crosses the browser seam |

Everything else is synchronous, and that includes the subjects it is easiest to get wrong: `result.value`, `result.error`, `result.response`, `result.stdout`, `result.stderr`, `result.json` — and `result.tree` on a WEBSITE page, which is captured on the node side and is a plain text subject there. Only a component's accessors are read inside the page.

### `toMatch` resolution (rule D3)

`.request(file)` reads `_requests/<file>`. Everything else is expected output: `expect(...).toMatch(name)` **always** resolves against `_expected/<name>`, for every subject — `response`, `stdout`, `stderr`, `json`, `directory`, `filesystem`. There is no per-subject resolution.

`_expected/` is flat: `toMatch('help.txt')` → `_expected/help.txt`. A slash in the name creates a subfolder: `toMatch('build/verbose.txt')` → `_expected/build/verbose.txt` (rule C5). The extension is part of the name and mandatory (`'help.txt'`, never `'help'`) — except for tree snapshots, which are directories: `toMatch('shop-scaffold')` → `_expected/shop-scaffold/` (rule C6).

All file-based comparisons understand the [`{{token}}` grammar](15-tokens.md); all code-side dynamic values use `match.*`.

## Scalars — native `expect`

Plain values take vitest's native matchers. No framework matcher exists (or is needed) for them.

| Subject                             | Type           | Example                                                                                                      |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `result.status`                     | `number`       | `expect(result.status).toBe(201)`                                                                            |
| `result.exitCode`                   | `number`       | `expect(result.exitCode).toBe(0)`                                                                            |
| `result.filesystem.cwd`             | `string`       | `expect(result.filesystem.cwd).toContain('/tmp/')`                                                           |
| `result.response.body`              | parsed body    | `expect(result.response.body).toEqual({ error: 'User 999 not found' })`                                      |
| `result.json.value`                 | parsed JSON    | `expect(result.json.value).toMatchObject({ name: 'shoply' })`                                                |
| `result.stdout.grep(pattern)`       | `TextAccessor` | `expect(result.stdout.grep('broken.yaml')).toContain('missing price')`                                       |
| `result.file(path).exists`          | `boolean`      | `expect(result.file('dist/index.js').exists).toBe(true)`                                                     |
| `result.file(path).content`         | `string`       | `expect(result.file('shoply.yaml').content).toContain('name: my-shop')`                                      |
| `result.stdout.text`                | `string`       | `expect(result.stdout.text).toBe('')` — raw capture, never stripped                                          |
| `result.containerIds`               | `string[]`     | `expect(result.containerIds).toHaveLength(1)`                                                                |
| `await result.filesystem.files()`   | `string[]`     | `expect(await result.filesystem.files()).toContain('shoply.lock')`                                           |
| `await cli.run('<case>.spec.yaml')` | `CliResult`    | the document asserts itself; the LAST run's result comes back — [12](12-cli.md#spec-documents--casespecyaml) |

## `result.response` — HTTP response (api)

| Matcher             | Sync/async | Resolves against   | Example                                                |
| ------------------- | ---------- | ------------------ | ------------------------------------------------------ |
| `toMatch('x.http')` | sync       | `_expected/x.http` | `expect(result.response).toMatch('user-created.http')` |

Checks, in order: the status line, the listed headers (**subset** — unlisted response headers are unconstrained, rule C3), then the body. Placeholders apply in headers _and_ body, with `#ref` captures shared across both:

```http
HTTP/1.1 201 Created
Location: /orders/{{uuid#order}}

{ "id": "{{uuid#order}}" }
```

On mismatch the failure shows which part diverged. A status mismatch is a three-line message naming the fixture:

```
Response status mismatch (user-created.http)
  expected: 201
  received: 500
```

A header mismatch has the same shape (`Response header mismatch (name)`, with `header:` / `expected:` / `received:` lines; a missing header shows `received: (absent)`). A body mismatch prints a line-by-line structural diff (`Response mismatch (name)`, `- Expected` / `+ Received`) of the expected body — with matchers and tokens rendered as their placeholder text (`{{uuid#order}}`) — against the actual body. The diff is literal: it does not annotate captured ref values, and a failed `{{uuid#order}}` re-occurrence surfaces only as the two differing lines.

`.not`: `expect(result.response).not.toMatch('user-created.http')` passes when any part diverges. Rarely useful — prefer positive fixtures.

## `result.table(name, { database }?)` — database tables (api, jobs, cli)

Always `await expect(…)` (IO). `database:` is **mandatory when the services record declares ≥ 2 databases, forbidden with exactly 1** (rule A7).

| Matcher                          | Sync/async | Example                                                                                                                         |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `toMatchRows({ columns, rows })` | async      | see below                                                                                                                       |
| `toBeEmpty()`                    | async      | `await expect(result.table('orders', { database: 'db' })).toBeEmpty()`                                                          |
| `toBeEmpty()` on a text subject  | async      | `await expect(result.error).toBeEmpty()` — the integration facet's "and it did not refuse" ([06](06-integration.md#the-result)) |

```typescript
await expect(result.table('orders', { database: 'db' })).toMatchRows({
    columns: ['id', 'status', 'total_cents', 'created_at'],
    rows: [[match.uuid(), 'pending', match.number(), match.iso8601()]],
});
```

Cell values are literals or [`match.*`](15-tokens.md) matchers — including `match.ref(name)` to capture a generated value in one table and require equality in another, and `match.ref(name, { not: other })` to require inequality:

```typescript
await expect(result.table('orders', { database: 'db' })).toMatchRows({
    columns: ['id'],
    rows: [[match.ref('order')]],
});
await expect(result.table('payment_intents', { database: 'db' })).toMatchRows({
    columns: ['id', 'order_id'],
    rows: [[match.ref('intent', { not: 'order' }), match.ref('order')]],
});
```

`toBeEmpty` is async on EVERY subject, the text ones included: it is one matcher with one signature, so a sync/async split by subject could not be expressed by a lint rule that keys on the matcher's name. Rule D2 therefore refuses the bare `expect(x).toBeEmpty();` outright — dropped, it passes the test and surfaces the real failure as an unhandled rejection.

A failing `toMatchRows` prints the expected grid against the actual rows for the selected columns, cell by cell — matcher cells render as their placeholder text (`Matcher.toString()`): `match.uuid()` shows as `{{uuid}}`, `match.ref('order')` as `{{ref#order}}`, `match.ref('intent', { not: 'order' })` as `{{ref#intent!order}}`, `match.regex(/…/)` as `{{regex:…}}`. A failing `toBeEmpty` reports how many rows it found (the count, not the rows themselves). `.not` inverts both (`.not.toBeEmpty()` = at least one row).

## `result.stdout` / `result.stderr` — stream subjects (cli, container `exec`)

Streams are compared **after ANSI stripping** (rule D6); the raw capture stays available as `.text`.

| Matcher               | Sync/async | Resolves against  | Example                                                           |
| --------------------- | ---------- | ----------------- | ----------------------------------------------------------------- |
| `toMatch('x.txt')`    | sync       | `_expected/x.txt` | `expect(result.stdout).toMatch('help.txt')`                       |
| `toContain('needle')` | sync       | —                 | `expect(result.stderr).toContain("Unknown command 'frobnicate'")` |

`toMatch` on a stream is a full-text snapshot; the fixture may contain any [token](15-tokens.md) (`{{semver}}`, `{{duration}}`, `{{workdir}}`, …). Token matching decides **pass or fail** only: `textEquals` resolves the placeholders to determine whether the output matches. The rendered failure, though, is a **literal** line-by-line diff (`Output mismatch (name)`, `- Expected` / `+ Received`) of the fixture text against the stripped output — tokens are not resolved in the diff, so a fixture line `Done in {{duration}}` is printed verbatim on the expected side whenever any line diverges, even if the duration itself matched.

> `toMatch` on **any accessor subject** (`result.stdout`, `result.json`, `result.response`, `result.directory`, `result.filesystem`) takes a **fixture name with its extension** (`'help.txt'`), never a regex. Passing a `RegExp` — the instinct carried over from vitest-native `toMatch` — throws immediately, naming the subject and pointing at the escape hatch: for a raw-regex assertion, reach through to the text with `expect(result.stdout.text).toMatch(/re/)`.

`toContain` failures print the needle and the (stripped) haystack in a diff-style layout so the near-miss is visible. `.not.toContain(…)` asserts absence.

```typescript
// .grep() returns a TextAccessor — chainable and snapshot-able, so the same
// Token grammar and _expected/ resolution apply as on the stream itself.
expect(result.stdout.grep('products/ok.yaml')).not.toContain('error'); // absence probe
expect(result.stdout.grep('products/broken.yaml')).toMatch('broken-block.txt'); // snapshot a block
```

## `text(value)` — any string as a stream subject

`text(value)` wraps an arbitrary string in the same `TextAccessor` streams surface, anchored on the calling test's directory via the same caller-detection the runners use. It promotes an ad-hoc string — most often a thrown **error message**, a checker line, or a report — into a first-class snapshot subject: ANSI is stripped before comparison (raw stays on `.text`), the [`{{token}}`](15-tokens.md) grammar applies to the fixture, and `.grep()` composes exactly as on a captured stream.

The product surface of a test framework **is** its error messages and reports; golden them in full instead of reconstructing them with a cluster of `toContain` probes.

| Matcher               | Sync/async | Resolves against  | Example                                            |
| --------------------- | ---------- | ----------------- | -------------------------------------------------- |
| `toMatch('x.txt')`    | sync       | `_expected/x.txt` | `expect(text(message)).toMatch('parse-error.txt')` |
| `toContain('needle')` | sync       | —                 | `expect(text(message)).toContain('did you mean')`  |

```typescript
import { text } from '@jterrazz/test';

// Capture a rejection message cleanly, then golden the whole thing.
async function catchMessage(assertion: () => unknown): Promise<string> {
    try {
        await assertion();
    } catch (error: any) {
        return error.message;
    }
    throw new Error('expected the assertion to throw, but it passed');
}

const message = await catchMessage(() => expect(result.response).toMatch('wrong-body.http'));
// Volatile fragments (paths, durations, ids) go through tokens: {{path}}, {{duration}}, {{uuid}}…
expect(text(message)).toMatch('errors/wrong-body-error.txt');
```

## `result.json` — parsed stdout (cli)

| Matcher             | Sync/async | Resolves against   | Example                                      |
| ------------------- | ---------- | ------------------ | -------------------------------------------- |
| `toMatch('x.json')` | sync       | `_expected/x.json` | `expect(result.json).toMatch('config.json')` |

Deep-equal against the JSON fixture; the fixture may embed tokens (`"id": "{{uuid}}"`). Failure prints a structural object diff (missing keys, extra keys, per-key value mismatches). For partial checks, read `.value` and use native `toMatchObject`.

## `result.file(path)` — single files in the cwd (cli)

A pure read accessor — no framework matcher; assert on its properties with native `expect`:

| Property   | Type      | Example                                                                         |
| ---------- | --------- | ------------------------------------------------------------------------------- |
| `.exists`  | `boolean` | `expect(result.file('my-shop/.env').exists).toBe(false)`                        |
| `.content` | `string`  | `expect(result.file('my-shop/shoply.yaml').content).toContain('name: my-shop')` |

## `result.directory(name)` — tree snapshots (cli)

| Matcher          | Sync/async | Resolves against               | Example                                                              |
| ---------------- | ---------- | ------------------------------ | -------------------------------------------------------------------- |
| `toMatch('dir')` | **async**  | `_expected/dir/` (a directory) | `await expect(result.directory('my-shop')).toMatch('shop-scaffold')` |

Compares the tree rooted at `<cwd>/name` against the fixture directory `_expected/shop-scaffold/` — structure _and_ file contents (contents honour tokens). Failure is a structured diff in three groups: `added` (on disk, not in fixture), `removed` (in fixture, not on disk), `changed` (content mismatch, with a per-file diff). No extension on the argument — tree snapshots are directories (rule C6).

## `result.filesystem` — the whole cwd (cli)

| Matcher / accessor | Sync/async | Resolves against | Example                                                            |
| ------------------ | ---------- | ---------------- | ------------------------------------------------------------------ |
| `toMatch('dir')`   | **async**  | `_expected/dir/` | `await expect(result.filesystem).toMatch('upgraded-shop')`         |
| `.files()`         | async read | —                | `expect(await result.filesystem.files()).toContain('shoply.lock')` |

Same semantics as `result.directory(…)`, rooted at the cwd itself. `.files()` returns the sorted recursive file list — a read, so follow it with native matchers.

## Container subjects (docker-aware cli)

Available when the runner declares `docker: { envVar, nameLabel, testRunLabel }`; results must be bound with `await using` (rule B5). `result.container(name)` looks a container up by its `nameLabel` value — lazily: no Docker call happens until you touch it. Absent containers return `exists: false` instead of throwing.

The runner handle itself also exposes a `docker(containerId)` reader (returned by `specification.api()` and `specification.cli()`, not `specification.jobs()`): given a raw container id, it lazily runs `docker inspect` and returns the **same** `ContainerAccessor` type — so it works with `await expect(spec.docker(id)).toBeRunning()` and every read accessor below. An unknown id yields an accessor with `exists: false` rather than throwing.

| Subject / matcher                                     | Sync/async | Example                                                                                           |
| ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `container.exists` (read)                             | sync       | `expect(result.container('nope').exists).toBe(false)`                                             |
| `expect(container).toBeRunning()`                     | **async**  | `await expect(shop).toBeRunning()`                                                                |
| `container.file(path).content` (read)                 | sync API   | `expect(shop.file('/app/shoply.yaml').content).toContain('name: alpha')`                          |
| `container.exec(cmd)` (read)                          | async read | `const inside = await shop.exec('ls /app')` then `expect(inside.stdout).toContain('shoply.yaml')` |
| `container.stdout` / `.stderr` (logs, stream subject) | sync       | `expect(shop.stdout).toContain('shop ready')`                                                     |

`container.exec()` resolves to a result whose `stdout`/`stderr` are ordinary stream subjects — the same matchers as host streams. `.not.toBeRunning()` asserts a stopped (but existing) container; for a _removed_ container assert `exists` instead.

**The sync container-read exception (as implemented):** container property reads — `exists`, `running`, `status`, `file(path).exists`, `file(path).content`, log streams — are synchronous, backed by one-shot `docker inspect` / `docker exec` shell-outs captured lazily on first access. This is the documented exception to the "await only IO matchers" rule (D2): only the _matchers_ (`toBeRunning`) are async; property reads stay sync so container assertions read exactly like host-side ones.

## `result.tree` — the accessibility outline (website, component)

The one golden a rendered surface wants. It is the outline a screen reader walks, it is the same dialect on a page and on a mounted unit, and it is deterministic where a screenshot is not — a font hint or a scrollbar moves a picture and moves nothing here.

```typescript
// A website page: the capture is already on the node side.
expect(result.tree).toMatch('home.aria.yaml');

// A component: the capture is read INSIDE the page, so the read is IO.
await expect(result.tree).toMatch('two-of-two-hundred.aria.yaml');
```

The `await` is the component's, not the tree's: a subject captured inside a page crosses the browser seam through a server command, and every accessor of a `component` result is awaited for that reason. It carries what the tree carries and nothing else — enablement (`[disabled]`), selection (`[selected]`), the roles and the accessible names. It does NOT carry focus, so a keyboard assertion is a verb, never a golden ([13 — Elements](13-elements.md#modifiers)).

## `result.html` — the markup (component)

The escape hatch for what the tree cannot say: a class name, a `data-` attribute, an element the accessibility tree flattens away.

```typescript
expect(result.html).toContain('row row--live');
```

Reach for it after the tree, not instead of it. A test that asserts only on markup is testing an implementation the user never meets, which is the failure the vocabulary exists to prevent.

## `result.value` / `result.error` — what a call returned (integration)

`.call()` resolves one way or the other, and both sides are subjects.

`result.value` is a **JSON accessor** when the call returned an object and a **text accessor** when it returned a string, so the same golden vocabulary reaches both:

```typescript
expect(result.value).toMatch('found.json');
expect(result.value.text).toContain('Alice');
```

`result.error` is what the call THREW, read as a subject of its own — a refusal is an answer, and it deserves a golden like any other:

```typescript
expect(result.error).toMatch('refused.txt');
await expect(result.error).toBeEmpty(); // nothing was thrown
```

A call that threw leaves `result.value` empty and vice versa; asserting on both in one test is asserting on a branch that cannot happen.

## Two helpers that are not matchers

`expect()` is the only way an assertion is made (rule D1), but two gestures around an assertion had been hand-written in every repository that needed them.

**`required(value, why)`** — the value, or a failure that says what was missing and why it mattered. A test reaching into a captured structure meets `T | undefined` and has to answer for it; `!` erases the question and a three-line `if (…) throw` is the same three lines everywhere.

```typescript
import { required } from '@jterrazz/test';

const body: { id?: number } = { id: 7 };
const id: number = required(body.id, 'the creation reply carries the new id');
```

`null` and `undefined` are the only values it refuses: `0`, `''` and `false` are present, and go through.

**`waitUntil(predicate, { timeout?, interval?, why? })`** — wait on a CONDITION, never on a duration. A spec that sleeps for a guessed number of milliseconds is slow on a fast machine and flaky on a slow one, which is why rule J2 refuses `setTimeout` under `specs/`. Every facet that drives something already waits on a condition; this is the primitive for the cases no facet owns — a background write to land, a queue to drain, a file to appear.

```typescript
import { waitUntil } from '@jterrazz/test';

const outbox: string[] = [];
await waitUntil(() => outbox.length === 1, { why: 'the job wrote its one message' });
```

The budget defaults to 5 000 ms and the poll to 50 ms; the failure names the condition and the budget, so a timeout reads as a sentence rather than as "expected true, got false". The budget is measured on `performance.now()`, never on `Date`, so `clock.at()` may freeze the calendar around a wait and the timeout still arrives with its own sentence. Not for a subject under `clock.run()` — there the scheduler belongs to the test and `clock.advance(ms)` is what makes time pass ([18 — Conventions § Time](18-conventions.md#time--one-primitive-two-depths)).

## Matcher summary

| Matcher       | Valid subjects                                                                                                                                      | Sync/async                                | Fixture root |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------ |
| `toMatch`     | `response`, `stdout`, `stderr`, `json`, `directory(…)`, `filesystem`                                                                                | sync, except directory/filesystem (async) | `_expected/` |
| `toMatchRows` | `table(…)`                                                                                                                                          | async                                     | — (inline)   |
| `toBeEmpty`   | `table(…)`, `error`, `console` and every text accessor                                                                                              | async (every subject)                     | —            |
| `toContain`   | `stdout`, `stderr` (host and container-exec streams), container logs                                                                                | sync                                      | —            |
| `toBeRunning` | `container(…)`                                                                                                                                      | async                                     | —            |
| native vitest | every scalar/read accessor (`status`, `exitCode`, `filesystem.cwd`, `.text`, `.value`, `.exists`, `.content`, `grep(…)`, `files()`, `containerIds`) | per vitest                                | —            |

`.not` is supported on every framework matcher.

## Update mode

`TEST_UPDATE=1` (or `vitest -u`) rewrites a mismatching `toMatch` fixture from the actual output instead of failing, preserving the tokens already in the file, and `{ frozen: true }` opts one fixture out — a fixture whose mismatch IS the behaviour under test. The engine, the flag, the discipline it asks for and the frozen two-pass are all [15 — Tokens](15-tokens.md#update-mode-tokens-are-preserved)'s; this chapter only notes which matcher the flag reaches, and that is `toMatch`, on every fixture subject.

## Common mistakes

- **Calling assertion methods on accessors** — `result.stdout.toContain('x')` does not compile; accessors are read-only (rule D1). Write `expect(result.stdout).toContain('x')`.
- **Missing `await` on IO matchers.** `expect(result.table('users')).toMatchRows(…)` without `await` never queries the database and the test passes vacuously (rule D2).
- **Putting `await` in front of a sync matcher.** A `toMatch` on a stream, a JSON body, a response or a call's value runs either way, and then the toolchain refuses the file: the matcher is typed as returning a value, so awaiting it is `typescript(await-thenable)` in every consumer. The sync/async split is the contract D2 states and the types carry.
- **`toMatch('help')` without extension.** The extension is part of the name (rule C6). The only extensionless arguments are tree-snapshot directory names.
- **Expecting a per-subject fixture root.** Every `toMatch` subject — response, stream, JSON, or tree — resolves against `_expected/`; only `.request()` reads from `_requests/` (rule D3).
- **Asserting raw ANSI.** Streams are stripped before comparison; if you truly need the raw bytes, that is what `.text` is for (rule D6).
- **`database:` on a single-database project** (or missing on a multi-database one) — rule A7 cuts both ways.
- **Using `.not.toMatch` as a lazy negative.** It passes for _any_ divergence, including ones you did not intend. Prefer a positive fixture or a targeted `toContain`.
- **A deliberately-wrong fixture without `{ frozen: true }`.** `TEST_UPDATE=1` overwrites it with the real output, destroying the negative case. Freeze any `toMatch` whose mismatch (or missing fixture) is the behaviour under test (rule `d13w-unfrozen-negative-fixture`).

## Related

[10 — API specs](10-api.md) · [12 — CLI specs](12-cli.md) · [15 — Tokens](15-tokens.md) · [18 — Conventions](18-conventions.md)
