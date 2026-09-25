# ADR-009: A node builtin is not an engine, and each slice spawns only its own subject

**Status:** Proposed
**Date:** 2026-09-25

## Context

The source trees hold each third-party engine to exactly one slice, and a
truly shared engine (git, yaml, oxc-parser, process spawning) lives behind a
port in `kernel/` or in the ONE slice that needs it ([01 — Architecture § The
source trees](../01-architecture.md#the-source-trees)). I11 (`lint/checker-source-imports.ts`, `ENGINE_OWNERS`) holds the
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
own area, `world/services/process/`, which is exactly the second copy that rule
forbids.

## Decision

- A node builtin is not an engine in I11's sense: `ENGINE_OWNERS` lists
  third-party packages, and the one-slice-per-engine rule is read that way.
- A slice spawns only the program its own concept owns, from within that one
  concept folder: the cli facet its subject, the mobile server the simulator
  tools, `expectations/command/` `docker` (its lookup and its container
  reads), the git tree `git`.
- Within `world/`, every process goes through `world/services/process/`:
  sqlite's schema push now calls its `runToCompletion`, so `world/` has one
  spawning site.
- The rule therefore reads: each third-party engine is imported by exactly ONE
  slice; process spawning lives in the one concept folder that owns the
  program spawned.

## Consequences

- No lock holds the builtin rule; a second spawning site inside one area is
  caught by review, not by I11.
- A future port for spawning is not ruled out: when two slices spawn the SAME
  program with the same lifecycle, that program's owner exports it and the
  other imports it, as any shared concept.
