# ADR-009: A node builtin is not an engine, and each slice spawns only its own subject

**Status:** Proposed
**Date:** 2026-09-25

## Context

The `src/` restructure's plan says each third-party engine is imported by
exactly one slice, and that "truly shared engines (git, yaml, oxc-parser,
process spawning) live behind a port in `kernel/` or in the ONE slice that
needs them". I11 (`lint/checker-source-imports.ts`, `ENGINE_OWNERS`) holds the
first half for packages. It does not track `node:child_process`, which six
slices import: `world/services/process/` (the processes a record serves),
`facets/cli/process/` (the subject binary), `facets/mobile/server/` (`xcrun
simctl`), `expectations/command/` (`docker inspect` for a result's
containers), `kernel/files/git-tree.ts` (what git does not ignore) and, until
this record, `world/services/sqlite/` (`prisma db push`).

These are not one engine used six times. Each spawns a different program for a
different owner, and none of them shares a lifecycle, an option shape or an
error with another: a port over all six would be `spawn` renamed. What made
sqlite's case different is that it spawned beside the process engine of its
own area, `world/services/process/`, which is exactly the second copy the plan
forbids.

## Decision

- A node builtin is not an engine in I11's sense: `ENGINE_OWNERS` lists
  third-party packages, and lock 4 is read that way.
- A slice spawns only the program its own concept owns, through the one
  module of that concept: the cli facet its subject, the mobile server the
  simulator tools, the docker lookup `docker`, the git tree `git`.
- Within `world/`, every process goes through `world/services/process/`:
  sqlite's schema push now calls its `runToCompletion`, so `world/` has one
  spawning site.
- The plan's line reads: "each third-party engine is imported by exactly ONE
  slice; process spawning lives in the one module of the concept that owns
  the program spawned".

## Consequences

- No lock holds the builtin rule; a second spawning site inside one area is
  caught by review, not by I11.
- A future port for spawning is not ruled out: when two slices spawn the SAME
  program with the same lifecycle, that program's owner exports it and the
  other imports it, as any shared concept.
