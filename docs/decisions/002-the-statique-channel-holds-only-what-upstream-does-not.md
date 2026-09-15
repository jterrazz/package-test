# ADR-002: the statique channel holds only what upstream does not

**Status:** Proposed
**Date:** 2026-09-15

## Context

The statique channel grew by writing a rule for every mechanizable convention,
without asking whether oxlint already carried one. Four hygiene rules ended up
restating rules of oxlint's own `vitest` plugin — J1 (`.only`/`.skip`), J3 (an
assertion per test), J4 (unique literal titles), J5 (a lowercase title).

That cost nothing while the plugin was off. `@jterrazz/typescript` v10 turns it
on over the test globs in every profile, so a consumer composing
`compose(node, testing)` gets both layers: one violation reported twice, two
ids to suppress, and two normative sentences that have to be kept in step by
hand — the drift this package's docs-as-code inversion exists to prevent.

## Decision

A convention an upstream oxlint rule already enforces belongs to that rule. The
statique channel holds only the residue: what no loaded plugin carries.

Equivalence is proved before a rule is deleted, on this package's own fixtures
and on both the installed oxlint and the version the preset pins — every
invalid sample of the rule's test must fire the upstream rule, and every valid
sample must stay silent. A rule that catches something upstream misses is kept
and narrowed to that residue.

The four were proved equivalent and deleted (`vitest/no-focused-tests` +
`vitest/no-disabled-tests`, `vitest/expect-expect`, `vitest/no-identical-title`,
`vitest/prefer-lowercase-title`). J2, the arbitrary-sleep ban, has no upstream
counterpart and stays.

## Consequences

- Breaking for consumers: `jterrazz/j1-no-only-skip`,
  `jterrazz/j3-no-expectless-test`, `jterrazz/j4-unique-test-names` and
  `jterrazz/j5-lowercase-title` no longer exist, and a config still naming one
  fails oxlint's unknown-rule check.
- The hygiene floor now reaches this package only through the base preset. A
  repository that adopts the conventions without `@jterrazz/typescript` wires
  `plugins: ['vitest']` itself — the catalogue chapter says which rules.
- One behaviour is configuration, not code: `prefer-lowercase-title` flags an
  all-caps first word (`VALID_CATEGORIES`, `HTTP`, `DI`) that J5 exempted, and
  `allowedPrefixes` restores the exemption.
- The rule of growth changes with it. A new mechanizable defect class (K1) is
  now searched for upstream first, and a rule is written here only where the
  search comes back empty.
