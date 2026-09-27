# ADR-011: A test compares its whole result, written in place by default

**Status:** Accepted
**Date:** 2026-09-23

Written 2026-09-27 from the working page of the 17 release, where the owner
took this decision on 2026-09-23 (variant B) and refined it on 2026-09-23
(SQL) and 2026-09-27 (seed builders); it was folded here when that page was
deleted.

## Context

[ADR-010](010-a-string-is-a-value-and-the-disk-is-named-by-a-path.md) named
the disk; it left open where an expectation lives. A first round moved the
api and job cases into `.spec.yaml` documents — the cli's grammar, a
`response:` golden, steps with captures, route coverage over a declared
OpenAPI file. Written out on a real application, the documents turned into
indexes of links: six lines pointing at five files, the opposite of a test
whose whole claim stands on its lines. The ground grew the same way, one file
per test, most of them read once.

## Decision

TypeScript, with the whole result written in the test:

- **One verb compares a whole result** — a response, a stream, a json, a
  table, a tree — and its argument says where the expectation lives: a value
  written in place, the default, or `file()`/`directory()`. A table is
  compared as its rows; `toMatchRows` does not exist.
- **A precise assertion only beside the whole one.** A test that reads a
  response, a json or a table holds one whole-result comparison; a probe of
  one field says which part of it the test is about, and probes with no whole
  comparison beside them are refused (`result-compared-whole`).
- **A file exists only if it is shared**, or past its role's cap — 30 lines
  for a request or a body, 150 for an expectation — and a value written in a
  test past its cap belongs in a file (`ground-shared-or-inline`).
- **SQL is never written in a test.** A seed is a `.sql` file, beside its one
  test or at the level of the tests that share it (`seeds-are-sql`). Typed seed
  builders are not adopted: a seed stays a file, a shared state named by its
  path.
- **Update mode writes the expectation where it lives**: `TEST_UPDATE=1`
  rewrites a value in the test source, as vitest rewrites an inline snapshot,
  and a file through its golden, keeping the tokens the old one held.
- **The api and job documents are retired**: grammar, runner, schema kinds and
  chapter sections. The cli and lint-rule documents stay: their output is
  written inline, and their fixtures are real trees
  ([20 — Spec documents](../20-documents.md)).
- **Route coverage reads the app's own route table** at the end of the api
  run, with a declared OpenAPI file as the fallback for an app that exposes
  none ([10 — API § Route coverage](../10-api.md#route-coverage)).

The laws are [14 — Assertions](../14-assertions.md#one-verb-compares-a-whole-result-and-its-argument-says-where-the-expectation-lives)'s
and [18 — Conventions § The naming recap](../18-conventions.md#the-naming-recap)'s.

## Consequences

- A test's claim is read on its own lines; a file on disk means a reader
  shares it, and where it sits says who.
- A long expectation stays in the test up to its cap, so a test body is
  capped by its gestures, never by its claim (`test-body-within-line-limit`).
- A value read only to be carried into a later request of the same test owes
  no comparison of its own: a cursor followed to the next page is part of the
  journey, not a claim.
- The fixers keep the tree on the law both ways: a single-use file is written
  into its test, a value past its cap is written out beside it.
