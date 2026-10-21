# ADR-009: A node builtin is not a library, and each slice spawns only its own subject

**Status:** Accepted
**Date:** 2026-09-25

Its `docker` bullet is superseded by [ADR-020](020-the-docker-program-is-spawned-beside-the-containers.md).

The owner delegated the decision ("go tout faire") on 2026-09-27; this record
states the decision taken within that delegation.

## Context

The source trees hold each third-party library to exactly one slice, and a
truly shared library (git, yaml, oxc-parser, process spawning) lives behind a
port in `kernel/` or in the ONE slice that needs it ([01: Architecture § The
source trees](../concepts/architecture.md#the-source-trees)). `one-owner-per-library` (today the `library-*-has-one-owner` rules of `lint/self/checks/architecture.ts`, over `OWNERS_OF_LIBRARIES` in `lint/self/checks/libraries.ts`) holds the
first half for packages. It does not track `node:child_process`, which six
slices import: `world/services/process/` (the processes a record serves),
`specifications/cli/process/` (the subject binary), `specifications/mobile/server/` (`xcrun
simctl`), `expectations/command/` (`docker` for a result's containers), the git tree the rules kit reads (what git does not ignore) and, until
this record, `world/services/sqlite/` (`prisma db push`).

These are not one library used six times. Each spawns a different program for a
different owner, and none of them shares a lifecycle, an option shape or an
error with another: a port over all six would be `spawn` renamed. What made
sqlite's case different is that it spawned beside the process library of its
own area, `world/services/process/`, which is exactly the second copy that rule
forbids.

## Decision

- A node builtin is not a library in I11's sense: `OWNERS_OF_LIBRARIES` lists
  third-party packages, and the one-slice-per-library rule is read that way.
- A slice spawns only the program its own concept owns, from within that one
  concept folder: the cli specification its subject, the mobile server the simulator
  tools, `expectations/command/docker-cli.ts` `docker` (its lookup and its
  container reads, one module with one timeout), the git tree `git`.
- `docker` stays in `expectations/`, not in `world/services/` beside
  `testcontainers`, although the plan's library list pairs them. The two read
  different containers: `world/services/containers/` starts the ones the
  TEST declares, through `testcontainers`; the `docker` CLI reads the ones the
  SUBJECT started, labelled by the run, to judge a result
  (`CliResult.container()`, `ContainerAccessor`). Both readers are results,
  and `expectations/` may import only the kernel, so the move would need an
  `expectations → world` edge the layer map forbids, or a port threaded
  through every `CliResult` a specification builds for one program with one
  lifecycle: `execSync('docker ...')` renamed.
- Within `world/`, every process goes through `world/services/process/serve.ts`:
  sqlite's schema push now calls its `runToCompletion`, so `world/` has one
  spawning site.
- The rule therefore reads: each third-party library is imported by exactly ONE
  slice; process spawning lives in the one concept folder that owns the
  program spawned.

## Consequences

- The layer map holds the builtin rule: `architecture/process-spawned-by-its-program-owner`
  lets `node:child_process` into `src/` from the four spawning sites alone:
  `expectations/command/docker-cli.ts`, `specifications/cli/process/exec.adapter.ts`,
  `specifications/mobile/server/simulator.ts` and `world/services/process/serve.ts`,
  so a second spawning site fails the Architecture pass. `lint/`'s own tools
  and probes are not the product's slices, and stay outside it.
- A future port for spawning is not ruled out: when two slices spawn the SAME
  program with the same lifecycle, that program's owner exports it and the
  other imports it, as any shared concept.
