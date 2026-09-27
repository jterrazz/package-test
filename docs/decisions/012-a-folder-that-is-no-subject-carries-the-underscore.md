# ADR-012: A folder that is no subject carries the `_` marker

**Status:** Accepted
**Date:** 2026-09-26

Written 2026-09-27 from the working page of the 17 release, where the owner
took this decision on 2026-09-26; it was folded here when that page was
deleted.

## Context

16 marked the ground a spec stands on with an underscore — `_fixtures/`,
`_seeds/`, `_requests/`, `_expected/`. The first plan for 17 dropped the
marker: four bare names, reserved under `specs/`, read better in a path, and
the rules refused a facet or a domain that took one of them. The tree ran on
bare names through most of the release.

Three things then weighed the other way. The reserved set grew: the
TypeScript that prepares specs — a test adapter, a shared value, a helper, a
stub facade — had no home but a `*.fixtures.ts` beside the specs or a
`doubles/` of the author's naming. A subject's folder became DERIVED from its
route, command or job, so a subject may take any word: `GET /requests` wants
`api/requests/list/`, and a bare reserved name collides with it. And a marker
on the folders that live among content is the ecosystem's convention —
Jest's `__tests__` and `__mocks__`, Next.js's `_components` private folders —
so a reader meets it already knowing it means "not a route".

## Decision

A folder under `specs/` whose name starts with `_` is never a subject, and a
subject never starts with `_`. The `_` names are a closed list: `_setup/`
for the code that prepares specs, the four ground folders, and `_shared/`
directly under the specs root. A bare `seeds/`, `expected/` or `doubles/`
holding no spec is refused with its `_` spelling.

One placement law holds code and data alike: a shared thing sits in the
reserved folder of the lowest folder its readers share, and `_shared/` only
across facets. No `package.json` `imports` alias is added by default: a
relative import states the placement the law judges.

The law and its rows are
[18 — Conventions § The naming recap](../18-conventions.md#the-naming-recap)'s.

## Consequences

- A subject name never collides with a reserved one, whatever the product's
  routes are called.
- A `*.fixtures.ts` under `specs/` is refused: a module that prepares specs is
  named for what it holds and lives in a `_setup/`.
- A path climbs to what it shares, so a seed several subjects read is reached
  by `../`, and where it sits tells a reader what a change to it reaches.
- No mover renames a bare tree: a consumer moves by hand, then `make fix`
  places the shared ground.
