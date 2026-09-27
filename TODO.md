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

1. **Containers shared across projects, and a pool.** A container is started once per
   PROJECT of a run today ([17 § Services](docs/17-services.md)), so `api()` and
   `integration()` that both declare `postgres()` start two. The `IsolationStrategy` port is
   the shard abstraction already (a template database per worker, a redis index per
   (worker, service) pair), and vitest 5.0.1 draws every pool id of a run from one pool, so
   the indexes stay distinct across projects. The step is a run-level, then machine-level
   pool: "start a service" becomes "acquire a slot". Consumer API impact: none.
2. **Batched E2E lint runs (this repository).** What the lint suite costs is the SPAWN of
   the oxlint process, not Docker: batching several violation/compliant pairs into one run
   turns N spawns into one.
3. **CI sharding per vitest project.** `make test SHARD=i/n` and `make test-merge` split
   this repository's run; the shared workflow has no shard input yet. A consumer that
   shards needs the merge's route judgement, which `dist/route-split.js` gives this
   repository alone: publishing it as a bin comes with this row.
4. **Observability first.** The startup reporter gains an "infrastructure time versus test
   time" summary, so every consumer can see its own bottleneck.

## 2. Carried

- **The spwn guards.** The forbidden-syntax rules wait for oxlint's `no-restricted-syntax`
  support; until then those guards live in `<specs>/lint/guards/` in that repository.
- **A Given/Then codemod.** Auto-inserting the missing `// Given -` / `// Then -` skeletons — the
  dry run counts 2569 files that would take it. Value to be weighed against what a marker
  written by a machine is worth.
- **The next large consumer.** A repository on another stack, to test how general the
  conventions are outside this ecosystem.

## 3. What the stub vocabulary still cannot say

Found by package-analytics' 15.3 adoption (2026-09-20). Both are product lines: a
rule about either one is a line of [18 § The backlog](docs/18-conventions.md#the-backlog--the-criterion-written-coded-on-its-first-occurrence),
and it waits on the surface.

- **A stub cannot state an ABSENT header.** A response's headers are matched as a
  SUBSET, which proves presence and nothing else, so "this reply carries no
  `set-cookie`" is not sayable. Either a `without: { headers: [...] }` filter beside the
  subset, or a captured-request accessor the test reads and asserts on itself.
- **There is no must-never-be-called stub.** A negative test leans on
  `http.unreachable()` plus an empty `result.error`, which says "the call failed", not
  "the call never happened". `http.never(request)` — or `required: false` with
  `times: 0` — states it, and fails at chain end if the subject reached the route.

## 4. A framework's Vite config function under `component()`

`component({ vite })` accepts the function a framework exports — Astro's `getViteConfig()`
is one — but no spike has proven that pipeline under the component facet: the cross-repo
probe that suggested it was confounded by two Vite versions. The proof owed is an in-repo
spike inside a `jterrazz-web` worktree; until it lands, chapter 07 sends a consumer to the
app's own `vite.config.ts`.

## 5. Known defects and debt

- **A server command outlives a killed run.** `serve.ts` spawns every `process()` service
  and the run's Appium server `detached`, in a process group of its own, so a vitest killed
  with SIGKILL leaves them running; only teardown stops them. The runner needs a parent
  watchdog: the child's group exits when the run's process is gone.
- **A mobile session that died is attached to anyway.** The run's ledger hands later files
  the recorded session with no probe, and no `appium:newCommandTimeout` is set, so a
  session the server expired fails each later file on its first command. Settle it with a
  timed `make test-mobile` on a warm simulator, then probe before attaching.
- **The cli facet cannot install a package into its fixture.** A spec whose subject
  resolves an installed package stays a raw chain: `@jterrazz/typescript`'s publish-guard
  spec links `node_modules/@jterrazz/test` into its fixture by hand, one of the 22
  `facet-test-uses-its-runner` entries its ratchet holds. A setup verb that links
  or installs a package into the fixture (`.link(name, path)`) pays it off.
- **190 `typescript/no-unsafe-type-assertion` held by the ratchet.** 68 are `as AstNode` or
  `as AstNode[]` in the consumer rules, a node narrowed by hand: a typed accessor in
  `lint/engine/project/ast.ts` per shape the rules narrow to (a call's callee, a
  declaration's declarators) retires them. The rest are `JSON.parse` and computed-import
  results, each to be narrowed by a named shape.
