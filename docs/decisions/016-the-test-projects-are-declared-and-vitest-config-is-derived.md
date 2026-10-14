# ADR-016: The test projects are declared, and vitest.config.ts is derived

**Status:** Accepted
**Date:** 2026-10-03

## Context

A repository wrote its `vitest.config.ts` by hand: `defineSpecConfig()` and
one helper call per project, with whatever else vitest accepts beside them.
Six rules existed to hold that file to its intended shape — that it started
from `defineSpecConfig`, that a project was named for its facet, that a
browser block came from `component()`, that a member with tests kept one,
that it named no simulated DOM. `@jterrazz/typescript` now derives every
file an editor discovers from `jterrazz.config.ts`, which declares what the
project is ([its ADR-018](https://github.com/jterrazz/package-typescript/blob/main/docs/decisions/018-a-project-declares-what-it-is-and-every-config-follows.md)),
and the `test()` preset hands it the files it owns.

## Decision

- The projects a repository runs are `test.projects` in `jterrazz.config.ts`:
  each a `facet` — one of the helpers this package ships — the options that
  helper takes, and the global setups it runs (`setup`).
- `vitest.config.ts` is the file the `test()` preset derives,
  `export default await vitestConfig(import.meta.url)` from
  `@jterrazz/test/vitest`, which reads the `jterrazz.config.ts` beside the
  config module — never the directory vitest runs in, which dropped every
  declared project when vitest started elsewhere — and builds each project
  with its helper over the preset. It is the one shape of the toolchain's
  derived editor files, never a bare re-export: knip skips a config that
  only re-exports from a package, and its loader, like vitest's, reads a
  module that awaits at its top.
- The rules whose object was a hand-written config retire with it:
  `vitest-config-from-define-spec-config`, `project-named-for-its-facet`,
  `browser-project-from-component` and `member-has-vitest-config`. The
  toolchain's Config pass holds the derived file, and a project's helper
  sets its name and its browser. The rules that read a project's options —
  `include-points-at-a-folder`, `literate-specification-exists`,
  `no-simulated-dom-in-config` — read `jterrazz.config.ts` instead.
- The preset collects coverage from the processes a suite spawns
  (`autoAttachSubprocess`) and judges `dist/` after the remap
  (`excludeAfterRemap`), which this repository's own config used to add.

## Consequences

- Every repository's `vitest.config.ts` is one identical file, and what its
  tests run is read in the one settings file, with the rest of what it is.
- A project can no longer pass vitest an option no helper takes; one that
  needs it is a helper option this package adds.
- The derived config reads the `jterrazz.config.ts` of the config's own
  directory, for `npm test`, the Vitest extension and knip alike.
