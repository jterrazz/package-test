# ADR-017: A special folder is spelt `__<word>__`, and a module test sits in `__tests__/`

**Status:** Accepted
**Date:** 2026-10-06

Supersedes [ADR-012](012-a-folder-that-is-no-subject-carries-the-underscore.md).

## Context

ADR-012 marked a folder that is no subject with one `_`: `_setup/`, the
four ground folders, and `_shared/` at the specs root. Two things weighed
against it once the tree ran on it.

One `_` is a prefix the ecosystem gives no meaning: a reader meets `_setup/`
and `_drafts/` spelt alike, and only a list tells them apart. The spelling
the ecosystem already reads as "not a route, the tooling's" is the double
one (Jest's `__tests__/` and `__mocks__/`, Python's `__init__`): a word
closed on both sides, which no subject's name takes by accident.

And `_shared/` was a folder of a kind no other folder was: a place named
for who reads its content rather than for what the content is. The
placement law already said where a shared thing sits (in the special
folder of the lowest folder its readers share), and the specs root is that
folder when the readers span specifications; `_shared/` restated the law
one level down, and made the root the one folder whose ground sat one step
away.

Module tests sat beside their modules (`foo.ts`, `foo.test.ts`), parity
with Go. Read in a folder listing, the tests double every module's entry,
and the conventional place JavaScript tooling looks for them is a
`__tests__/` folder of the module's folder.

## Decision

Every special folder is spelt `__<word>__`, and the list is closed and
lives once in the toolchain's kit (`@jterrazz/typescript/rules`), which
every tool's globs read: oxlint, oxfmt, knip, ls-lint, the tsconfig
presets (held to the list by a test, as JSON is literal) and the vitest
preset:

- under `specs/`: `__setup__/` for code, `__seeds__/`, `__requests__/`,
  `__expected__/`, `__fixtures__/` for data; at the specs root they hold
  what the specifications share, and there is no `_shared/`;
- in a code root (`src/`, `lint/`...): `__tests__/` alone, holding a
  module's tests, the typed data they read (`<file>.fixtures.ts`) and the
  ground they stand on.

`dir/foo.ts` is tested by `dir/__tests__/foo.test.ts` (rule
`test-in-its-tests-folder`, replacing `test-beside-its-module`). Every
other `_` name under `specs/` is refused with the list in its fix: an
unknown `__<word>__/`, a subject that starts with `_`, and an earlier
spelling, whose fix names its special folder (`_setup/` becomes `__setup__/`,
`_shared/` the special folders at the specs root). A bare `setup/` or
`shared/` holding no spec is refused with the same names. The rule names
follow: `underscore-name-in-closed-list` is `special-folder-in-closed-list`.

No mover ships and no earlier spelling is read: a consumer renames its
folders and moves its tests once, then `make fix` places the shared ground.

## Consequences

- A subject name never collides with a special one, and a reader tells a
  special folder from a subject by its spelling alone.
- The lowest-common placement law holds the specs root like any folder:
  root ground is shared ground, judged by `ground-shared-or-inline` like
  every other, and no fixer moves it under a folder of its own.
- Every reader of "the module beside the test" reads the folder above
  `__tests__/` instead: a test's `describe` subject, the mutation run's
  pairing of a source with its test, the self checks of this repository.
- A module test imports its module one folder up (`../foo.js`), and a path
  it builds from `import.meta.dirname` climbs one folder more.
- `no-module-mock` refuses `__mocks__/` alone: `__fixtures__/` is ground
  now, inside a `__tests__/` as under `specs/`.
