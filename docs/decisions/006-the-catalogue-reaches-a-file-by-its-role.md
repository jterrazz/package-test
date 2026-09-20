# ADR-006: The catalogue reaches a file by its role, states its reach, and is born on a count

**Status:** Proposed
**Date:** 2026-09-20

## Context

The catalogue of 15.x held sixty-odd rows and could not answer three questions
a reader asks of any one of them: which files does this reach, what do I do
about it, and what proves it is true.

**Reach was a path segment.** Five rules gated on `parts.includes('specs')` or
`includes('src')` — I2, I4, J2, d12w, d15w — and each of them drew the line in
a slightly different place. The consequences were not theoretical: a sleep in a
module test beside `src/` was invisible to J2, while the same sleep two folders
away failed a build; a repository's consistency suite was an "orphan module
test" to I2 because it sat under a folder called `specs`. The gate was also
unreadable: nothing in a row said which files it judged, so the only way to
find out was to read the implementation.

**A row could not say what to do.** A ban with no destination is an argument
rather than a rule, and forty-odd messages ended on `see docs/13-linting.md`
with no fragment — a route to a chapter, not to a row. Nothing failed when a
heading moved, so the routes rotted silently.

**Nothing said which pass a finding came from.** The manifest's `channel` field
was a union a row could name loosely, and three of the seven values (`type`,
`meta`, `upstream`) had no rows at all: the conventions they stood for were
held by tests nobody could find from the catalogue, or by nothing.

**And a row could be born out of nothing.** The A-family's `allowedPrefixes`
story is the warning: a rule shipped at `error` on a shape no consumer had ever
been run against, and every consumer paid for it.

## Decision

### One gate, by role

**One gate, by ROLE.** `roleOf(file)` returns `{ role, inSpecs, legacyDir }`,
and the role is read from the SUFFIX: `.specification.ts(x)`, `.spec.yaml`,
`.spec.ts`, `.test.tsx`, `.test.ts`, `vitest.config.*`, a ground ancestor, a
`contracts/` ancestor. A statique rule reads those three fields and nothing
else of the path. A tree is read only by the checker passes that say they read
one — C1, C12, C18, C20, C21w.

### A row says what it reaches, and what to do

**Every row states its REACH and its FIX**, both required by the type, and the
fix is one imperative line the message carries too.

### Seven channels, each answering for its rows

**Seven channels, one per row** — `statique`, `upstream`, `checker`, `runtime`,
`type`, `meta`, `process` — and each channel answers for its rows the way that
channel can: a rule file and a fixture pair, an assertion on the resolved
option, a bundled pass, a `// RUNTIME <ID>` marker above the spec that drives
the refusal, an `@ts-expect-error` in `src/type-channel.test-d.ts`, a named
meta-test. One meta-test holds that contract for all seven.

**English, and anchored.** Every sentence the catalogue publishes is English
(K5 holds the line with a deny-list of the tokens the manifest actually
carried), and every message ends with a generated `(<ID> — <chapter>#<rule>)`
tail whose anchor is asserted to exist (K3).

### A row is born on a count

**A row is born on a COUNT.** A rule is written when its defect class has been
seen once and its criterion is decidable. A class nobody has seen is a backlog
line with its criterion written, coded on its first occurrence. The R8 dry run
— the whole catalogue run over every clone of the workbench, read-only — is
what settles which of the two a row is, and it is re-run before the major is
cut. The counts of the 2026-09-20 run:

| rule                               | total | where                                                                                                                                        |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `b4-given-then`                    | 2575  | jterrazz-design 902, signews-mobile 532, archive 419, hoverfly-lsp 246, extensions 216, package-attestation 144, spwn 104                    |
| `b11-marker-one-line`              | 242   | package-test 162, signews-api 40, hoverfly-lsp 13, jterrazz-web 5, spwn 4, package-typescript 4, archive 4, jterrazz-studio 3, jterrazz-os 2 |
| `i2-sibling-test-naming`           | 222   | archive 169, signews-mobile 35, hoverfly-lsp 13, package-typescript 2                                                                        |
| `c12-spec-file-name`               | 208   | spwn 42, package-test 35, package-typescript 35, jterrazz-web 24, signews-api 15, signews-mobile 8, jterrazz-os 6, package-attestation 6     |
| `j6w-given-in-the-test`            | 165   | archive 54, package-test 41, signews-api 19, package-typescript 17, hoverfly-lsp 14, jterrazz-os 6, spwn 6                                   |
| `d18w-existence-only-oracle`       | 91    | package-test 41, archive 13, hoverfly-lsp 13, jterrazz-os 8, package-telemetry 4, package-intelligence 3                                     |
| `d16w-ambient-value`               | 57    | signews-api 36, package-test 10, archive 6, hoverfly-lsp 2, jterrazz-os 2                                                                    |
| `c18-module-test-under-facet`      | 44    | package-typescript 22, jterrazz-web 10, signews-web 2, spwn 2, spwn-web 1                                                                    |
| `d19w-probe-cluster`               | 36    | package-typescript 14, spwn 7, jterrazz-web 5, jterrazz-os 5, archive 2                                                                      |
| `e9w-env-assignment-in-test`       | 27    | package-test 26, jterrazz-os 1                                                                                                               |
| `w5w-scenario-settles`             | 26    | jterrazz-os 13, package-test 9, cap01 1, jterrazz-web 1, signews-mobile 1                                                                    |
| `i4-no-module-doubles`             | 25    | signews-mobile 13, archive 5, package-test 2, package-intelligence 2, jterrazz-web 1, package-typescript 1, signews-api 1                    |
| `e2-preset-config`                 | 11    | package-test 8, spwn 2, archive 1                                                                                                            |
| `j2-no-sleep`                      | 9     | package-test 4, archive 2, jterrazz-os 1, signews-mobile 1, spwn 1                                                                           |
| `d17w-double-only-oracle`          | 8     | signews-api 4, signews-mobile 4                                                                                                              |
| `c21w-ground-owned-by-one`         | 4     | spwn 2, jterrazz-web 1, signews-api 1                                                                                                        |
| `e7w-include-prefix-exists`        | 3     | package-test 3 (its own violation fixtures; the one spwn case the survey named has since been fixed)                                         |
| `b10-when-between-markers`         | 2     | spwn 1, archive 1                                                                                                                            |
| `f6-no-foreign-test-runtime`       | 2     | signews-web 1, package-test 1                                                                                                                |
| `d16-sampled-oracle`               | 1     | package-test 1 (the test that proves `clock.at()` pins the reading)                                                                          |
| `e4w-project-binding`              | 1     | package-test 1 (the `api-stack` project compose mode left behind)                                                                            |
| `w2-testid-states-what-is-missing` | 1     | package-test 1 (its own fixture — zero uses of the escape hatch anywhere)                                                                    |

Four rows were at zero with no new surface to be the boundary of, and the gate
moved them to the backlog with their criteria written: **B12** (a marker inside
a declarator chain), **C19** (backend ground under a screen facet — the
component facet that was its reason stopped being a folder when component tests
became colocated), **D21w** (a volatile literal in a golden: 108 findings, every
one a publication date the PRODUCT pins rather than a value a run minted; once
the criterion excludes midnight UTC, which a clock read never is, it falls to
zero) and **D22w**. Three rows ship at zero as the boundary of a surface born
with them: **W2** (the escape hatch nobody uses yet), **E8** (the literate door
the `cli()` helper now defaults) and **C20** (folder = constructor, which the
`integration` facet of 15.3 is the first new folder to answer to).

The chapters are renumbered ONCE, in the same release, so a link repointed by
this change is repointed for good. The renumbering itself is block B's.

## Consequences

- A reader deciding whether a rule applies to the file in front of them reads
  the row, never the implementation; a rule that wants a different reach must
  change `roleOf`, where every rule sees it at once.
- The three channels that were empty carry rows, and a row of any channel that
  loses its proof fails a meta-test rather than going quietly stale.
- The gate costs rules: four written, tested and fixtured rows went to the
  backlog on the strength of the dry run. That is the price of the criterion,
  and the criterion is the reason a consumer can trust a new `error`.
- A count is evidence of a CLASS, not a migration estimate: `b4-given-then` at
  2575 is narration debt that is already baselined everywhere, and no row's
  tier is decided by how expensive it would be to fix.
- Every consumer's first 16.0 run is a baseline update. The counts above are
  what that update will hold.
