# 14 — Assertions: the reference

Every assertion goes through `expect()` (rule `result-accessor-read-only`). The framework auto-registers its matchers into vitest and types them **by subject**: a table subject only offers table matchers, a stream subject only stream matchers — the wrong pairing is a compile error. Result accessors are read-only; there are no assertion methods on accessors (`result.stdout.toContain(…)` does not exist — the methods live on `expect()`).

This chapter is the exhaustive matrix: every matcher, for every valid subject, with its sync/async rule and the file it reads.

## The two global rules

### Sync vs async

`await expect(…)` is used **only** for matchers that perform IO, and this table is the whole list — the types say the same thing, so a mistaken `await` is a toolchain error (`typescript/await-thenable`) in a consumer and a missed one is an assertion that never runs:

| IO matcher subjects                                                    | Why                                  |
| ---------------------------------------------------------------------- | ------------------------------------ |
| `result.table(…)` — `toMatch(<rows>)` and `toBeEmpty()` on it          | Runs a SQL query                     |
| `toMatch(directory(…))` on `result.filesystem` / `result.directory(…)` | Walks the disk                       |
| container subjects                                                     | Talks to the Docker daemon           |
| every accessor of a COMPONENT result (`tree`, `html`, `content`, …)    | The capture crosses the browser seam |

A missed `await` has two judges. `toBeEmpty` and `toBeRunning` are typed `Promise<void>` whatever they are handed, so the type-aware `typescript/no-floating-promises` refuses one dropped; a `toMatch` is IO by its subject or its argument, so `io-matcher-awaited` reads the shape — a `.table(…)` read, rows written in place, `directory(…)` — and refuses it dropped.

Everything else is synchronous, and that includes the subjects it is easiest to get wrong: `result.value`, `result.error`, `result.response`, `result.stdout`, `result.stderr`, `result.json` — and `result.tree` on a WEBSITE page, which is captured on the node side and is a plain text subject there. Only a component's accessors are read inside the page.

### One verb compares a whole result, and its argument says where the expectation lives

`toMatch` on a result the framework produced — a response, a stream, a json, a table, a tree — compares the WHOLE result, and its argument is the expectation: a value written in place, the default, or `file()`/`directory()` when the expectation lives on disk (rule `one-verb-per-meaning`):

```typescript
expect(result.response).toMatch(`
    HTTP/1.1 201 Created
    content-type: application/json

    {"id": "{{uuid}}", "name": "Alice"}
`);
await expect(result.table('users')).toMatch([[1, 'Alice', 'alice@test.com']]);
expect(result.stdout).toMatch(file('./expected/help.txt'));
```

| Subject                                                   | The value written in place                                               | On disk             |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------- |
| `result.response`                                         | its `.http` text — status line, the headers it lists, the body           | `file('./….http')`  |
| a stream (`stdout`, `stderr`, `error`, `tree`, `text(…)`) | its text                                                                 | `file('./….txt')`   |
| a json (`json`, `value`, `head`, `screen`)                | its value — an object, a list, a scalar                                  | `file('./….json')`  |
| `result.table(…)`                                         | its rows — one array of cells per row, every column in the table's order | —                   |
| `result.directory(…)`, `result.filesystem`                | — a value states no tree                                                 | `directory('./…/')` |
| a container                                               | — asserted running, `toBeRunning()`; its logs are streams                | —                   |

A text written in place that opens on a line break is read without it, without the whitespace of its closing line, and without the indentation its lines share — a block indents with the test around it. The `{{token}}` grammar and `match.*` apply to a value in place exactly as to a file, and a mismatch prints the diff the same file would. A string handed a stream is a whole text, never vitest's substring: a RegExp matches a part, and on a result subject it does not compile — past the compiler it is refused, naming the form that takes it, `expect(result.stdout.text).toMatch(/built/)`. On a plain string — `result.stdout.text` is one — `toMatch`, `toBe` and `toContain` are vitest's, untouched.

The disk is named by one of two calls, `file()` and `directory()`, with the path relative to the spec file, spelled in full — and called in the test itself, never in a helper that would resolve it per caller (rule `paths-named-in-the-test`); the type refuses a bare string where a file is meant (rule `disk-named-by-relative-path`):

- `toMatch(file('./expected/help.txt'))` — a golden FILE, for a response, a stream, a JSON body, a call's value, an ARIA tree. The extension is part of the path and mandatory (rule `golden-path-has-extension`); a path may name a subfolder, `./expected/build/verbose.txt`, and update mode creates it (rule `golden-path-creates-folders`).
- `toMatch(directory('./expected/shop-scaffold/'))` — a golden TREE, for `result.directory(…)` or `result.filesystem`. The path ends in `/`.

Nothing resolves against a hidden folder: every golden is read where its path says, for every subject (rule `golden-read-from-its-path`). By convention it sits in `expected/` beside the spec — one of the four reserved ground folders ([18 — Conventions](18-conventions.md)).

`toContain` handed a stream accessor does not compile: a stream is no list, and vitest would search an empty one — its text is `result.stdout.text`, the comparable text (ANSI stripped, the runner's `transform` applied, the text its golden compares).

All file-based comparisons understand the [`{{token}}` grammar](15-tokens.md); all code-side dynamic values use `match.*`.

## Scalars — native `expect`

Plain values take vitest's native matchers. No framework matcher exists (or is needed) for them.

| Subject                                     | Type           | Example                                                                                                          |
| ------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------- |
| `result.status`                             | `number`       | `expect(result.status).toBe(201)`                                                                                |
| `result.exitCode`                           | `number`       | `expect(result.exitCode).toBe(0)`                                                                                |
| `result.filesystem.cwd`                     | `string`       | `expect(result.filesystem.cwd).toContain('/tmp/')`                                                               |
| `result.response.body`                      | parsed body    | `expect(result.response.body).toEqual({ error: 'User 999 not found' })`                                          |
| `result.json.value`                         | parsed JSON    | `expect(result.json.value).toMatchObject({ name: 'shoply' })`                                                    |
| `result.stdout.grep(pattern)`               | `TextAccessor` | `expect(result.stdout.grep('broken.yaml').text).toContain('missing price')`                                      |
| `result.file(path).exists`                  | `boolean`      | `expect(result.file('dist/index.js').exists).toBe(true)`                                                         |
| `result.file(path).content`                 | `string`       | `expect(result.file('shoply.yaml').content).toContain('name: my-shop')`                                          |
| `result.stdout.text`                        | `string`       | `expect(result.stdout.text).toBe('')` — ANSI stripped, `transform` applied                                       |
| `result.stdout.raw`                         | `string`       | `expect(result.stdout.raw).toMatch(/\u001B\[31m/u)` — the capture as it was                                      |
| `result.containerIds`                       | `string[]`     | `expect(result.containerIds).toHaveLength(1)`                                                                    |
| `await result.filesystem.files()`           | `string[]`     | `expect(await result.filesystem.files()).toContain('shoply.lock')`                                               |
| `await cli.run(file('./<case>.spec.yaml'))` | `CliResult`    | the document asserts itself; the LAST run's result comes back — [20](20-documents.md#the-three-doors-one-engine) |

## `result.response` — HTTP response (api)

| Matcher                     | Sync/async | Example                                                                 |
| --------------------------- | ---------- | ----------------------------------------------------------------------- |
| `toMatch(<.http text>)`     | sync       | ``expect(result.response).toMatch(`HTTP/1.1 201 Created …`)``           |
| `toMatch(file('./….http'))` | sync       | `expect(result.response).toMatch(file('./expected/user-created.http'))` |

Checks, in order: the status line, the listed headers (**subset** — unlisted response headers are unconstrained, rule `expected-headers-are-a-subset`), then the body. Placeholders apply in headers _and_ body, with `#ref` captures shared across both:

```http
HTTP/1.1 201 Created
Location: /orders/{{uuid#order}}

{ "id": "{{uuid#order}}" }
```

On mismatch the failure shows which part diverged. A status mismatch is a three-line message naming the fixture:

```
Response status mismatch (./expected/user-created.http)
  expected: 201
  received: 500
```

A header mismatch has the same shape (`Response header mismatch (name)`, with `header:` / `expected:` / `received:` lines; a missing header shows `received: (absent)`). A body mismatch prints a line-by-line structural diff (`Response mismatch (name)`, `- Expected` / `+ Received`) of the expected body — with matchers and tokens rendered as their placeholder text (`{{uuid#order}}`) — against the actual body: a JSON value as its pretty-printed lines, and a text body — when both sides are text — as its own lines, so an HTML page or an event stream reads as written. The diff is literal: it does not annotate captured ref values, and a failed `{{uuid#order}}` re-occurrence surfaces only as the two differing lines.

`.not`: `expect(result.response).not.toMatch(file('./expected/user-created.http'))` passes when any part diverges. Rarely useful — prefer positive fixtures.

## `result.table(name, { database }?)` — database tables (api, job, cli)

Always `await expect(…)` (IO). When to name the `database:` is [17 § The `database:` rule (`database-named-only-when-several`)](17-services.md#the-database-rule)'s.

| Matcher           | Sync/async | Example                                                                |
| ----------------- | ---------- | ---------------------------------------------------------------------- |
| `toMatch(<rows>)` | async      | see below                                                              |
| `toBeEmpty()`     | async      | `await expect(result.table('orders', { database: 'db' })).toBeEmpty()` |

The table is compared WHOLE: every row, and every column in the order the table declares it. A reset restarts the generated ids, so the first row a chain inserts is `1` ([17 — Services](17-services.md#per-worker-isolation)); an instant is compared as its ISO text.

A table has no order of its own, so its rows compare as a multiset: each row written in place is paired with a row of the table it matches, whatever order the database hands them back in — a first column of random ids orders them differently run to run. When the order IS the claim, `toMatch(rows, { ordered: true })` compares row by row in the order of the table's first column (the rows are read `ORDER BY 1`). A token that captures, `{{uuid#event}}`, binds on the pairing that holds, and update mode writes the rows in the order the value in place stated them, a new row after them.

```typescript
await expect(result.table('orders', { database: 'db' })).toMatch([
    [1, 'pending', 1250, '{{iso8601}}'],
]);
```

Cell values are literals, [tokens](15-tokens.md) or `match.*` matchers — including `match.ref(name)`, which captures a generated value in one table and requires it in another ([15 § `match.*`](15-tokens.md#match--the-same-vocabulary-in-code)).

`toBeEmpty` is a table's matcher, and async: the type-aware `typescript/no-floating-promises`, on in every profile of `@jterrazz/typescript`, refuses the bare `expect(x).toBeEmpty();` — dropped, it passes the test and surfaces the real failure as an unhandled rejection. A stream is not a table: an empty one is an empty text, `expect(result.stderr.text).toBe('')` — vitest's own, sync, on the text a golden compares. `toBeEmpty` handed a stream does not compile, and at run time it is refused with that form.

A failing table `toMatch` prints the expected grid against the actual rows, every column named, cell by cell: a row that matches prints once, unmarked, and each stated row that matches none is shown against the unpaired row of the table it resembles most (the most cells in common), a row too many or too few alone — matcher cells render as their placeholder text (`Matcher.toString()`): `match.uuid()` shows as `{{uuid}}`, `match.ref('order')` as `{{ref#order}}`, `match.ref('intent', { not: 'order' })` as `{{ref#intent!order}}`, `match.regex(/…/)` as `{{regex:…}}`. A failing `toBeEmpty` reports how many rows it found (the count, not the rows themselves). `.not` inverts both (`.not.toBeEmpty()` = at least one row).

## `result.stdout` / `result.stderr` — stream subjects (cli, container `exec`)

Streams are compared **after ANSI stripping** ([15 § Where tokens work](15-tokens.md#where-tokens-work)): `.text` is that comparable text, `.raw` the capture as it was.

| Matcher                    | Sync/async | Example                                                                |
| -------------------------- | ---------- | ---------------------------------------------------------------------- |
| `toMatch(<text>)`          | sync       | `expect(result.stdout).toMatch('built in {{duration}}\n')`             |
| `toMatch(file('./….txt'))` | sync       | `expect(result.stdout).toMatch(file('./expected/help.txt'))`           |
| `toContain('needle')`      | sync       | `expect(result.stderr.text).toContain("Unknown command 'frobnicate'")` |
| `toMatch(/pattern/)`       | sync       | `expect(result.stdout.text).toMatch(/built in \d+ms/u)`                |

`toMatch` on a stream is a full-text snapshot, its text written in place or in a file; the golden may contain any [token](15-tokens.md) (`{{semver}}`, `{{duration}}`, `{{workdir}}`, …). Token matching decides **pass or fail** only: `textEquals` resolves the placeholders to determine whether the output matches. The rendered failure, though, is a **literal** line-by-line diff (`Output mismatch (name)`, `- Expected` / `+ Received`) of the fixture text against the stripped output — tokens are not resolved in the diff, so a fixture line `Done in {{duration}}` is printed verbatim on the expected side whenever any line diverges, even if the duration itself matched.

> A stream compared whole takes its text — in place, or `file(…)`. A part of it is vitest's, on its text: `expect(result.stdout.text).toMatch(/built/)`, `.toContain('built')`.

`toContain` is vitest's, so its failure is vitest's, printing the needle and the comparable haystack. `.not.toContain(…)` asserts absence.

```typescript
// .grep() returns a TextAccessor — chainable and snapshot-able, so the same
// Token grammar applies as on the stream itself.
expect(result.stdout.grep('products/ok.yaml').text).not.toContain('error'); // absence probe
expect(result.stdout.grep('products/broken.yaml')).toMatch(file('./expected/broken-block.txt')); // snapshot a block
```

## `text(value)` — any string as a stream subject

`text(value)` wraps an arbitrary string in the same `TextAccessor` streams surface, anchored on the calling test's directory via the same caller-detection the runners use — the directory its golden's path is read from. It promotes an ad-hoc string — most often a thrown **error message**, a checker line, or a report — into a first-class snapshot subject: ANSI is stripped before comparison (`.text` is the stripped text, `.raw` the string as given), the [`{{token}}`](15-tokens.md) grammar applies to the fixture, and `.grep()` composes exactly as on a captured stream.

The product surface of a test framework **is** its error messages and reports; golden them in full instead of reconstructing them with a cluster of `toContain` probes.

| Matcher                    | Sync/async | Example                                                             |
| -------------------------- | ---------- | ------------------------------------------------------------------- |
| `toMatch(file('./….txt'))` | sync       | `expect(text(message)).toMatch(file('./expected/parse-error.txt'))` |
| `toContain('needle')`      | sync       | `expect(text(message).text).toContain('did you mean')`              |

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

const message = await catchMessage(() =>
    expect(result.response).toMatch(file('./expected/wrong-body.http')),
);
// Volatile fragments (paths, durations, ids) go through tokens: {{path}}, {{duration}}, {{uuid}}…
expect(text(message)).toMatch(file('./expected/errors/wrong-body-error.txt'));
```

## `result.json` — parsed stdout (cli)

| Matcher                     | Sync/async | Example                                                           |
| --------------------------- | ---------- | ----------------------------------------------------------------- |
| `toMatch(<value>)`          | sync       | `expect(result.json).toMatch({ name: 'shoply', id: '{{uuid}}' })` |
| `toMatch(file('./….json'))` | sync       | `expect(result.json).toMatch(file('./expected/config.json'))`     |

Deep-equal against the value in place or the JSON golden — every key, both ways; the fixture may embed tokens (`"id": "{{uuid}}"`). Failure prints a structural object diff (missing keys, extra keys, per-key value mismatches). For partial checks, read `.value` and use native `toMatchObject`.

## `result.file(path)` — single files in the cwd (cli)

A pure read accessor — no framework matcher; assert on its properties with native `expect`:

| Property   | Type      | Example                                                                         |
| ---------- | --------- | ------------------------------------------------------------------------------- |
| `.exists`  | `boolean` | `expect(result.file('my-shop/.env').exists).toBe(false)`                        |
| `.content` | `string`  | `expect(result.file('my-shop/shoply.yaml').content).toContain('name: my-shop')` |

## `result.directory(name)` — tree snapshots (cli)

| Matcher                      | Sync/async | Example                                                                                     |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `toMatch(directory('./…/'))` | **async**  | `await expect(result.directory('my-shop')).toMatch(directory('./expected/shop-scaffold/'))` |

Compares the tree rooted at `<cwd>/name` against the golden directory `./expected/shop-scaffold/` — structure _and_ file contents (contents honour tokens). Failure is a structured diff in three groups: `added` (on disk, not in the golden), `removed` (in the golden, not on disk), `changed` (content mismatch, with a per-file diff). The path ends in `/` — the type and the matcher both refuse one that does not.

## `result.filesystem` — the whole cwd (cli)

| Matcher / accessor           | Sync/async | Example                                                                           |
| ---------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `toMatch(directory('./…/'))` | **async**  | `await expect(result.filesystem).toMatch(directory('./expected/upgraded-shop/'))` |
| `.files()`                   | async read | `expect(await result.filesystem.files()).toContain('shoply.lock')`                |

Same semantics as `result.directory(…)`, rooted at the cwd itself. `.files()` returns the sorted recursive file list — a read, so follow it with native matchers.

## Container subjects (docker-aware cli)

Available when the runner declares `docker: { envVar, nameLabel, testRunLabel }`; results must be bound with `await using` (rule `docker-exec-bound-with-await-using`). `result.container(name)` looks a container up by its `nameLabel` value — lazily: no Docker call happens until you touch it. Absent containers return `exists: false` instead of throwing.

The runner handle itself also exposes a `docker(containerId)` reader (returned by `specification.api()` and `specification.cli()`, not `specification.job()`): given a raw container id, it lazily runs `docker inspect` and returns the **same** `ContainerAccessor` type — so it works with `await expect(spec.docker(id)).toBeRunning()` and every read accessor below. An unknown id yields an accessor with `exists: false` rather than throwing.

| Subject / matcher                                     | Sync/async | Example                                                                                                |
| ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `container.exists` (read)                             | sync       | `expect(result.container('nope').exists).toBe(false)`                                                  |
| `expect(container).toBeRunning()`                     | **async**  | `await expect(shop).toBeRunning()`                                                                     |
| `container.file(path).content` (read)                 | sync API   | `expect(shop.file('/app/shoply.yaml').content).toContain('name: alpha')`                               |
| `container.exec(cmd)` (read)                          | async read | `const inside = await shop.exec('ls /app')` then `expect(inside.stdout.text).toContain('shoply.yaml')` |
| `container.stdout` / `.stderr` (logs, stream subject) | sync       | `expect(shop.stdout.text).toContain('shop ready')`                                                     |

`container.exec()` resolves to a result whose `stdout`/`stderr` are ordinary stream subjects — the same matchers as host streams. `.not.toBeRunning()` asserts a stopped (but existing) container; for a _removed_ container assert `exists` instead.

**The sync container-read exception (as implemented):** container property reads — `exists`, `running`, `status`, `file(path).exists`, `file(path).content`, log streams — are synchronous, backed by one-shot `docker inspect` / `docker exec` shell-outs captured lazily on first access. This is the documented exception to the "await only IO matchers" rule (`io-matcher-awaited`): only the _matchers_ (`toBeRunning`) are async; property reads stay sync so container assertions read exactly like host-side ones.

## `result.tree` — the accessibility outline (website, component)

The one golden a rendered surface wants. It is the outline a screen reader walks, it is the same dialect on a page and on a mounted unit, and it is deterministic where a screenshot is not — a font hint or a scrollbar moves a picture and moves nothing here.

```typescript
// A website page: the capture is already on the node side.
expect(result.tree).toMatch(file('./expected/home.aria.yaml'));

// A component: the capture is read INSIDE the page, so the read is IO.
await expect(result.tree).toMatch(file('./expected/two-of-two-hundred.aria.yaml'));
```

The `await` is the component's, not the tree's: a subject captured inside a page crosses the browser seam through a server command, and every accessor of a `component` result is awaited for that reason. It carries what the tree carries and nothing else — enablement (`[disabled]`), selection (`[selected]`), the roles and the accessible names. It does NOT carry focus, so a keyboard assertion is a verb, never a golden ([13 — Elements](13-elements.md#modifiers)).

## `result.html` — the markup (component)

The escape hatch for what the tree cannot say: a class name, a `data-` attribute, an element the accessibility tree flattens away.

```typescript
expect(result.html.text).toContain('row row--live');
```

Reach for it after the tree, not instead of it. A test that asserts only on markup is testing an implementation the user never meets, which is the failure the vocabulary exists to prevent.

## `result.value` / `result.error` — what a call returned (integration)

`.call()` resolves one way or the other, and both sides are subjects.

`result.value` is a **JSON accessor** when the call returned an object and a **text accessor** when it returned a string, so the same golden vocabulary reaches both:

```typescript
expect(result.value).toMatch(file('./expected/found.json'));
expect(result.value.text).toContain('Alice');
```

`result.error` is what the call THREW, read as a subject of its own — a refusal is an answer, and it deserves a golden like any other:

```typescript
expect(result.error).toMatch(file('./expected/refused.txt'));
expect(result.error.text).toBe(''); // nothing was thrown
```

A call that threw leaves `result.value` empty and vice versa; asserting on both in one test is asserting on a branch that cannot happen.

## Two helpers that are not matchers

`expect()` is the only way an assertion is made (rule `result-accessor-read-only`), but two gestures around an assertion had been hand-written in every repository that needed them.

**`required(value, why)`** — the value, or a failure that says what was missing and why it mattered. A test reaching into a captured structure meets `T | undefined` and has to answer for it; `!` erases the question and a three-line `if (…) throw` is the same three lines everywhere.

```typescript
import { required } from '@jterrazz/test';

const body: { id?: number } = { id: 7 };
const id: number = required(body.id, 'the creation reply carries the new id');
```

`null` and `undefined` are the only values it refuses: `0`, `''` and `false` are present, and go through.

**`waitUntil(predicate, { timeout?, interval?, why? })`** — wait on a CONDITION, never on a duration. A spec that sleeps for a guessed number of milliseconds is slow on a fast machine and flaky on a slow one, which is why rule `no-sleep` refuses a sleep in any test file. Every facet that drives something already waits on a condition; this is the primitive for the cases no facet owns — a background write to land, a queue to drain, a file to appear.

```typescript
import { waitUntil } from '@jterrazz/test';

const outbox: string[] = [];
await waitUntil(() => outbox.length === 1, { why: 'the job wrote its one message' });
```

The budget defaults to 5 000 ms and the poll to 50 ms; the failure names the condition and the budget, so a timeout reads as a sentence rather than as "expected true, got false". The budget is measured on `performance.now()`, never on `Date`, so `clock.at()` may freeze the calendar around a wait and the timeout still arrives with its own sentence. Not for a subject under `clock.run()` — there the scheduler belongs to the test and `clock.advance(ms)` is what makes time pass ([18 — Conventions § Time](18-conventions.md#time--one-primitive-two-depths)).

## Matcher summary

| Matcher                 | Valid subjects                                                                                                                                                                                        | Sync/async                                     | Reads                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------- |
| `toMatch(<value>)`      | `response` (its `.http` text), `stdout`, `stderr`, `error`, `tree`, `text(…)` (a text), `json`, `value` (a value), `table(…)` (rows)                                                                  | sync, except a table and inside a page (async) | the test itself      |
| `toMatch(file(…))`      | `response`, `stdout`, `stderr`, `json`, `value`, `error`, `tree`, `text(…)`                                                                                                                           | sync, except inside a page (async)             | the path it is given |
| `toMatch(directory(…))` | `directory(…)`, `filesystem`                                                                                                                                                                          | async                                          | the path it is given |
| `toBeEmpty`             | `table(…)` — an empty stream is `expect(<stream>.text).toBe('')`                                                                                                                                      | async                                          | —                    |
| `toBeRunning`           | `container(…)`                                                                                                                                                                                        | async                                          | —                    |
| native vitest           | every scalar/read accessor (`status`, `exitCode`, `filesystem.cwd`, `.text`, `.raw`, `.value`, `.exists`, `.content`, `grep(…)`, `files()`, `containerIds`) — and `toMatch` with a value, on a string | per vitest                                     | —                    |

`.not` is supported on every framework matcher.

## Update mode

`TEST_UPDATE=1` (or `vitest -u`) rewrites a mismatching golden from the actual output instead of failing, preserving the tokens already in the file, and `{ frozen: true }` opts one fixture out — a fixture whose mismatch IS the behaviour under test. The engine, the flag, the discipline it asks for and the frozen two-pass are all [15 — Tokens](15-tokens.md#update-mode-tokens-are-preserved)'s; this chapter only notes which matchers the flag reaches, and it is `toMatch` on every result subject — a value written in place is rewritten in the test itself, a `file()` or a `directory()` on disk.

## Common mistakes

- **Calling assertion methods on accessors** — `result.stdout.toContain('x')` does not compile; accessors are read-only (rule `result-accessor-read-only`). Write `expect(result.stdout.text).toContain('x')`.
- **Missing `await` on IO matchers.** `expect(result.table('users')).toMatch([…])` without `await` never queries the database and the test passes vacuously (rule `io-matcher-awaited`).
- **Putting `await` in front of a sync matcher.** A `toMatch(file(…))` on a stream, a JSON body, a response or a call's value runs either way, and then the toolchain refuses the file: the matcher is typed as returning a value, so awaiting it is the toolchain error [above](#sync-vs-async). The sync/async split is the contract `io-matcher-awaited` states and the types carry.
- **`file('./expected/help')` without extension.** The extension is part of the path (rule `golden-path-has-extension`); a tree is `directory('./expected/help/')`.
- **A golden written as a value on `.text`.** `expect(result.stdout.text).toMatch('help.txt')` is vitest's substring check, which passes when the output contains the words "help.txt". The whole stream is `expect(result.stdout).toMatch(…)`, its text in place or `file('./expected/help.txt')` (rule `one-verb-per-meaning`).
- **A bare name.** `file('help.txt')` does not compile, and forced through it is refused: every file is named by its path from the spec (rules `disk-named-by-relative-path`, `disk-named-by-relative-path-at-runtime`).
- **Asserting raw ANSI.** Streams are stripped before comparison; if you truly need the raw bytes, that is what `.raw` is for ([15 § Where tokens work](15-tokens.md#where-tokens-work)) — and a substring check on it warns (`no-raw-bypass`).
- **`database:` on a single-database project** (or missing on a multi-database one) — [17 § The `database:` rule (`database-named-only-when-several`)](17-services.md#the-database-rule).
- **Using `.not.toMatch(file(…))` as a lazy negative.** It passes for _any_ divergence, including ones you did not intend. Prefer a positive fixture or a targeted `toContain`.
- **A deliberately-wrong fixture without `{ frozen: true }`.** `TEST_UPDATE=1` overwrites it — [15 § Frozen fixtures](15-tokens.md#frozen-fixtures--opting-a-negative-fixture-out-of-the-rewrite).

## Related

[10 — API specs](10-api.md) · [12 — CLI specs](12-cli.md) · [15 — Tokens](15-tokens.md) · [18 — Conventions](18-conventions.md)
