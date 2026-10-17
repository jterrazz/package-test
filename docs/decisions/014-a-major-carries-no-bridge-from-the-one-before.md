# ADR-014: A major carries no bridge from the one before

**Status:** Accepted
**Date:** 2026-09-26

Written 2026-09-27 from the working page of the 17 release, where the owner
set the exit plan on 2026-09-23 and revised it on 2026-09-26; it was folded
here when that page was deleted.

## Context

17 renames most of what a 16 consumer writes: the ground folders, the verbs
that read the disk, the stubs, every rule id. The release first grew a
bridge for it: a mover that rewrote a 16 tree into 17 under
`jterrazz-test-check --fix`, a rule recognising a 16 folder, rename maps for
the rule ids a suppression or a ratchet key names, a refusal of a leftover
per-package baseline, and a floor version the toolchain checked the checker
against.

Every piece of it was code whose only reader was the world 17 replaces.
Each needed its own specs, it grew with every rename, and it kept the old
spellings alive in the package that had just retired them, the ids a
closing audit would have to find again.

## Decision

A major ships no bridge. No mover, no rename map, no rule whose only job is
to recognise the previous major's forms, no detection of a leftover file and
no floor kept for an older checker: each is deleted in the release that
would have needed it. Consumers move by hand, or through agents, during the
migration wave that follows the release; the rules of the new major name
what is wrong in their own terms, and a directive naming a retired id is dead
and reported like any other: an `oxlint-disable` by oxlint's
`reportUnusedDisableDirectives`, a ratchet key by the ratchet (a key at zero
below its entry fails it), a `checker-disable` by
`checker-suppression-names-a-pass`. A `checker-disable` naming a live pass
over a line that pass no longer flags is not detected.

The same holds for a peer range: 17 requires `@jterrazz/typescript ^11` and
no `^10` range, so the toolchain's major ships first.

## Consequences

- The package holds only the present: no code, chapter, spec or catalogue row
  names a retired form.
- Migrating a consumer costs a wave of hand or agent work per major, paid
  once, where a bridge would have been paid by every release after it.
- A consumer that bumps without migrating goes red on the rules themselves,
  in their four-part messages: the migration's instructions are the findings.
