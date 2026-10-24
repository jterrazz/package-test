# Tokens: dynamic values in fixtures

Real systems generate UUIDs, timestamps, ports, and paths. The framework handles them with **one unified token grammar** (rule `no-unknown-token`): the same `{{token}}` vocabulary works in every fixture file, and the same vocabulary is available in code as `match.*`. The vocabulary is fixed (21 tokens, defined, tested, and documented in the package), and an unknown token in a fixture is an error, not a silent literal.

## Where tokens work

| Fixture kind   | Files                                                                               | Coverage                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP responses | `__expected__/*.http`                                                               | **body and headers**                                                                                                                                                                                                          |
| JSON snapshots | `__expected__/*.json`                                                               | any string value                                                                                                                                                                                                              |
| Text snapshots | `__expected__/*.txt` (and other text files under `__expected__/`)                   | anywhere in the text                                                                                                                                                                                                          |
| Spec documents | `<case>.spec.yaml`, beside the spec ([Spec documents](../guides/spec-documents.md)) | what a document asserts (a run's streams and `files:` texts, a response's status, headers and body, a table's cells, a job's `error:`), **never the description, a command, a request or a body**, which are prose and inputs |

```http
### __expected__/order-created.http: tokens in a header AND the body
HTTP/1.1 201 Created
Location: /orders/{{uuid#order}}

{ "id": "{{uuid#order}}", "total": "{{number}}", "createdAt": "{{iso8601}}" }
```

```text
### __expected__/help.txt: tokens in a TEXT snapshot
shoply v{{semver}}
Started at {{iso8601}} in {{workdir}}
Done in {{duration}}
```

A token in a JSON body is written inside quotes (`"total": "{{number}}"`) because the file must stay JSON, and a quoted numeric token still matches a native JSON number as a whole value: `{{number}}`, `{{int}}`, `{{float}}` and `{{port}}` accept `42` as readily as `"42"`. `{{any}}` matches any type at all.

Stream comparisons strip ANSI escape sequences **before** token matching, so fixtures never contain color codes: `.text` is the stripped text, `.raw` the capture as it was.

## The vocabulary: all 21 tokens

Every token matches one value of its family at its position. The normative definitions (the exact accepted grammar for each) are shipped and tested inside the package; the table below states each token's semantics and canonical accepted forms.

### Identifiers

| Token      | Matches                                        | Example value                          |
| ---------- | ---------------------------------------------- | -------------------------------------- |
| `{{uuid}}` | RFC 4122 UUID, `8-4-4-4-12` hexadecimal groups | `3f2c9b6e-8a41-4c8f-9d2a-1b7e5f0c4d3e` |
| `{{ulid}}` | ULID, 26 Crockford base32 characters           | `01J2X3YV5T8Q4R9K7M6N1P0ZSD`           |

### Time

| Token          | Matches                                                       | Example value                |
| -------------- | ------------------------------------------------------------- | ---------------------------- |
| `{{iso8601}}`  | Full ISO 8601 timestamp (date + time, `Z` or offset)          | `2026-07-16T10:32:05.123Z`   |
| `{{date}}`     | Calendar date, `YYYY-MM-DD`                                   | `2026-07-16`                 |
| `{{time}}`     | Wall-clock time, `HH:MM[:SS]` (seconds and fraction optional) | `10:32:05`                   |
| `{{duration}}` | Elapsed-time string as printed by tooling                     | `340ms`, `1.24s`, `2m`, `3h` |

### Numbers

| Token        | Matches                                | Example value |
| ------------ | -------------------------------------- | ------------- |
| `{{number}}` | Any numeric value (integer or decimal) | `109`, `4.5`  |
| `{{int}}`    | Integer only                           | `42`          |
| `{{float}}`  | Decimal with a fractional part         | `0.97`        |

### Versions & hashes

| Token        | Matches                                                            | Example value         |
| ------------ | ------------------------------------------------------------------ | --------------------- |
| `{{semver}}` | Semantic version (`major.minor.patch`, optional pre-release/build) | `9.0.0`, `9.1.0-rc.1` |
| `{{sha}}`    | Commit/content hash digest (hexadecimal, git-style)                | `f690adf...`          |
| `{{hex}}`    | Hexadecimal string                                                 | `deadbeef`            |
| `{{base64}}` | Base64 string (padding included)                                   | `aGVsbG8=`            |

### Network

| Token       | Matches                          | Example value                         |
| ----------- | -------------------------------- | ------------------------------------- |
| `{{port}}`  | TCP/UDP port number (0 to 65535) | `54321`                               |
| `{{ip}}`    | IP address                       | `127.0.0.1`                           |
| `{{url}}`   | Absolute URL with scheme         | `https://rates.example.com/v1/latest` |
| `{{email}}` | Email address                    | `contact@jterrazz.com`                |

### Paths

| Token         | Matches                                                                                                                               | Example value                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `{{path}}`    | Filesystem path                                                                                                                       | `/tmp/x/dist/index.js`                                         |
| `{{workdir}}` | **The exact cwd of the current spec**: the framework knows the temp directory it created, so this is an equality check, not a pattern | `/tmp/jterrazz-test-runs-501/48213-Xk2pQa/spec-command-a1B2c3` |

`{{workdir}}` holds the **resolved** cwd, the spelling a child process reports, after any symlink on the way (macOS's `$TMPDIR` sits under `/var`, a link to `/private/var`). The `$WORKDIR` token that `.env()` and a document's `env:` expand is that same resolved path, so a directory the runner hands to the binary comes back in its output matching the token: `.env({ CACHE_DIR: '$WORKDIR/cache' })` is asserted as `{{workdir}}/cache`.

### Generic

| Token        | Matches                                                                                                                                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{{string}}` | Any string value                                                                                                                                                                                                                                                 |
| `{{any}}`    | Anything: always-true **as a whole value** (matches any type: object, number, `null`). Embedded in a frame (`A {{any}} Z`) it only widens the middle; the surrounding literal still has to match, and text on both sides of it on its line holds it to that line |

## `#ref` captures

Any token becomes a capture by suffixing `#name`: `{{uuid#order}}`. The **first occurrence captures** the actual value; every subsequent occurrence of the same ref **must be equal**. Refs are scoped to the current spec: one namespace shared by all fixture files and code-side `match.ref()` within that spec, resetting between specs.

```http
### __expected__/order-created.http: {{uuid#order}} appears 3 times, all must be equal
HTTP/1.1 201 Created
Location: /orders/{{uuid#order}}

{
    "id": "{{uuid#order}}",
    "paymentIntent": { "orderId": "{{uuid#order}}" }
}
```

A ref that re-occurs with a different value fails with both values in the message: the captured one and the conflicting one.

## `match.*`: the same vocabulary in code

Every token has a code mirror for inline assertions (table rows, primarily):

```typescript
import { match } from '@jterrazz/test';

await expect(result.table('orders', { database: 'db' })).toMatch([
    [match.uuid(), 'pending', match.number(), match.iso8601()],
]);
```

`match.uuid()`, `match.ulid()`, `match.iso8601()`, `match.date()`, `match.time()`, `match.duration()`, `match.number()`, `match.int()`, `match.float()`, `match.semver()`, `match.sha()`, `match.hex()`, `match.base64()`, `match.port()`, `match.ip()`, `match.url()`, `match.email()`, `match.path()`, `match.workdir()`, `match.string()`, `match.any()`, plus four code-only forms:

| Code-only                         | Meaning                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `match.regex(/.../)`              | Arbitrary pattern, the escape hatch when no token fits                                      |
| `match.ref(name)`                 | Capture on first use, require equality afterwards (same namespace as `{{token#name}}` refs) |
| `match.ref(name, { not: other })` | Additionally require **inequality** with another captured ref                               |
| `match.includes(substring)`       | Containment: the value holds the substring; used mostly in a stub's request filter          |

```typescript
// intent.order_id === orders.id, but intent.id ≠ orders.id
await expect(result.table('orders', { database: 'db' })).toMatch([[match.ref('order'), 'pending']]);
await expect(result.table('payment_intents', { database: 'db' })).toMatch([
    [match.ref('intent', { not: 'order' }), match.ref('order')],
]);
```

## Update mode: tokens are preserved

`TEST_UPDATE=1` (or `vitest -u`) rewrites fixtures from actual output, but it writes **tokens, not values** (rule `no-volatile-literal`):

- Segments already covered by a placeholder are **preserved**: a fixture line `Done in {{duration}}` stays `Done in {{duration}}` after an update, no matter what duration the run printed.
- Values the framework knows to be dynamic are substituted automatically: the spec's cwd becomes `{{workdir}}` in the written fixture without you doing anything.
- A golden that does not exist yet, or holds nothing but whitespace, is **recorded** from the output: a `.http`, a `.json` and a text golden alike, and a document's `response:` file too: a run that records stands without the goldens it is about to write. A golden is started by naming it, never by stubbing it.
- A recorded response golden states the status, the `content-type` and the body; a deployed api's (`specification.api({ url })`) states the headers its specification records (`recordedHeaders`), keeps stating no body where it stated none, and an exchange that never answered is written as its one line, `unreachable: <reason>` ([API specs § Deployed target (`url`)](../guides/api-specs.md#deployed-target-url)).

Example, starting from actual output:

```text
shoply v9.1.0
Started at 2026-07-17T09:12:44.031Z in /tmp/jterrazz-test-runs-501/48213-Xk2pQa/spec-command-x9Y8z7
Done in 0.83s
```

with an existing fixture:

```text
shoply v{{semver}}
Started at {{iso8601}} in {{workdir}}
Done in {{duration}}
```

`TEST_UPDATE=1` leaves the fixture byte-identical: every changed segment was already covered by a token. If the CLI adds a new line `Cache dir: /tmp/shoply-spec-x9y8z7/.cache`, the update writes `Cache dir: {{workdir}}/.cache` (`{{workdir}}` is substituted automatically); a timestamp in a _new_ line would be written literally, for you to tokenize by hand (or it will fail on the next run, which is the signal).

The same preservation and `{{workdir}}` substitution apply identically across every fixture kind: a value written in place (below), text snapshots (`__expected__/*.txt`), JSON goldens (`__expected__/*.json`), `.http` response bodies (`__expected__/*.http`), and the streams of a `<case>.spec.yaml` (whose ground, commands and `files:` an update never rewrites). A cwd embedded in a JSON string value is written back as `{{workdir}}` exactly as it is in a text line, so an updated JSON golden matches the next run's (different) cwd instead of pinning a run-specific temp path.

### A value written in place is rewritten in the test

A `toMatch(<value>)` is rewritten where it stands, in the test file, the gesture vitest's `toMatchInlineSnapshot` makes: the call is found from the stack of the assertion, and its argument (up to its comma or its closing parenthesis, whatever template, string or nested call it holds) is replaced by the actual result, merged with the tokens the old value had where the result still matches them. A text is written as a template literal indented one level deeper than its call, a json as its JSON, a table one row per line. An empty value, `toMatch('')`, is the one an author leaves to be recorded: outside update mode it fails naming the run that fills it. A value that matches is never touched, and neither is a `{ frozen: true }` one or a `.not`: a negation asserts a mismatch, and records nothing. Every rewrite of one file during a run is laid on the source the run loaded, so a second rewrite lands where its stack says even when a first one moved the lines below it. Under the preset the test file is written when the run ENDS, after its report: vitest frames a failure by reading the file on disk at the line the run loaded, so a file rewritten mid-run would frame a later failure at another test's code. The preset's global setup hands each project a pending folder under `.artifacts/vitest/in-place/` and writes what waits there once the report is printed (in watch mode, when the watcher exits); a run outside the preset writes each file at once. A component's value is rewritten the same way through a server command, the page's stack mapped back to the test's source by the browser server. What update mode writes comes out in the repository's style: an integer of five digits or more is grouped by threes (`1_775_034_000_000`, as the linter's numeric separators ask), and when the run ends each rewritten test file is laid out by the oxfmt the project installs, with the project's own config: its quotes, its keys, its trailing commas. Outside the preset, or where no oxfmt is installed, the file stays as written, and `npx typescript fix` formats it.

This is why `transform` on `specification.cli` is only an escape hatch (rule `no-transform-duplicating-tokens`): the token grammar plus ANSI stripping covers the standard sources of nondeterminism, and a transform that merely re-implements standard tokens is refused by `no-transform-duplicating-tokens` ([no-transform-duplicating-tokens](linting.md#no-transform-duplicating-tokens)).

### Frozen fixtures: opting a negative fixture out of the rewrite

Update mode rewrites a mismatching fixture with the actual output. That is exactly wrong for a **deliberately-wrong fixture**, one whose _mismatch_ is the behaviour under test (a spec that asserts the diff, or that a missing fixture errors). Under `TEST_UPDATE=1` an unfrozen negative fixture is silently overwritten with the real output, and the assertion stops testing anything.

Pass `{ frozen: true }` as the second argument to opt a single fixture out:

```typescript
// A deliberately-wrong fixture: its diff rendering is the subject.
expect(() =>
    expect(result.response).toMatch(file('./__expected__/wrong-body.http'), { frozen: true }),
).toThrow(/Response mismatch/);
```

A frozen fixture is **never written** in update mode: a frozen mismatch still throws its diff, and a frozen _missing_ fixture still throws "does not exist" (never created). Its failure says so rather than pointing at update mode: write the file by hand, or drop `{ frozen }` for one `TEST_UPDATE=1` run and put it back. It is available on every golden subject (`result.response`, `result.stdout`/`result.stderr`, `result.json`, `result.directory`, `result.filesystem`). The static rule `negative-golden-frozen` flags a golden `toMatch(file(...))`/`toMatch(directory(...))` wrapped in `expect(() => ...).toThrow()` / `.rejects` that omits it.

### The discipline: update mode writes, it does not judge

A rewritten fixture is not a passing test: it is this run's output, made into the expectation. Three steps, in this order, and the middle one is the whole point.

1. **Run it.** `TEST_UPDATE=1 npx vitest --run --project <kind>`, narrowed to the project whose goldens moved, never the whole suite, because a broad update rewrites files nobody looked at.
2. **Read the diff.** `git diff` is the review: every line that changed is a behaviour that changed. A golden diff that nobody can explain is a bug that just became the expectation, and this is the only moment it is cheap to catch.
3. **Run again, without the flag.** The second run is the one that proves anything. It reads the file as any other run would, and it is what a reviewer's machine will do.

The round-trip is not a step the suite performs for you, and deliberately so: update mode writes the file from THIS run's actual value, so re-comparing inside the same run matches by construction and proves nothing. The real round-trip already exists: CI runs the same goldens on another machine, which is exactly the question "does this file still hold when the run is not the one that wrote it?"

**The frozen two-pass.** A frozen fixture is never written, so changing one on purpose is two deliberate passes: drop `{ frozen: true }`, run once under `TEST_UPDATE=1`, read the diff, and put the option back in the same commit. The friction is the feature: a negative fixture should cost something to change.

**What update mode never touches.** The ground of a `<case>.spec.yaml` (its `description:`, its commands, its `env:`/`serve:`/`fixture:` and its `files:`) is authored, never rewritten; only the expected streams move. Its `files:` are still judged under update, so a document that passes a recorded run is one a normal run passes.

**What update mode refuses to record.** An expectation that cannot fail is no expectation. Update mode writes nothing over a result whose call threw: the value of a `.call()` that failed is `null`, and a recorded `toMatch(null)` stays green while every call fails: assert the error, or fix the call. It rewrites a literal only: a `toMatch(` handed a name or a call stands for values the rewrite would replace by the last one it saw (a table's rows are recorded by hand, one by one). And `toMatch('')` on a string (a stream's `.text`, a file's `.content`) is vitest's substring match, true of any text; the rule `no-empty-substring-match` refuses it. A `__requests__/*.http` is an input, not an expectation, and is never written either.

## Known limitations

The grammar is deliberately small; three edges are worth knowing:

- **No escaping for literal `{{...}}` text.** There is no escape sequence. A `{{uuid}}` written in a fixture is _always_ interpreted as the token; you cannot assert a literal, un-substituted `{{uuid}}` string in expected output. (An unknown name like `{{widget}}` is caught by the conventions checker (rule `no-unknown-token`) as an error: the vocabulary is frozen, so an unknown token is never a usable literal escape.) For genuinely custom shapes, use `match.regex()` in code.
- **Update-merge pairs one previous line with one actual line.** Placeholder preservation is by **pattern**: the aligned line is tried first, then what is left over is re-paired by matching each remaining placeholder line against each unresolved actual line, in file order. A mid-file insertion is therefore safe: the shifted `{{duration}}` line is recognised where it landed. What stays out of reach: a previous line is spent **once**, so when the output grows a SECOND line the same placeholder could cover, the first keeps the token and the new one is written as a raw value, for you to tokenize.
- **`{{float}}` cannot require a decimal on a JSON number.** In JSON there is no distinction between `42` and `42.0`, so as a whole JSON value `{{float}}` accepts any finite number (an integer passes). The decimal requirement only holds in **text** contexts (`4.2` matches, `42` does not). This is a JSON limitation, not a token choice.

## Appendix: canonical accepted forms (normative, as implemented)

The exact grammar of each token, one tested regular expression per token
(defined in [`src/expectations/tokens/structural.ts`](https://github.com/jterrazz/package-test/blob/main/src/expectations/tokens/structural.ts), the vocabulary list in `match.ts` beside it). In embedded positions the pattern is
anchored to its surroundings; as a whole JSON value, numeric tokens also
accept native JSON numbers.

| Token          | Accepted form (regex)                                                                                                                                                                                      | Notes                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `{{uuid}}`     | `[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`                                                                                                                              | any RFC 4122 variant                                                                        |
| `{{ulid}}`     | `[0-9A-HJKMNP-TV-Z]{26}`                                                                                                                                                                                   | Crockford base32, uppercase                                                                 |
| `{{iso8601}}`  | `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z\|[+-]\d{2}:\d{2})`                                                                                                                                          | date + time, `Z` or offset required                                                         |
| `{{date}}`     | `\d{4}-\d{2}-\d{2}`                                                                                                                                                                                        |                                                                                             |
| `{{time}}`     | `\d{2}:\d{2}(:\d{2}(\.\d+)?)?`                                                                                                                                                                             | seconds and fraction optional                                                               |
| `{{duration}}` | `\d+(\.\d+)?(ms\|s\|m\|h)`                                                                                                                                                                                 | strict: `ms`, `s`, `m`, `h` suffixes only                                                   |
| `{{number}}`   | `-?\d+(\.\d+)?([eE][+-]?\d+)?`                                                                                                                                                                             | JSON numbers also accepted as whole values                                                  |
| `{{int}}`      | `-?\d+`                                                                                                                                                                                                    | whole JSON value: `Number.isInteger`                                                        |
| `{{float}}`    | `-?\d+\.\d+`                                                                                                                                                                                               | whole JSON value: any finite number                                                         |
| `{{semver}}`   | `\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?`                                                                                                                                                       |                                                                                             |
| `{{sha}}`      | `[0-9a-f]{7,64}`                                                                                                                                                                                           | 7 to 64 lowercase hex chars (short SHA up to SHA-512)                                       |
| `{{hex}}`      | `[0-9a-fA-F]+`                                                                                                                                                                                             |                                                                                             |
| `{{base64}}`   | `[A-Za-z0-9+/]+={0,2}`                                                                                                                                                                                     |                                                                                             |
| `{{port}}`     | `\d{1,5}`                                                                                                                                                                                                  | range-checked to 0 to 65535 (embedded placeholders reject out-of-range values like `99999`) |
| `{{ip}}`       | `(\d{1,3}\.){3}\d{1,3}`                                                                                                                                                                                    | IPv4 only for now                                                                           |
| `{{url}}`      | `https?://[^\s"'<>]+`                                                                                                                                                                                      | http(s) schemes only                                                                        |
| `{{email}}`    | `[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+`                                                                                                                                                                     |                                                                                             |
| `{{path}}`     | `\.{0,2}/[^\s"'<>]*`                                                                                                                                                                                       | absolute (`/...`) or relative (`./...`, `../...`)                                           |
| `{{workdir}}`  | none (exact string equality with the spec's cwd, realpath form)                                                                                                                                            | never matches when the framework does not know the cwd                                      |
| `{{string}}`   | any string; embedded: `[^\n]*?` (single line)                                                                                                                                                              |                                                                                             |
| `{{any}}`      | anything; embedded: `[\s\S]*?` (crosses lines) where its line holds no text on one side of it (alone on a line, opening it or closing it); `[^\n]*?` where text frames it on its line (`"msg":"{{any}}",`) |                                                                                             |

## Pitfalls

- **Inventing a token.** The vocabulary is fixed; `{{timestamp}}` in a fixture is an error (rule `no-unknown-token`). Use `{{iso8601}}`, or `match.regex()` in code for genuinely custom shapes.
- **Expecting `{{workdir}}` to be a pattern.** It matches the _exact_ cwd of the current spec; a path from another spec's cwd fails.
- **Assuming refs span the suite.** Ref scope is the current spec; `{{uuid#order}}` in two different tests are unrelated captures.
- **Using `{{any}}` where a precise token exists.** `{{any}}` matches garbage too; every widening of a fixture weakens the spec.
- **Reading "always-true" as unframed.** `{{any}}` is only unconditional as the _whole_ value. Embedded (`A {{any}} Z`), the frame around it must still match, and a non-string/number actual cannot satisfy an embedded token at all.
- **Hand-writing values that update mode would tokenize.** Run `TEST_UPDATE=1` first, then tighten: placeholders you wrote once are preserved forever after.
- **Escaping into `transform` for tokenizable noise.** Only application noise _not_ covered by the grammar justifies a transform (rule `no-transform-duplicating-tokens`); one a token already names is refused by `no-transform-duplicating-tokens`.
- **Leaving a deliberately-wrong fixture unfrozen.** A negative test whose golden matcher asserts a mismatch (wrapped in `expect(() => ...).toThrow()` / `.rejects`) must pass `{ frozen: true }`; otherwise `TEST_UPDATE=1` overwrites the wrong fixture with the real output and the assertion silently stops testing anything (rule `negative-golden-frozen`).

## Related

[Assertions](assertions.md) · [API specs](../guides/api-specs.md) · [CLI specs](../guides/cli-specs.md)
