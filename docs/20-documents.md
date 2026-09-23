# 20 — Spec documents (`<case>.spec.yaml`)

A case that is data is written as data: one `<case>.spec.yaml` per test, beside the spec it belongs to, stating what the case stands on, what it does and what came back. This chapter owns the format for the three facets that read it — cli, api and jobs — from the key a document opens with to the door that runs it.

- [One file, one test](#one-file-one-test) — the unit, and the golden of the whole result
- [The kinds](#the-kinds) — which facet reads a document, and which keys each reads
- [Paths](#paths) — every key names the disk the way `file()` does
- [A cli document](#a-cli-document) · [An api document](#an-api-document) · [A jobs document](#a-jobs-document)
- [The schema and the key order](#the-schema-and-the-key-order)
- [The three doors, one engine](#the-three-doors-one-engine) — the plugin, the bridge, the chain
- [Failure and update](#failure-and-update) · [When to reach for code](#when-to-reach-for-code)

## One file, one test

A document is ONE test: its `description:` is the vitest title, and nothing in it lists cases. There is no `cases:` key and no `extends:` — a case inheriting its given from another file is a given no reader sees. What several cases share is composed visibly instead: every given key that names the disk takes one path or a list, applied in order, so the pool's base and the leaf's delta both stand on the line (`fixture: [../../fixtures/shop/, ./fixtures/sold-out/]`).

**The default assertion is a golden of the whole result** — approval testing: `response: ./expected/created.http`, a cli run's streams. A precise probe is for the case where one property IS the subject, and D12w keeps warning on a cluster of them.

Nothing here is new capability. A document is the chain's semantics in the shape of a data file an editor validates: `seed:` is `.seed()`, `clock:` is `.clock()`, a run is `.exec()`.

## The kinds

`kind:` names the facet that reads the document, and the runner it is bound to is the export of that name — `cli`, `api` or `jobs`. A document with no `kind:` is a cli one. Each kind reads a closed set of keys, and a key of another kind is refused naming the kind it belongs to: `fixture:` lays files into a working directory, and neither an api nor a jobs chain has one.

| Kind   | Given                                       | Action                                | What came back                  |
| ------ | ------------------------------------------- | ------------------------------------- | ------------------------------- |
| `cli`  | `fixture:`, `env:`, `serve:`                | `runs:` — each a `command:`           | each run's exit, streams, files |
| `api`  | `seed:`, `intercept:`, `clock:`, `headers:` | `request:` (and `body:`), or `steps:` | `response:`, `tables:`          |
| `jobs` | `seed:`, `intercept:`, `clock:`             | `trigger:`                            | `error:`, `tables:`             |

`description:` is mandatory in all three. The canonical order of the top-level keys is the table's, read left to right: what the case stands on, then what it does, then what came back.

## Paths

Every key that names the disk takes a path relative to the document, spelled in full (`./…`, `../…`), and is judged by the four guards a `file()` call is (chapter [14](14-assertions.md#one-verb-compares-a-whole-result-and-its-argument-says-where-the-expectation-lives-rule-d3)):

| Key          | Reads        | Takes                           |
| ------------ | ------------ | ------------------------------- |
| `fixture:`   | `fixtures/`  | a file, or a directory with `/` |
| `seed:`      | `seeds/`     | a `.sql` file                   |
| `request:`   | `requests/`  | a `.http` file                  |
| `body:`      | `requests/`  | any file — `.json` is parsed    |
| `response:`  | `expected/`  | a `.http` file                  |
| `intercept:` | `contracts/` | a module (`.ts`, `.js`)         |

- **Role** — a path whose first ground folder is not the one its key reads is refused by the grammar, on its line, so the checker (`d4b-spec-shape`) and the runner refuse the same document (C24's law, for data).
- **Locality** — a path leaves its leaf only into the specs root's own ground — `<specs>/fixtures/`, `<specs>/seeds/`, `<specs>/requests/`, `<specs>/expected/` — the folder of its key's role (C15, C24): `seed: [../../seeds/catalog.sql, ./seeds/delta.sql]` lays the shared base, then the leaf's delta.
- **Existence** — every path names an entry git does not ignore, of the kind its key reads (C8); at run time a missing one is refused with what it resolved to.
- **Liveness** — a ground file a document names is referenced, exactly as a `file()` literal references it (C9, C14).

An `intercept:` module default-exports what `.intercept()` takes — one contract, a list, or a `defineContracts()` composite ([16](16-contracts.md)) — and each one named is registered in order, as chained `.intercept()` calls are.

## A cli document

A terminal session is already a specification: a command, its exit code, what it printed, what it left on disk. A cli document writes it as that — never under `expected/`, which holds goldens, not scenarios.

```yaml
description: refuses to guess when it is run outside the checkout
fixture: ../../fixtures/repositories-stub/
env:
    - frozen
    - SHOPLY_ORIGIN=http://127.0.0.1:9
serve:
    - mcp: { MCP_STUB_WITHHOLD: get-article }

runs:
    - command: repositories
      exit: 1
      stderr: |
          Error: no directory with home/ and apps/ above the current directory
          Hint: run inside the shoply checkout
    - command: repositories --json
      exit: 0
      stdout: |
          {
              "data": []
          }
```

### The ground

| Key        | Shape                                       | Meaning                                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixture:` | string or list                              | The two forms the chain's `file()` and `directory()` take — the trailing `/` says which: `./fixtures/shop/` spreads a directory's contents, `./fixtures/config.toml` copies one file under its own name; a path whose `/` disagrees with the disk is refused. Executable bits preserved. A list **layers** in order |
| `env:`     | string or list                              | Each entry is either a **bare word** naming an env set registered in code, or `KEY=value` inline (`$WORKDIR` expands, as in `.env()`)                                                                                                                                                                               |
| `serve:`   | string, list of strings, or `- name: { … }` | Servers registered in code, started once **per file** before the first run and shared by all of them. The mapping form adds env to that server                                                                                                                                                                      |

The words `env:` and `serve:` name are registered once per app, in the options of `specification.cli()` — [12 — CLI specs § Registration](12-cli.md#registration--once-per-app).

### The runs

`runs:` is a list of at least one run, executed **in order**, all in ONE working directory, and **every** one asserted. This is where the format goes past `.exec([...])`, which stops at the first non-zero exit and keeps only the last output: here a non-zero exit does not end the session, because each exit code is part of what the document states.

**A run is judged the moment it ends**, before the next command starts — its exit code, its streams and its `files:` all read at that one instant. A run that disagrees throws there and then, and the runs below it do not execute: once the sequence has diverged, what the rest would print is a consequence, not a fact about the program.

| Key        | Shape                         | Meaning                                                                                                                                                                                                                                              |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command:` | **mandatory**                 | The argv AFTER the binary — exactly what `.exec('…')` takes. The binary is the runner's (`specification.cli(bin)`), so naming it here would pass it to itself as the first argument. The line goes through the shell, so quoting behaves identically |
| `stdin:`   | optional block scalar         | Written to the child, which then reads EOF. Absent keeps the immediately-closed pipe; a TTY is never given                                                                                                                                           |
| `timeout:` | optional integer              | Milliseconds before the run is killed (exit code 124)                                                                                                                                                                                                |
| `waitFor:` | optional, **last run only**   | Long-running form: resolve as soon as this text appears, as `.exec(args, { waitFor })` does                                                                                                                                                          |
| `exit:`    | **mandatory** literal integer | The exit code the command must return                                                                                                                                                                                                                |
| `stdout:`  | optional block scalar         | Expected stdout, **byte-exact**. Absent asserts an EMPTY stream                                                                                                                                                                                      |
| `stderr:`  | optional block scalar         | Expected stderr, byte-exact. Absent asserts an EMPTY stream                                                                                                                                                                                          |
| `files:`   | optional mapping              | On-disk assertions under the working directory, read the moment THIS run ends (below)                                                                                                                                                                |

**`|` and `|-` are the whole newline story.** A block scalar written `|` keeps the final newline of its text; `|-` drops it. The comparison is byte-exact against that, so a command whose output ends with `\n` is written `|`, and one that ends mid-line is written `|-`.

### `files:` — what the run left behind

Each key is a path relative to the working directory (never absolute, never escaping it). Each value is one of four forms:

```yaml
files:
    .spwn/agent.yaml: { contains: 'name: bot' } # one needle, or a list of them
    out/report.txt:
        equals: | # exact text, block scalar allowed
            ok
    .spwn/lock: absent # nothing at that path
    out/src: exists # something at that path
```

`contains` and `equals` are token-aware: `{ contains: 'wrote {{path}}' }` finds the line whatever the path turned out to be. Each run's mapping is read against the working directory **as that run left it**, so a file may be `absent` for one run and there for the next — which is how a lock, a cache or a build output is described:

```yaml
description: the lock appears with the first apply and is released by the second
runs:
    - command: status
      exit: 0
      files:
          .spwn/lock: absent
    - command: apply --hold
      exit: 0
      files:
          .spwn/lock: { contains: 'pid: {{int}}' }
```

## An api document

An api case states the chain's setups as keys, the request it sends, and the response it expects back — golden of the whole exchange by default:

```yaml
kind: api
description: a request file is sent whole, and the user it creates lands in both databases
request: ./requests/create-user.http
response: ./expected/user-created.http
tables:
    users:
        database: db
        columns: [name, email]
        rows:
            - [Charlie, charlie@test.com]
```

| Key          | Shape                                                      | Meaning                                                                                                                                                                                                      |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `seed:`      | path, `{ file, database }`, or a list of either            | `.sql` files applied in order before the request; `database` targets one when the runner declares several (rule A7 — mandatory with two, refused with one)                                                   |
| `intercept:` | path or list                                               | Contract modules registered in order — strict, as `.intercept()` is (rule D7)                                                                                                                                |
| `clock:`     | ISO instant                                                | The instant the app reads, pinned for this document alone (`.clock()`)                                                                                                                                       |
| `headers:`   | mapping                                                    | Headers every request of the document carries: over a request file's, under a step's own                                                                                                                     |
| `request:`   | a `./requests/*.http` path, or `METHOD /path`              | What is sent. A file is sent whole; an inline line takes its `body:` beside it                                                                                                                               |
| `body:`      | a value, or a path under `requests/`                       | An inline request's body — a mapping or a list is sent as JSON, a string as written; a file is read as the chain reads one, `.json` parsed and anything else verbatim                                        |
| `response:`  | a `./expected/*.http` path, or `{ status, headers, body }` | The golden: the file form is `toMatch(file(…))`'s own; the inline form states the same three parts — headers a subset, the body compared structurally, every string token-aware, an absent part not asserted |
| `tables:`    | table name → `{ database?, columns, rows }`                | What `toMatchRows()` takes, read after the request; `rows: []` asserts the table is empty                                                                                                                    |

Every document resets the databases first, exactly as a chain does. Setup chained before the call lays underneath the document's own: a chained `.seed()` runs first, and a chained `.headers()` sits under the document's.

### Steps — a journey in one test

`steps:` replaces the one request with a list of them, sharing one database state and each judged the moment it returns. A step captures values from its response body by JSONPath, and a later step sends them as `{{name}}` — in its request line, its headers or its body:

```yaml
kind: api
description: a later step sends what an earlier one captured, and gets the same session back
steps:
    - request: GET /session
      capture:
          sessionId: $.id
      response: ./expected/session.http
    - request: GET /echo/{{sessionId}}
      response:
          status: 200
          body:
              value: '{{uuid#session}}'
```

A step takes `request:`, `headers:`, `body:`, `capture:`, `response:` and `tables:`, in that order, and states `response:`, `tables:` or both. A capture is named by a word no `{{token}}` means, and read with `$`, `.key`, `[index]` and `['a key']`; a path that finds nothing stops the journey on the capture's line. A name sent before a step captured it is refused by the grammar where it is written — and so is a token in an input: a token matches what comes back, a request sends values.

What comes back is compared through the token grammar, with one scope for the whole journey: a `{{uuid#session}}` bound by the first response must be the same uuid in the last.

## A jobs document

A jobs case names the job it triggers and what the job did — the rejection it ended on, and the rows it left:

```yaml
kind: jobs
description: a job that crashes is read by its error, and what it wrote first stays
trigger: crash-after-insert
error: 'crash-after-insert: {{string}}'
tables:
    events:
        database: analyticsDb
        columns: [type]
        rows:
            - [pre_crash]
```

`seed:`, `intercept:` and `clock:` read as in an api document. `trigger:` names a job registered in the `jobs` option of `specification.jobs()`; an unknown name is refused on its line, naming the registered ones. `error:` is the message the job must reject with, token-aware — absent, the document asserts the job succeeded, and a rejection fails it. The tables are judged either way, so a document states what a crashing job wrote before it crashed.

## The schema and the key order

The document's JSON Schema ships with the package at `schema/spec.schema.json`, published as the `@jterrazz/test/schema` export, and is generated from the grammar's own constants — it cannot describe a shape the parser does not read. It closes each kind on its own keys, one `if`/`then` per kind, and states every presence law of the grammar — the keys a mapping cannot do without, the keys that cannot stand together — from `PRESENCE`, the one table the parser refuses with. A meta-test holds the other direction: a JSON Schema validator runs it over every document of this repository, each one the parser reads, it validates, and each one the parser refuses, it refuses — but for what no keyword compares: an order across steps, a name sent before the step that captures it, and a `waitFor:` on a run before the last, where the schema holds only that one run at most waits — and it breaks every presence law, for both readers alike. Point an editor at it:

```yaml
# yaml-language-server: $schema=./node_modules/@jterrazz/test/schema/spec.schema.json
```

A schema says which keys exist, not which ORDER they come in. The canonical order — the kinds table above, then `command, stdin, timeout, waitFor, exit, stdout, stderr, files` in a run and `request, headers, body, capture, response, tables` in a step — is the `d4b-spec-key-order` pass's, which also rewrites it: `npx jterrazz-test-check specs --fix`. The whole document family of rules is in [19 — Linting](19-linting.md).

The whole [token vocabulary](15-tokens.md) works in what a document ASSERTS — a run's streams and `files:` texts, a response's status, headers and body, a table's cells, a job's `error:` — and **never** in `description`, `command`, a request or a body, which are prose and inputs.

## The three doors, one engine

| Door       | Use it when                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **plugin** | The document IS the test — the common case                                                     |
| **bridge** | The document is the scenario, but one assertion needs code                                     |
| **chain**  | Everything the format cannot say — see [when to reach for code](#when-to-reach-for-code) below |

**The plugin.** `literate()` from `@jterrazz/test/vitest` adds the `.spec.yaml` glob to a project's include and transforms each document into a one-test module that runs it through the export its `kind:` names. The runner shows the document's path as the test file and `description:` as the title, so a failing case opens where it is written. The `cli()`, `api()` and `jobs()` project helpers wire it for their facet:

| `literate`                        | Collects                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| omitted                           | every `specs/<facet>/**/*.spec.yaml`, bound to `./specs/<facet>/<facet>.specification.ts` |
| `{ specification: './other.ts' }` | the same documents, bound to another runner                                               |
| `{ include: [...] }`              | a narrower glob                                                                           |
| `false`                           | no documents at all — a suite written entirely in code                                    |

The `specification` is **stated, never guessed** beyond that convention: a repository may declare several runners of one facet, and nothing could pick the right one without silently binding a case to the wrong app. With `projects`, the door goes in the ONE project that collects those documents, never the root config. A member without `"type": "module"` names its config `vitest.config.mts`.

**The bridge.** `cli.run(file('./<case>.spec.yaml'))`, `api.run(…)` and `jobs.run(…)` run a document from a spec and resolve with the LAST result — the last run's, the last response's, the job's — so code adds what the document cannot express. A document handed to another kind's runner is refused naming the runner it belongs to.

```typescript
test('scaffolds a shop and leaves the tree we expect', async () => {
    // Given - the whole session, stated in the document
    const result = await cli.run(file('./scaffold.spec.yaml'));

    // Then - one assertion the format has no vocabulary for
    await expect(result.directory('my-shop')).toMatch(directory('./expected/shop-scaffold/'));
});
```

`.run()` is a DOOR, not a fallback: it stays for a document whose result needs one assertion the grammar has no vocabulary for, or for a document the plugin's glob cannot collect — generated at test time, or an input under `fixtures/` whose refusal is the subject of a negative spec. `{ frozen: true }` opts one document out of the update rewrite, the guard `toMatch(file(…), { frozen: true })` is for a golden.

## Failure and update

On a mismatch the failure renders the description, the action that ran — the command, the request line, the trigger — everything the comparison rejected, and where to open the document:

```
Spec mismatch

expects a user that was never seeded

GET /users/999

Response status mismatch (response of step 1)
  expected: 200
  received: 404

specs/api/literate/fixtures/wrong-status.spec.yaml:5
Run with TEST_UPDATE=1 to rewrite the responses — a response's status, headers and body, and nothing else.
```

A line the comparison ACCEPTED is rendered as equal, with its token, so the marked lines are the mismatch and nothing else. The stack carries one frame: the document's own line.

`TEST_UPDATE=1` rewrites what the run produced and nothing else: a cli run's `exit`, `stdout` and `stderr`; an api response — an inline one in the document, a file-form one in its golden, recorded when it is missing or empty. The ground, the commands, the requests, `files:`, `tables:` and a job's `error:` are stated by hand and never touched, and neither are comments or key order: the YAML document is edited, not re-emitted. Placeholders survive by **pattern match**, so a token stays a token wherever the line moved to: see [update mode](15-tokens.md#update-mode-tokens-are-preserved).

## When to reach for code

The format states one subject and one linear story. Reach for the chain when the spec needs:

- **logic** — a loop, a computed value, reasoning across two calls the document cannot relate;
- **containers** — `docker`-aware runs, `await using`, `result.container(name)`;
- **parallel fan-out** — several commands that must run at once, or an interleaving;
- **host shell-outs** the binary under test is not — a `git` call, a build step staged by hand;
- **structural JSON of a cli run** — `result.json` against an `expected/*.json` golden;
- **a refusal of the chain itself** — a directory handed as a body, a database the record lacks.

A document that starts wanting a conditional is a chain wearing a header. Write it in code.

## Pitfalls

- **Putting a `<case>.spec.yaml` under `expected/`.** A document is the CASE, not a golden — it lives beside the spec it belongs to (C16).
- **Writing a token in a `description:`, a `command:`, a request or a body.** Those are prose and inputs; placeholders work in what is asserted.
- **Quoting a stream instead of writing a block scalar.** `stdout: "a\nb\n"` is a golden no diff can show — `d4b-spec-block-scalar` rejects it and `--fix` rewrites it.
- **A `seed:` naming a golden's folder.** Each key reads its own folder; `./expected/users.sql` is refused on its line.
- **Listing cases in one file, or inheriting a given.** One file is one test, and the given is visible: a list of paths layers, `extends:` does not exist.
- **Forgetting `kind: api`.** A document without a kind is a cli one, and its `request:` is refused naming the cli keys.

## Related

[12 — CLI specs](12-cli.md) · [10 — API specs](10-api.md) · [11 — Jobs specs](11-jobs.md) · [15 — Tokens](15-tokens.md) · [16 — Contracts](16-contracts.md) · [19 — Linting](19-linting.md)
