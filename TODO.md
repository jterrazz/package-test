# TODO — the product backlog

What this package intends to do next, and nothing else. A rule's backlog is chapter 12's
(§ Backlog, each line with the criterion it would be coded against); a decision that has
been taken is a record under `docs/decisions/`; what a release carries is its GitHub
release notes. An item delivered leaves this file.

---

## 1. Performance — measure first

Benchmark: signews-api, 433 specs, three services. Nothing is optimised blind: instrument,
then implement against numbers. By expected return, descending.

1. **A pool of services, and shards.** The `IsolationStrategy` port IS the shard
   abstraction already (postgres = a schema or a template database per slot, redis = a db
   index; later: mysql = a database, kafka = a topic prefix, minio = a bucket prefix). The
   step is a machine-level pool in the orchestrator — a container becomes a reused
   resource (`testcontainers` `reuse`), and "start a service" becomes "acquire a slot".
   Consumer API impact: none, the `services` record does not change.
2. **Postgres on tmpfs.** Test data is disposable; a datadir in RAM makes init, `TRUNCATE`
   and reset nearly instant. A candidate for the default.
3. **Batched E2E lint runs (this repository).** What the lint suite costs is the SPAWN of
   the oxlint process, not Docker: batching several violation/compliant pairs into one run
   turns N spawns into one.
4. **CI sharding per vitest project**, image pre-pull, and template-database versus
   schema-clone — each to be measured.
5. **Observability first.** The startup reporter gains an "infrastructure time versus test
   time" summary, so every consumer can see its own bottleneck.

## 2. Carried

- **The spwn guards.** The forbidden-syntax rules wait for oxlint's `no-restricted-syntax`
  support; until then those guards live in `<specs>/lint/guards/` in that repository.
- **A B4 codemod.** Auto-inserting the missing `// Given -` / `// Then -` skeletons — the
  dry run counts 2569 files that would take it. Value to be weighed against what a marker
  written by a machine is worth.
- **The next large consumer.** A repository on another stack, to test how general the
  conventions are outside this ecosystem.

## 3. Asks of `@jterrazz/typescript`

- **The member walk misses a `specs/`-rooted member.** `discover_specs_roots`, in the toolchain's check command, looks for a CHILD directory named `specs` and never considers the
  member directory itself, so a workspace declaring `packages: ['specs']` (spwn's shape)
  has its tree passes skipped entirely. The checker answers that case now; the toolchain's
  own walk has to make the same move.
- **`typescript baseline` cannot resolve oxlint in an npm-hoisted member.** Its
  `find_binary` lacks the hoisted-`.bin` clause its check command carries, so the command the
  adopt flow prescribes "where red" refuses to write the file in exactly the repositories
  that need it most.
- **`typescript fix` lints its own generated wrapper.** It is written
  beside the consumer config with an absolute `.ts` import, where the react profile's
  import rules reach it — a red `fix` on a tree that is clean.
