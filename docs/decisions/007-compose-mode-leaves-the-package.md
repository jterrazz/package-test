# ADR-007: Compose mode leaves the package

**Status:** Proposed
**Date:** 2026-09-20

## Context

`specification.api({ mode: 'compose' })` let a spec meet the application as a
container stack described by a `docker/compose.test.yaml` rather than as a Hono
app handed to `server`. It carried a binding resolver, a compose-file reader, a
`composeService` name on every service handle, a `TEST_MODE` environment
variable, a fetch adapter for the api facet, five lint rules (A5, A6, A6w, A10,
I3) with their fixtures and specs, an `api-stack` project, and an orchestrator
that had to start two shapes of world.

A no-ignore grep of every clone on the workbench found **zero** consumer files
using it. The one trace outside this package is a prose mention in one
repository's testing chapter.

The mode was also the source of a whole class of confusion the surveys kept
finding: two ways to say what the subject is (`server` and a compose service),
two names for one service (its record key and its `composeName`), and a set of
rules whose only job was to keep the two from contradicting each other.

## Decision

Compose mode leaves, with no deprecation window: none opens for a consumer that
does not exist.

What goes: `mode`, `TEST_MODE`, the `docker/compose.test.yaml` binding,
`composeService`, `src/integrations/compose/`, the api facet's fetch adapter,
rules A5, A6, A6w, A10 and I3 with every fixture and spec of theirs, and the
`api-stack` project.

The record KEY becomes the only name a service has: `serviceName`, assigned
from the key at start, and the init script a database runs is read from
`<root>/docker/<serviceName>/init.sql`. `ROOT_MARKERS` collapses to
`package.json`.

## Consequences

- One shape of world: a specification starts the services its record declares
  and hands the subject to `server`. An agent that knows one facet knows them
  all, and the orchestrator has one path through startup instead of two.
- A consumer config naming a removed rule id fails oxlint's unknown-rule check
  — the same failure mode ADR-002 had for J1/J3/J4/J5, and the survey found no
  consumer config naming any of the five.
- A future need to drive a deployed stack is not closed: `process()` is the one
  shape an external process takes in either slot, and `url` already targets a
  world this run did not start. What is closed is a SECOND vocabulary for it.
- The package's own specs lost the one place where a spec reached past the
  public entry to build an `Orchestrator` by hand; both were rewritten through
  the entry, which is what rule F3 asks of every consumer.
