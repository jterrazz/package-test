# TODO — the product backlog

What this package intends to do next, and nothing else. A rule's backlog is chapter 18's
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
- **A cancelled body, for 16.x.** `response.body.cancel()` on a reply `intercept()`
  served never resolves under node (msw 2.15.0; `.text()` on the same body resolves at
  once) — msw/undici interop, not this package's code, and no upstream issue names a
  mocked reply. The repro is `specs/api/intercepts/body-cancel.spec.ts`, skipped: unskip
  it and the M3 escape chapter 16 sanctions goes with it.

## 3. What the contract vocabulary still cannot say

Found by package-analytics' 15.3 adoption (2026-09-20). Both are product lines: a
rule about either one is a chapter-12 backlog line, and it waits on the surface.

- **A contract cannot state an ABSENT header.** A response's headers are matched as a
  SUBSET, which proves presence and nothing else, so "this reply carries no
  `set-cookie`" is not sayable. Either a `without: { headers: [...] }` filter beside the
  subset, or a captured-request accessor the test reads and asserts on itself.
- **There is no must-never-be-called contract.** A negative test leans on
  `http.unreachable()` plus an empty `result.error`, which says "the call failed", not
  "the call never happened". `http.never(request)` — or `required: false` with
  `times: 0` — states it, and fails at chain end if the subject reached the route.

## 4. The cells the matrix says this package owes itself

The capability matrix (`docs/03-testing.md`, generated) is green because each of
these carries a written reason, and the reason is `owed`. Each is one spec, and
the list is the matrix's **Exemptions** section read as work.

- **`.clock()` on jobs** — the setup is on the facet; no `specs/jobs/` spec pins
  a calendar. The api and integration clock specs cover the same chain setup,
  which is exactly why nobody noticed.
- **`.intercept()` on website** — the website facet gained it in 15.3 and the
  package never specified it there.
- **The website tree's half of the vocabulary** — `press`, `hover`, `check`,
  `goto`, `heading`, `testId`, `dialog`, `status`, `table`, `row`, `listitem`,
  and the landmarks `banner`, `complementary`, `form`, `search` (the last four
  on component too). The vocabulary's whole claim is that it is ONE vocabulary
  on every surface that draws; a name proven on one of them is a claim with a
  third of its evidence.
- **The options nothing states** — `root` on cli, website and component,
  `external` and `backend` on website, and the component project's `clock`,
  `locale`, `timezone` and `viewport`.
- **Three accessors and a golden kind** — `.html`, `.title` and `.links` on a
  website page, `toMatchRows()` on a component, and a `.json` golden on api.

## 5. Asks of `@jterrazz/typescript`

- **The member walk misses a `specs/`-rooted member.** `discover_specs_roots`, in the toolchain's check command, looks for a CHILD directory named `specs` and never considers the
  member directory itself, so a workspace declaring `packages: ['specs']` (spwn's shape)
  has its tree passes skipped entirely. The checker answers that case now; the toolchain's
  own walk has to make the same move.
- **`typescript baseline` cannot resolve oxlint in an npm-hoisted member.** Its
  `find_binary` lacks the hoisted-`.bin` clause its check command carries, so the command the
  adopt flow prescribes "where red" refuses to write the file in exactly the repositories
  that need it most.
- **The grab-bag roster has no project-level exemption, and `core` is on it.** The tree
  this package's three-tree restructure names `src/core/` — the model every facet is made
  of — fails the toolchain's `Names (tree)` pass, whose roster is closed. The roster is right in
  general and wrong here: `core` names a subject when a package's OTHER trees are
  `facets/`, `seams/` and `runner/`, because it is what those three are made of. The flag
  the pass reads (`--ignore-pattern`) is the caller's, not the project's, so a project
  cannot state the exemption where it states everything else. Ask: let a project DECLARE a
  tree root the roster does not judge, or read `--ignore-pattern` from the package
  manifest. Until it lands, `npx typescript check` is red on that one line here.

- **`typescript fix` lints its own generated wrapper.** It is written
  beside the consumer config with an absolute `.ts` import, where the react profile's
  import rules reach it — a red `fix` on a tree that is clean.
