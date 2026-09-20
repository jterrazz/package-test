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
`contracts/` ancestor. A statique rule reads those three fields and, where it
must know where the file sits, the ONE package-bounded anchor every pass shares
(`specsAnchor` in `src/lint/ast.ts`) — never a bare path segment. The rules
that need it say so: C1, C4, C8, C13, F2, F3, I1, I4. Walking a TREE is the
checker's — C1's depth, C12, C18, C20, C21w.

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
carried), and every message the PLUGIN ships ends with a generated
`(<ID> — <chapter>#<rule>)` tail whose anchor is asserted to exist (K3). A
checker finding carries its id and its chapter; several of its passes report
under a family code (`d4`, `d4b`, `d10w`) rather than a row name, so the tail
routes to the chapter and the id says which row.

### A row is born on a count

**A row is born on a COUNT.** A rule is written when its defect class has been
seen once and its criterion is decidable. A class nobody has seen is a backlog
line with its criterion written, coded on its first occurrence. The R8 dry run
— the whole catalogue run over every clone of the workbench, read-only — is
what settles which of the two a row is, and it is re-run whenever a criterion
changes. The counts below are the run of 2026-09-20, re-run after the fix pass
that bounded six false classes: 27 clones plus the estate's own `apps`,
`packages` and `specs`, with each package's own violation FIXTURES excluded —
they violate on purpose, and counting them would let a rule justify itself.
`jterrazz-web-astro-react` and `signews-web-astro` are not repositories: they
are clones of `jterrazz-web` and `signews-web` checked out on a merged
experiment branch, counted here as the folders the run walked.

| rule                          | total | where                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `b4-given-then`               | 2569  | jterrazz-design 902, signews-mobile 532, archive 419, hoverfly-lsp 246, extensions 216, package-attestation 144, spwn 104, package-typescript 4, package-test 2                                                                                                                                                                       |
| `b11-marker-one-line`         | 240   | package-test 160, signews-api 40, hoverfly-lsp 13, jterrazz-web-astro-react 5, jterrazz-web 5, archive 4, package-typescript 4, spwn 4, jterrazz-studio 3, jterrazz-os 2                                                                                                                                                              |
| `i2-sibling-test-naming`      | 224   | archive 169, signews-mobile 35, hoverfly-lsp 15, package-typescript 2, jterrazz-design 1, package-test 1, spwn 1                                                                                                                                                                                                                      |
| `c12-spec-file-name`          | 180   | spwn 40, package-test 37, jterrazz-web 22, jterrazz-web-astro-react 21, signews-api 15, package-typescript 9, signews-mobile 8, jterrazz-os 6, package-attestation 6, package-intelligence 3, signews-web 3, jterrazz-design 2, jterrazz-studio 2, spwn-web 2, cap01 1, package-analytics 1, package-broadcast 1, signews-web-astro 1 |
| `j6w-given-in-the-test`       | 165   | archive 54, package-test 41, signews-api 19, package-typescript 17, hoverfly-lsp 14, jterrazz-os 6, spwn 6, package-telemetry 4, signews-mobile 2, package-analytics 1, package-intelligence 1                                                                                                                                        |
| `d16w-ambient-value`          | 57    | signews-api 36, package-test 10, archive 6, hoverfly-lsp 2, jterrazz-os 2, signews-mobile 1                                                                                                                                                                                                                                           |
| `e9w-env-assignment-in-test`  | 49    | package-test 47, jterrazz-os 2                                                                                                                                                                                                                                                                                                        |
| `d18w-existence-only-oracle`  | 37    | package-test 14, hoverfly-lsp 10, archive 4, package-intelligence 2, signews-mobile 2, jterrazz-os 1, jterrazz-web-astro-react 1, jterrazz-web 1, package-typescript 1, signews-api 1                                                                                                                                                 |
| `c1-domain-structure`         | 33    | jterrazz-os 26, package-typescript 7                                                                                                                                                                                                                                                                                                  |
| `c18-module-test-under-facet` | 31    | package-typescript 27, jterrazz-web 2, spwn 2                                                                                                                                                                                                                                                                                         |
| `i4-no-module-doubles`        | 23    | signews-mobile 13, archive 5, package-intelligence 2, jterrazz-web 1, package-typescript 1, signews-api 1                                                                                                                                                                                                                             |
| `d19w-probe-cluster`          | 22    | package-typescript 7, spwn 6, jterrazz-os 3, jterrazz-web 3, archive 2, jterrazz-web-astro-react 1                                                                                                                                                                                                                                    |
| `f2-no-test-imports-in-prod`  | 21    | package-test 13, jterrazz-design 3, archive 2, package-manifest 2, hoverfly-lsp 1                                                                                                                                                                                                                                                     |
| `e3-config-present`           | 17    | archive 16, extensions 1                                                                                                                                                                                                                                                                                                              |
| `d12w-response-body-probe`    | 14    | signews-api 9, archive 5                                                                                                                                                                                                                                                                                                              |
| `d15w-status-only-probe`      | 14    | package-test 4, archive 3, jterrazz-os 3, jterrazz-web-astro-react 2, jterrazz-web 1, signews-api 1                                                                                                                                                                                                                                   |
| `d5w-spec-pinned-value`       | 10    | jterrazz-os 9, package-test 1                                                                                                                                                                                                                                                                                                         |
| `d8w-text-bypass`             | 9     | jterrazz-web-astro-react 3, jterrazz-web 3, archive 2, spwn 1                                                                                                                                                                                                                                                                         |
| `c9-dead-fixtures`            | 8     | package-test 7, spwn 1                                                                                                                                                                                                                                                                                                                |
| `d17w-double-only-oracle`     | 8     | signews-api 4, signews-mobile 4                                                                                                                                                                                                                                                                                                       |
| `j2-no-sleep`                 | 8     | package-test 3, archive 2, jterrazz-os 1, signews-mobile 1, spwn 1                                                                                                                                                                                                                                                                    |
| `w5w-scenario-settles`        | 8     | package-test 4, cap01 1, jterrazz-web-astro-react 1, jterrazz-web 1, signews-mobile 1                                                                                                                                                                                                                                                 |
| `a1-specification-file`       | 7     | package-test 7                                                                                                                                                                                                                                                                                                                        |
| `e2-preset-config`            | 6     | package-test 3, spwn 2, archive 1                                                                                                                                                                                                                                                                                                     |
| `c21w-ground-owned-by-one`    | 5     | spwn 2, jterrazz-web-astro-react 1, package-attestation 1, signews-api 1                                                                                                                                                                                                                                                              |
| `d5-spec-volatile-literal`    | 3     | package-test 3                                                                                                                                                                                                                                                                                                                        |
| `e7w-include-prefix-exists`   | 3     | spwn 2, package-test 1                                                                                                                                                                                                                                                                                                                |
| `f5-fixtures-only-from-tests` | 3     | jterrazz-design 3                                                                                                                                                                                                                                                                                                                     |
| `f8-no-seam-dependency`       | 3     | archive 1, jterrazz-design 1, spwn 1                                                                                                                                                                                                                                                                                                  |
| `b10-when-between-markers`    | 2     | archive 1, spwn 1                                                                                                                                                                                                                                                                                                                     |
| `e4w-project-binding`         | 1     | package-test 1                                                                                                                                                                                                                                                                                                                        |
| `f6-no-foreign-test-runtime`  | 1     | signews-web 1                                                                                                                                                                                                                                                                                                                         |

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

Two rows ship at zero for a reason the re-run wrote itself. **D16** is the
error half of a class d16w counts 57 times: the one occurrence the first run
found was a test that PINS its clock and then reads it, which is what the rule
tells an author to do — so the exemption that made it disappear is the rule
working. **J9** has no occurrence because the toolchain's suppression gate
reads `oxlint-disable*` and nothing else: the checker's own directive has never
been held by anything, and the 16 of them on the workbench were written under
no obligation to say why.

Six false classes the re-run bounded, each of which had made a row look larger
than it is: C18 read a spec importing `../x.specification` (no extension) as
reaching no runner — 13 of its 44; C12 and C18 both claimed the same file, and
`--fix` performed the wrong one; C21w counted a golden named through a template
as no reader at all; W5w read a `db.select()` as a visitor's action and every
component test as a screen scenario — 13 of its 26 were the estate's console;
D18w called a precise negative (`not.toHaveBeenCalled()`) an existence check;
D19w called three reads of one `value` a cluster.

The chapters are renumbered ONCE, in the same release, so a link repointed by
this change is repointed for good.

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
