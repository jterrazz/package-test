# ADR-015: A rule a project ships is the lint facet

**Status:** Accepted
**Date:** 2026-09-27

The owner decided it on 2026-09-27, approving the rules kit, lint facet and
preset plan whole.

## Context

A package of the family ships rules: an oxlint plugin, a cross-file checker,
the laws a `@jterrazz/typescript` preset hands the toolchain. This package
specified its own through a wrapper: `specification.cli(report.sh)`, a shell
script dispatching on its first word to oxlint (with a standalone JSON config
listing every rule), to the checker (through a second wrapper), to the self
checker, or to a Node script that wrote a `jterrazz.config.ts` into the tree
and captured the toolchain's stdout. `lintReport`, published from the
package root, cut every report to `file:line:column  plugin(rule)`, and the
234 rule specifications were `<case>.spec.yaml` documents collected into the
`unit` project.

Every consumer that ships a rule would have had to build the same harness,
and the harness had drifted from what a rule is: the report dropped the
message, so no golden proved what a rule teaches; the preset's laws ran
through a stdout parse; the unit tests of a rule bound oxlint's `RuleTester`
to vitest by hand, and nothing held a case to state where it reports.

## Decision

A rule is a subject a team tests, like a binary, so it is a facet — the
seventh constructor:

- `specification.lint({ plugins, config, presets, checkers, root })` names the
  linters: oxlint JS plugins run by the real oxlint under the given config,
  the presets' laws run in process through `presetChecks` of
  `@jterrazz/typescript/rules`, and checkers run as commands in the
  compiler's line convention. The chain takes `.fixture()` and `.rules()`
  and ends in `.run({ fix, args })`.
- The result's `report` is the one golden: each finding at its
  `file:line:column  plugin(rule)`, then its lesson a part per line, in the
  order a reader walks the tree. `lintReport` is no longer published.
- `ruleTester()` is oxlint's `RuleTester` bound to vitest, and it refuses an
  invalid case whose errors do not each state a `line` and a `column`.
- `oxlint` is an optional peer. `@jterrazz/typescript` stays a required
  peer: the root entry's refusals, ground folders and ratchet are the rules
  kit's, and a peer the entry imports at load cannot be optional.

This package dogfoods it: `specs/lint/` is the facet's folder, one spec per
rule over its fixture trees on five runners, and the wrappers, the
standalone configs and the documents are gone. The checker's own command
line — the ratchet, `baseline`, `--member` — is a binary, so its specs moved
to `specs/cli/`.

## Consequences

- A report golden carries each lesson whole: a reworded message moves its
  golden, which `TEST_UPDATE=1` rewrites. A lesson echoing a `{{token}}` is
  covered by `{{string}}`, since the token grammar has no escape.
- A rule spec names its linters in a specification, so a fixture meant for
  one channel is never judged by another; a spec needing both writes both.
- The facet folder is a facet like any other: `.spec.ts`, one describe per
  file, the line limits, the depth law. The repository suite named `lint/`
  is gone; `surface/` is the one suite name the estate shares.
- Rule unit tests state a position for every error, which the type and the
  runtime both hold — 270 cases were given the line and column they fire on.
