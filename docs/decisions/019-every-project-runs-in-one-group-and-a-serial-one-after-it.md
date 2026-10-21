# ADR-019: Every project runs in one group, and a serial one after it

**Status:** Accepted
**Date:** 2026-10-21

## Context

ADR-003 kept the component project's Chromium from sharing a slot with the
website project's on a two-vCPU runner through `sequence.groupOrder`, and the
helpers came to set four groups: every node project in 0, then `website`,
`component` and `mobile` in 1, 2 and 3. Vitest runs groups one after another,
so the website, component and mobile files waited for the slowest file of
group 0 and then ran on a machine mostly idle. The worker count is no longer
a fixed guess: it is the toolchain's capacity model, which sizes the run to
the machine and to the gates beside it. That consequence of ADR-003 is the one
this record replaces; the rest of ADR-003 stands.

## Decision

- Every project runs in group 0, on the one pool of workers the capacity
  model sizes: a website file takes a worker as a node file does, and the
  component pages run beside them in their one Chromium.
- A project whose files run one at a time (`serial`, and `mobile()` unless
  it states `serial: false`) runs in group 1, after them. Vitest refuses one group whose projects resolve two
  worker counts, which a serial project meets in group 0.
- `projectTest` in `src/vitest/project.ts` is the one place a group is set;
  no helper states its own.

## Consequences

- A run's length is its longest worker, not the sum of four groups.
- Two browser projects may now share the machine at once; the capacity model,
  not the group order, is what keeps a small runner from oversubscribing.
- A serial project still waits for every other one, so a slow serial project
  is a cost the run pays at its end.
