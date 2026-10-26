# ADR-018: The test projects are read off the tree, and a declared one is a reasoned exception

**Status:** Accepted
**Date:** 2026-10-21

Supersedes [ADR-016](016-the-test-projects-are-declared-and-vitest-config-is-derived.md).

## Context

ADR-016 moved the projects out of a hand-written `vitest.config.ts` and into
`test.projects` of `studio.config.ts`, as a list of entries each naming its
`facet`, its options and its setups. Two changes of 2026-10-05 left that
description behind. The word `facet` became `specification`, the name a user
types (`specification.api()`). And a repository's tree already said which
projects it runs (a `specs/<specification>/` folder, module tests under its
roots, rendered tests), so a list that repeated it was a second owner of the
same fact, free to forget a folder the tree held.

## Decision

- The projects a repository runs are read off its tree: one per folder
  `specs/<specification>/`, `unit` over each root holding a module test, and
  `component` over the component specs and each root holding a rendered test.
  A ground, setup or dot folder is never read.
- `test.projects` is a record keyed by the specification it shapes, and states
  only how that project departs from the one its tree derives (a helper's
  options, its own global setups), each entry with its `reason`. A key the
  package does not ship, an entry with no reason, and `projects` written as a
  list are refused in four parts.
- A project exists because the tree derives it, or because the repository's
  own file declares it; the package's standard only shapes a project that
  exists.
- What ADR-016 decided beside the list stands: `vitest.config.ts` is the
  toolchain's derived one-liner, `await vitestConfig(import.meta.url)` from
  `@jterrazz/test/vitest`, reading the `studio.config.ts` beside it; the
  rules whose object was a hand-written config stay retired, and the ones
  that read a project's options read `studio.config.ts`.

## Consequences

- A repository that adds a specification folder runs it with no line of
  configuration, and one that deletes the folder stops running it.
- Every declared line carries why it exists, so a departure that outlived its
  reason is visible in the one file a reviewer reads.
- A project can no longer be named for anything but a specification the
  package ships; a new kind of project is a helper this package adds.
