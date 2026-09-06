# ADR-001: v9 — conventions enforced on three channels

**Status:** Accepted
**Date:** 2026-07-17

Retroactive record, written 2026-09-04 from the v9 design lock (2026-07-17)
and the `@jterrazz/test@9.0.0` ship (2026-07-18, after a multi-agent review
campaign). Moved into this repository 2026-09-06, from the OS wiki where it
was ADR-003 — this package alone can falsify it, and the normative spec was
always here.

## Context

Testing conventions lived in prose and review habits; every consumer repo
drifted its own way, and partial assertions ("status is 200") hid silent
failures.

## Decision

v9 is specification-first: three constructors (`specification.api/jobs/cli`),
one `{{token}}` grammar across every fixture kind, and golden files (`.http`
_requests/responses, full-output text snapshots) as the default assertion — a
partial probe must earn its place as a deliberate scalpel.

Crucially, every convention is enforced on one of THREE channels, or
documents why it cannot be:

1. **Static** — oxlint rules living IN this package, so a rule versions with
   the API it describes, wired by `@jterrazz/typescript` through composable
   presets (`compose(node, testing)`).
2. **Meta-tests** — executed truths: every token matcher tested both ways,
   update-mode fixtures re-verified on the next run.
3. **Runtime** — strict errors: an outbound request with no matching intercept
   fails the spec.

Any newly discovered defect class must, in the same change, produce a rule on
one of the channels — the package's "rule K".

## Consequences

- Product specs live under `specs/<facet>/<domain>/`; unit tests are siblings
  of their module. A consumer's own conventions derive from this package,
  except where its doctrine states a more specific shape — the first such case
  is jterrazz-os's `docs/decisions/006-cli-specs-mirror-the-command-tree.md`.
- Migrations proved the value immediately: strict intercepts caught a real
  production-class bug in a consumer (an undrained handler), and dead test
  layers were deleted by the dead-fixture checker.
- The docs are code: each rule's normative text lives in its implementation's
  metadata and the catalog is generated — hand-synced convention documents are
  banned by construction.
