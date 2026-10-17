# ADR-010: A string is a value, and the disk is named by a path the test writes

**Status:** Accepted
**Date:** 2026-09-22

Written 2026-09-27 from the working page of the 17 release, where the owner
took this decision on 2026-09-22 and its follow-ups on 2026-09-23; it was
folded here when that page was deleted.

## Context

The 17 release set one goal: a test reads without knowing any hidden
convention: everything it touches is visible on the line that touches it.
16 broke it wherever a test touched the disk. A bare string was sometimes a
value and sometimes a file name resolved against a folder the line never
said: `toMatch('scaffolded.txt')` read `_expected/scaffolded.txt`,
`seed('subscribers.sql')` hid both its folder and whether it was the leaf's or
the shared one, and `$FIXTURES/` was a magic prefix for the shared pool.

Two shapes were weighed. The first gave every verb that reads the disk a
`...File` or `...Directory` twin (`seedFile`, `requestFile`, `fixtureDirectory`,
`toMatchFile`, `runFile`), each taking a typed relative path. It doubled the
vocabulary and still let a verb's name, not its argument, say where a thing
lives. The second kept the simple verbs and moved the whole question into the
argument.

## Decision

The second. A string is a value, everywhere; the disk is named by one of two
calls, `file()` and `directory()`, whose argument is a path relative to the
spec file, spelled in full (`./...`, `../...`). The verbs keep their simple
names and take either:

- `seed`, `request`, a request body, `fixture` and `run` take a `file()` or a
  `directory()`; `toMatch` compares a whole result to a value written in
  place or to a `file()`/`directory()`. On a plain string `toMatch`, `toBe` and
  `toContain` are vitest's, untouched.
- No `...File` or `...Directory` verb exists, `runFile` included, and no prefix
  names a pool: the shared ground is reached by the path that climbs to it.
- A path is built in the test that stands on it, never in a helper: it
  resolves against the spec that starts the chain, so a helper would name a
  different file for every caller. A helper takes the `file()` as a parameter.
- Four guards hold a path, one per level: the type (a branded relative path),
  the role (the verb and the ground folder agree), the locality (a path leaves
  its leaf only by climbing) and the existence (the checker statically, the
  runtime with the path it resolved to).

The laws are [21: Assertions](../reference/assertions.md#one-verb-compares-a-whole-result-and-its-argument-says-where-the-expectation-lives)'s
and [23: Conventions § The naming recap](../concepts/conventions.md#the-naming-recap)'s;
the rows are `disk-named-by-relative-path`, `verb-reads-its-ground-folder`,
`no-reach-into-sibling-ground`, `named-path-exists` and
`paths-named-in-the-test`.

## Consequences

- `file()` repeats on every verb, `seed` and `request` included, accepted by
  the owner as the price of one spelling for the disk.
- A stream compared as a value is its comparable text, `result.stdout.text`,
  never the stream: vitest's `toContain` would read a stream as an empty list,
  so the types refuse it.
- A spec document's `fixture:` key takes the same path, with the trailing `/`
  saying a directory, and is judged by the same four guards
  ([15: Spec documents § Paths](../guides/spec-documents.md#paths)).
