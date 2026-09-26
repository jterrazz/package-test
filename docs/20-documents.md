# 20 — Spec documents (`<case>.spec.yaml`)

A terminal session that is data is written as data: one `<case>.spec.yaml` per test, beside the spec it belongs to, stating what the session stands on, the commands it runs and what each left behind. The format is the cli facet's — and the lint rules', whose specifications are cli sessions of the linter; an api or a job case is a TypeScript spec, its whole result written in place ([14](14-assertions.md#one-verb-compares-a-whole-result-and-its-argument-says-where-the-expectation-lives)). This chapter owns the format, from the key a document opens with to the door that runs it.

- [One file, one test](#one-file-one-test) — the unit, and the golden of the whole session
- [Paths](#paths) — `fixture:` names the disk the way `file()` and `directory()` do
- [A cli document](#a-cli-document) — the ground, the runs, what they left behind
- [The schema and the key order](#the-schema-and-the-key-order)
- [The three doors, one runner](#the-three-doors-one-runner) — the plugin, the bridge, the chain
- [Failure and update](#failure-and-update) · [When to reach for code](#when-to-reach-for-code)

## One file, one test

A document is ONE test: its `description:` is the vitest title, and nothing in it lists cases. There is no `cases:` key, no `extends:` and no `kind:` — a case inheriting its given from another file is a given no reader sees, and a document describes a cli session and nothing else. What several cases share is composed visibly instead: `fixture:` takes one path or a list, applied in order, so the pool's base and the leaf's delta both stand on the line (`fixture: [../../_fixtures/shop/, ./_fixtures/sold-out/]`).

**The assertion is the whole session**: every run's exit code and both its streams, byte for byte, `files:` for what it left on disk. Nothing here is new capability — a document is the chain's semantics in the shape of a data file an editor validates: `fixture:` is `.fixture()`, a run is `.exec()`. The keys, in their canonical order, are `description`, `fixture`, `env`, `serve`, `runs`; `description:` and `runs:` are mandatory.

## Paths

`fixture:` takes a path relative to the document, spelled in full (`./…`, `../…`), and is judged by the four guards a `file()` call is (chapter [14](14-assertions.md#one-verb-compares-a-whole-result-and-its-argument-says-where-the-expectation-lives)):

- **Role** — a path whose first ground folder is not `_fixtures/` is refused by the grammar, on its line, so the checker (`document-follows-its-grammar`) and the runner refuse the same document (`verb-reads-its-ground-folder`'s law, for data).
- **Locality** — a path leaves its leaf only by climbing: into the ground of a folder that encloses it, or the specs root's shared `<specs>/_shared/_fixtures/` (`no-reach-into-sibling-ground`).
- **Existence** — every path names an entry git does not ignore, of the kind it names — a directory with its trailing `/`, a file without (`named-path-exists`); at run time a missing one is refused with what it resolved to.
- **Liveness** — a fixture a document names is referenced, exactly as a `file()` literal references it (`no-unused-ground`, `ground-shared-or-inline`).

## A cli document

A terminal session is already a specification: a command, its exit code, what it printed, what it left on disk. A cli document writes it as that — never under `_expected/`, which holds goldens, not scenarios.

```yaml
description: refuses to guess when it is run outside the checkout
fixture: ../../_shared/_fixtures/repositories-stub/
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

| Key        | Shape                                       | Meaning                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixture:` | string or list                              | The two forms the chain's `file()` and `directory()` take — the trailing `/` says which: `./_fixtures/shop/` spreads a directory's contents, `./_fixtures/config.toml` copies one file under its own name; a path whose `/` disagrees with the disk is refused. Executable bits preserved. A list **layers** in order |
| `env:`     | string or list                              | Each entry is either a **bare word** naming an env set registered in code, or `KEY=value` inline (`$WORKDIR` expands, as in `.env()`)                                                                                                                                                                                 |
| `serve:`   | string, list of strings, or `- name: { … }` | Servers registered in code, started once **per file** before the first run and shared by all of them. The mapping form adds env to that server                                                                                                                                                                        |

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

## The schema and the key order

The document's JSON Schema ships with the package at `schema/spec.schema.json`, published as the `@jterrazz/test/schema` export, and is generated from the grammar's own constants — it cannot describe a shape the parser does not read. It closes a document on its keys and states every presence law of the grammar — the keys a mapping cannot do without, the keys that cannot stand together — from `PRESENCE`, the one table the parser refuses with. A meta-test holds the other direction: a JSON Schema validator runs it over every document of this repository, each one the parser reads, it validates, and each one the parser refuses, it refuses — but for what no keyword compares: a `waitFor:` on a run before the last, where the schema holds only that one run at most waits — and it breaks every presence law, for both readers alike. Point an editor at it:

```yaml
# yaml-language-server: $schema=./node_modules/@jterrazz/test/schema/spec.schema.json
```

A schema says which keys exist, not which ORDER they come in. The canonical order — `description, fixture, env, serve, runs` at the top, then `command, stdin, timeout, waitFor, exit, stdout, stderr, files` in a run — is the `document-keys-in-canonical-order` pass's, which also rewrites it: `npx jterrazz-test-check specs --fix`. The whole document family of rules is in [19 — Linting](19-linting.md).

The whole [token vocabulary](15-tokens.md) works in what a document ASSERTS — a run's streams and `files:` texts — and **never** in `description`, `command` or `stdin`, which are prose and inputs.

## The three doors, one runner

| Door       | Use it when                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **plugin** | The document IS the test — the common case                                                     |
| **bridge** | The document is the scenario, but one assertion needs code                                     |
| **chain**  | Everything the format cannot say — see [when to reach for code](#when-to-reach-for-code) below |

**The plugin.** `literate()` from `@jterrazz/test/vitest` adds the `.spec.yaml` glob to a project's include and transforms each document into a one-test module that runs it through the bound specification's `cli`. The runner shows the document's path as the test file and `description:` as the title, so a failing case opens where it is written. The `cli()` project helper wires it:

| `literate`                        | Collects                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| omitted                           | every `specs/cli/**/*.spec.yaml`, bound to `./specs/cli/cli.specification.ts` |
| `{ specification: './other.ts' }` | the same documents, bound to another runner                                   |
| `{ include: [...] }`              | a narrower glob                                                               |
| `false`                           | no documents at all — a suite written entirely in code                        |

The `specification` is **stated, never guessed** beyond that convention: a repository may declare several cli runners, and nothing could pick the right one without silently binding a case to the wrong app. With `projects`, the door goes in the ONE project that collects those documents, never the root config. A member without `"type": "module"` names its config `vitest.config.mts`.

**The bridge.** `cli.run(file('./<case>.spec.yaml'))` runs a document from a spec and resolves with the LAST run's result, so code adds what the document cannot express.

```typescript
test('scaffolds a shop and leaves the tree we expect', async () => {
    // Given - the whole session, stated in the document
    const result = await cli.run(file('./scaffold.spec.yaml'));

    // Then - one assertion the format has no vocabulary for
    await expect(result.directory('my-shop')).toMatch(directory('./_expected/shop-scaffold/'));
});
```

`.run()` is a DOOR, not a fallback: it stays for a document whose result needs one assertion the grammar has no vocabulary for, or for a document the plugin's glob cannot collect — generated at test time, or an input under `_fixtures/` whose refusal is the subject of a negative spec. `{ frozen: true }` opts one document out of the update rewrite, the guard `toMatch(file(…), { frozen: true })` is for a golden.

## Failure and update

On a mismatch the failure renders the description, the command that ran, everything the comparison rejected — the exit code, the stream diff, the `files:` entry — and where to open the document, at the run's own line.

A line the comparison ACCEPTED is rendered as equal, with its token, so the marked lines are the mismatch and nothing else. The stack carries one frame: the document's own line.

`TEST_UPDATE=1` rewrites what the run produced and nothing else: each run's `exit`, `stdout` and `stderr`. The ground, the commands and `files:` are stated by hand and never touched, and neither are comments or key order: the YAML document is edited, not re-emitted. Placeholders survive by **pattern match**, so a token stays a token wherever the line moved to: see [update mode](15-tokens.md#update-mode-tokens-are-preserved).

## When to reach for code

The format states one subject and one linear story. Reach for the chain when the spec needs:

- **logic** — a loop, a computed value, reasoning across two calls the document cannot relate;
- **containers** — `docker`-aware runs, `await using`, `result.container(name)`;
- **parallel fan-out** — several commands that must run at once, or an interleaving;
- **host shell-outs** the binary under test is not — a `git` call, a build step staged by hand;
- **structural JSON of a cli run** — `result.json` compared whole to its value;
- **a refusal of the chain itself** — a directory handed as a body, a database the record lacks.

A document that starts wanting a conditional is a chain wearing a header. Write it in code.

## Pitfalls

- **Putting a `<case>.spec.yaml` under `_expected/`.** A document is the CASE, not a golden — it lives beside the spec it belongs to (`no-document-in-ground`).
- **Writing a token in a `description:`, a `command:` or a `stdin:`.** Those are prose and inputs; placeholders work in what is asserted.
- **Quoting a stream instead of writing a block scalar.** `stdout: "a\nb\n"` is a golden no diff can show — `document-streams-written-as-block-scalars` rejects it and `--fix` rewrites it.
- **A `fixture:` naming a golden's folder.** It reads `_fixtures/`; `./_expected/shop/` is refused on its line.
- **Listing cases in one file, or inheriting a given.** One file is one test, and the given is visible: a list of paths layers, `extends:` does not exist.
- **Writing an api or a job case as a document.** The format is a cli session's; an api or job case is a spec, its whole result in place — `kind:` is an unknown key.

## Related

[12 — CLI specs](12-cli.md) · [14 — Assertions](14-assertions.md) · [15 — Tokens](15-tokens.md) · [19 — Linting](19-linting.md)
