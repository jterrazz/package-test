# TODO — the product backlog

What this package intends to do next, and nothing else. A rule's backlog is chapter 18's
([§ The backlog](docs/18-conventions.md#the-backlog--the-criterion-written-coded-on-its-first-occurrence),
each line with the criterion it would be coded against); a decision that has
been taken is a record under `docs/decisions/`; what a release carries is its GitHub
release notes. An item delivered leaves this file.

---

## 1. Performance — measure first

Benchmark: signews-api, 433 specs, three services. Nothing is optimised blind: instrument,
then implement against numbers. By expected return, descending.

1. **Batched E2E lint runs (this repository).** What the lint suite costs is the SPAWN of
   the oxlint process, not Docker: batching several violation/compliant pairs into one run
   turns N spawns into one.
2. **CI sharding per vitest project.** `make test SHARD=i/n` and `make test-merge` split
   this repository's run; the shared workflow has no shard input yet. A consumer that
   shards needs the merge's route judgement, which `dist/route-split.js` gives this
   repository alone: publishing it as a bin comes with this row.
3. **Observability first.** The startup reporter gains an "infrastructure time versus test
   time" summary, so every consumer can see its own bottleneck.

## 2. Carried

- **The spwn guards.** The forbidden-syntax rules wait for oxlint's `no-restricted-syntax`
  support; until then those guards live in `<specs>/lint/guards/` in that repository.
- **A Given/Then codemod.** Auto-inserting the missing `// Given -` / `// Then -` skeletons — the
  dry run counts 2569 files that would take it. Value to be weighed against what a marker
  written by a machine is worth.
- **The next large consumer.** A repository on another stack, to test how general the
  conventions are outside this ecosystem.

## 3. Known defects and debt

- **`typescript/no-unsafe-type-assertion` held by the ratchet** (`oxlint-suppressions.json`
  counts them). The largest group is `as AstNode` or `as AstNode[]` in the consumer rules,
  a node narrowed by hand: a typed accessor in `lint/engine/project/ast.ts` per shape the
  rules narrow to (a call's callee, a declaration's declarators) retires them. The rest are
  `JSON.parse` and computed-import results, each to be narrowed by a named shape.
