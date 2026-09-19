# ADR-004: A module against real services, or against a golden, is the integration facet

**Status:** Proposed
**Date:** 2026-09-19

## Context

The fork the corpus drew had two rungs: a module alone, tested beside its code
with no runner, and the assembled product behind an entry — HTTP, a binary, a
served page, a screen — specified through `specification.*`. A whole kind of
test fell between them, and every repository invented its own answer for it.

A module that needs a real database is one. signews-api kept a
global-setup file that built a sqlite template by hand and a project named
"integrations" running plain vitest, because no constructor covered "this
repository function, against the real schema". package-broadcast and
package-analytics did the same with a root tests folder and `vi.mock`.

A module whose oracle is a GOLDEN is the other. package-attestation's byte
contracts and package-intelligence's fifty-three input/output pairs are
golden-file tests, and both reached for `toMatchSnapshot` — a second golden
mechanism, with no token grammar, no `{ frozen }`, and no `TEST_UPDATE=1`,
living beside the one the package owns. Rule D20 could ban the matcher only
once the tests it serves had somewhere to go.

Neither case needed a new idea. Both needed a constructor.

Three shapes were weighed and refused:

- **Widen `jobs`.** `trigger(name)` takes no input and a job is
  `() => Promise<void>`, so the Given would have to leave the test and live in
  the specification file. A spec whose input is elsewhere is not a spec.
- **Plain vitest under a folder named for it.** The shape every repository had
  already reached, and the shape the evidence indicts: the services are
  hand-started, nothing resets between tests, and the goldens are somebody's.
- **`sqlite()` outside a runner.** A second lifecycle path for services — two
  answers to "when does this start and who stops it", which is the defect the
  orchestrator exists to prevent.

## Decision

`specification.integration({ services?, root? })` is the eighth kind of test
and the sixth constructor. Its subject is a MODULE; its terminal action is
`.call((services) => …)`, which hands the started record to the subject so it
is built with real connection strings; its result is `CallResult`.

`CallResult` has two readings and never both: `value` is what the call
returned — a `TextAccessor` for a string, a `JsonAccessor` for anything else —
and `error` is what it threw, as text, empty when it returned. Both are the
package's ordinary accessors, so `toMatch`, the `{{token}}` grammar,
`{ frozen }` and `TEST_UPDATE=1` reach them with no new mechanism.

The setups are the ones every facet already has: `.seed()`, `.intercept()`,
`.clock()`. Without `services` the constructor starts nothing: that is the
golden-only half, and it is the whole of what a fifty-three-row table needs —
one `.call()` inside `test.each`.

## Consequences

- **A refusal is a reading.** No `try`/`catch` in a spec, and no "it should
  throw" test that passes because nothing threw. A chain says "and it did not
  refuse" with `await expect(result.error).toBeEmpty()`.
- **D20 gains its destination.** `toMatchSnapshot` can be banned because every
  test it served now has a facet, a folder and a golden engine.
- **One more folder name is spoken for.** `specs/integration/` is a facet
  folder: singular, like `website/`, and holding a `*.specification.ts` at its
  root. The package renamed its own plural folder in the same change, and what
  lived there — probes of the container adapters themselves — moved to
  `specs/seams/`, which is what they always were.
- **An env-gated sub-suite stops being a project.** With `{ include, exclude }`
  on the helper, package-attestation's five projects become `unit()` plus one
  `integration()`.
- **A door closed.** A module test may not carry a golden (D20) and an
  integration spec may not assert only on doubles: the ladder's rungs are now
  distinguishable by where the test lives, which is what makes both
  mechanizable.
