# Troubleshooting — symptom → fix

Operative index. Each fix names the rule and the chapter whose **Pitfalls** section explains it. When a symptom isn't here, read the Pitfalls section of the matching chapter — one per kind, [05](../../../docs/05-module-tests.md)–[12](../../../docs/12-cli.md), then the cross-cutting ones up to [19](../../../docs/19-linting.md).

## Assertions & accessors

| Symptom                                                  | Fix                                                                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `result.stdout.toContain is not a function`              | Accessors are read-only — write `expect(result.stdout).toContain(...)` (D1). [14](../../../docs/14-assertions.md)                |
| `result.grep is not a function`                          | `grep` lives on the text handle — `result.stdout.grep(pattern)` (returns a `TextAccessor`), never `result.grep()`                |
| A wall of `.grep()` on one shared run                    | Anti-pattern (D11) — one fixture project per use case, snapshot the whole output; grep is the scalpel                            |
| An amas of `.response.body` probes / a lone status probe | Golden it: `expect(result.response).toMatch('case.http')` (d12w / d15w). [10](../../../docs/10-api.md)                           |
| `"fixture ... does not exist"`                           | All expected fixtures live FLAT under `<test-dir>/_expected/` (a slash = subfolder). Create with `TEST_UPDATE=1`                 |
| Fails on a uuid/timestamp/path that changes              | Tokenize: `{{uuid}}`, `{{iso8601}}`, `{{workdir}}`, `{{uuid#ref}}`; in code `match.*`. [15 — Tokens](../../../docs/15-tokens.md) |
| Noisy stdout comparison                                  | ANSI is already stripped (`.text` stays raw); prefer tokens; `transform` is last-resort (D6)                                     |
| `toMatch(/regex/)` throws on an accessor                 | Accessor `toMatch` takes a fixture NAME (D14) — use `expect(x.text).toMatch(/re/)` for a regex                                   |

## Runners, services, seeding

| Symptom                                                                                         | Fix                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specification.app does not exist`                                                              | Only six constructors: `.api()`, `.jobs()`, `.cli()`, `.integration()`, `.website()`, `.mobile()` (A2)                                                                                                                     |
| `seed() targets database "..." not found`                                                       | `database` takes the services RECORD KEY (`{ analyticsDb: ... }` → `'analyticsDb'`), not its kebab-case form                                                                                                               |
| `N databases are declared — pass { database }` / `redundant database option`                    | A7 cuts both ways: mandatory with ≥ 2 DBs, forbidden with 1                                                                                                                                                                |
| cli spec can't find its files                                                                   | Every `.exec()` runs in a fresh temp dir — populate it with `.fixture('$FIXTURES/name/')` or `.fixture('file')`. No `.project()` (C7)                                                                                      |
| cli spec green on one machine, red on another / needs a real `kubectl`, `gh`                    | The chain is escaping the sandbox — mount a stub fixture and pin `PATH: '$WORKDIR/bin:/usr/bin:/bin'` + `HOME: '$WORKDIR'`. [12](../../../docs/12-cli.md)                                                                  |
| `database is locked` on a cold sqlite cache / a suite pinned to `fileParallelism: false` for it | Fixed since 14.1.0 — the template build takes an exclusive lock and the losers WAIT. Upgrade, then drop the pin. [17](../../../docs/17-services.md#one-worker-builds-the-others-wait)                                      |
| `no such table` in a sqlite spec after switching branch or checkout                             | The template is keyed on the schema and cached at `.artifacts/vitest/sqlite/` — per project since 14.1.0. Delete that folder to force a cold rebuild                                                                       |
| `prismaSchema` green locally, "Could not find Prisma Schema" in CI                              | The cached template hides the cold path — `rm -rf .artifacts/vitest/sqlite` and re-run. [17](../../../docs/17-services.md)                                                                                                 |
| `Could not locate the bindings file` from a `sqlite()` spec                                     | The peer is installed and its binding was never BUILT: npm, pnpm and bun all withhold install scripts now. `npm install-scripts approve better-sqlite3 && npm rebuild better-sqlite3`. [04](../../../docs/04-operating.md) |

## Intercepts, docker, modes

| Symptom                                            | Fix                                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Unmatched outgoing HTTP request during spec: ...` | Strict contracts (D7) — declare the call (or raise its `times`); the error lists every declared route |
| `CliResult.container: runner was not configured`   | `.container(name)` needs `docker: { envVar, nameLabel, testRunLabel }` in the cli options             |
| Leaked containers after a docker-aware spec        | Bind the result with `await using` (B5) so containers are force-removed at scope exit                 |

## Layout & architecture

| Symptom                                                                            | Fix                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `src/` module test needs a real file or real infra                               | It's a specification, not a unit test — move it to `specs/` (I2/I4). Under `src/`, mocks/data are CODE (`mockOf`, `.fixtures.ts`)                       |
| Lint error on runner placement                                                     | Runner → facet root (`specs/<facet>/<name>.specification.ts`); tests → facet/domain depth (C1)                                                          |
| Uppercase test title rejected                                                      | Titles start lowercase (`vitest/prefer-lowercase-title`) — a prose fragment, not a sentence; an all-caps first word is allowed via `allowedPrefixes`    |
| A `// Then -` marker ended up inside a `const a = …, b = …` chain after `lint:fix` | `one-var` in its `always` mode fused the declarations and swallowed the marker — a marker goes between STATEMENTS. [19](../../../docs/19-linting.md)    |
| The second line of a marker was capitalised mid-sentence                           | `capitalized-comments` capitalises every `//` line — a marker is EXACTLY one line; long reasoning goes in a docblock. [19](../../../docs/19-linting.md) |
| Knip reports `cleanup` as an unused export in every `*.specification.ts`           | The A4 idiom exports it and uses it in the same file — set `"ignoreExportsUsedInFile": true` in `knip.json`. [19](../../../docs/19-linting.md)          |
| Rule id / channel lookup                                                           | [references/rules.md](rules.md) (generated) · [docs/19-linting.md](../../../docs/19-linting.md)                                                         |
