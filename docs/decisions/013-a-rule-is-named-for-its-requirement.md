# ADR-013: A rule is named for its requirement, and a record keeps the ids it was written with

**Status:** Accepted
**Date:** 2026-09-26

Written 2026-09-27 from the working page of the 17 release, where the owner
took this decision on 2026-09-26 and its follow-up on 2026-09-27; it was
folded here when that page was deleted.

## Context

Every rule, checker pass, self lock and review principle answered to a
letter code — `c28-ground-shared-or-inline`, `d8w-raw-bypass`, `i11-engine-owner` —
a family letter, a number in the order rules were written, and a `w` suffix
for the warn tier. The code said nothing a reader could act on, the number
said only when a rule arrived, and one code covered several checker passes
(`c8`, `d4`, `d4b`, `d5`), so a finding keyed under it could not say which.

## Decision

- Every rule answers to ONE name that states its requirement, the same
  everywhere it is addressed. The naming law is
  [24 — Linting § The rule catalogue](../reference/linting.md#the-rule-catalogue)'s.
- A family is a word, the folder of its rules and the section of the
  catalogue. The warn tier is gone with the suffix: every rule errors, and its
  debt is held by the ratchet.
- A checker finding prints and keys under its pass's name, and a code that
  covered several passes became one name per pass.
- A decision record keeps the rule ids it was written with: a record states
  what was decided then, and rewriting it would make it say something it
  never said. The table below reads them.

## Consequences

- A finding, a suppression and a ratchet key say what they hold without the
  catalogue open.
- The records 001 to 009 cite the codes. The table maps each code to the
  name it took on 2026-09-26; a code it does not hold names a rule retired
  before the rename (the compose-mode rules of ADR-007, the upstream
  restatements of ADR-002, whose J-codes were later reused). A name may have
  moved or retired since: the catalogue says what holds now.

| Old id                                    | Name                                          |
| ----------------------------------------- | --------------------------------------------- |
| `e6-component-project-helper`             | `browser-project-from-component`              |
| `a4-cleanup-afterall`                     | `cleanup-passed-to-after-all`                 |
| `g3-docker-aware-capture`                 | `containers-removed-with-the-run`             |
| `a7-database-property`                    | `database-named-only-when-several`            |
| `a7-database-runtime`                     | `database-named-only-when-several-at-runtime` |
| `b5-await-using-inference`                | `docker-exec-bound-with-await-using`          |
| `c8-spec-registered-name`                 | `document-env-and-serve-registered`           |
| `e1-env-allowlist`                        | `environment-read-allow-listed`               |
| `m1-constructor-has-a-tree`               | `every-constructor-has-specs`                 |
| `e7w-include-prefix-exists`               | `include-points-at-a-folder`                  |
| `e8-literate-specification-exists`        | `literate-runner-exists`                      |
| `e3-config-present`                       | `member-has-vitest-config`                    |
| `g4-no-dom-in-module-test`                | `no-dom-in-module-test`                       |
| `e9w-env-assignment-in-test`              | `no-raw-env-write`                            |
| `a9w-redundant-root`                      | `no-redundant-root`                           |
| `a3-no-destructure-alias`                 | `no-runner-alias`                             |
| `a11-server-xor-url`                      | `no-server-with-url`                          |
| `e5-no-simulated-dom`                     | `no-simulated-dom`                            |
| `e5b-no-simulated-dom-config-member`      | `no-simulated-dom-in-config`                  |
| `a2-known-constructors`                   | `no-unknown-constructor`                      |
| `e4w-project-binding`                     | `project-named-for-its-specification`         |
| `a1-specification-file`                   | `runner-in-specification-file`                |
| `a8-services-type-the-factory`            | `server-sees-declared-services`               |
| `g2-per-worker-isolation`                 | `state-isolated-per-worker`                   |
| `e2-preset-config`                        | `vitest-config-from-define-spec-config`       |
| `b9w-product-command`                     | `cli-runs-the-product-binary`                 |
| `b2-a-file-is-named-by-its-path`          | `disk-named-by-relative-path`                 |
| `b2-relative-path-runtime`                | `disk-named-by-relative-path-at-runtime`      |
| `b4-given-then`                           | `given-and-then-markers-present`              |
| `j6w-given-in-the-test`                   | `given-in-the-test`                           |
| `b11-marker-one-line`                     | `marker-on-one-line`                          |
| `b3-no-label-on-a-chain`                  | `no-chain-label`                              |
| `b6w-redundant-env-url`                   | `no-redundant-service-url`                    |
| `b16w-file-context`                       | `no-repeated-chain-setting`                   |
| `b1-one-terminal-action`                  | `one-terminal-action-per-chain`               |
| `b12-route-template`                      | `route-written-as-template`                   |
| `b12-route-params-runtime`                | `route-written-as-template-at-runtime`        |
| `b7-sequence-by-seed`                     | `sequence-expressed-by-seeding`               |
| `b6-url-injection`                        | `service-urls-injected`                       |
| `b8-kebab-trigger`                        | `trigger-name-in-kebab-case`                  |
| `b10-when-between-markers`                | `when-between-given-and-then`                 |
| `j9-checker-suppression-reason`           | `checker-suppression-states-a-reason`         |
| `j5-spec-description`                     | `document-description-reads-as-a-title`       |
| `j4-spec-description-unique`              | `document-description-unique`                 |
| `c20-facet-folder`                        | `specification-folder-has-its-runner`         |
| `c18-module-test-under-facet`             | `specification-test-uses-its-runner`          |
| `c12-spec-file-name`                      | `file-suffix-matches-place`                   |
| `c1-asset-grouping`                       | `folder-follows-assets`                       |
| `c5-a-path-names-its-subfolder`           | `golden-path-creates-folders`                 |
| `c6-tomatch-extension`                    | `golden-path-has-extension`                   |
| `c21w-ground-owned-by-one`                | `ground-beside-its-only-reader`               |
| `c28-ground-shared-or-inline`             | `ground-shared-or-inline`                     |
| `c13-bare-ground`                         | `ground-uses-reserved-name`                   |
| `c8-disk-target-exists`                   | `named-path-exists`                           |
| `c16-document-outside-ground`             | `no-document-in-ground`                       |
| `c27w-duplicate-ground`                   | `no-duplicate-ground`                         |
| `c15-local-fixture-reach`                 | `no-reach-into-sibling-ground`                |
| `c25-no-ground-synonym`                   | `no-snapshot-folder`                          |
| `c9-dead-fixtures`                        | `no-unused-ground`                            |
| `j10-one-describe-level`                  | `one-describe-level`                          |
| `c31-describe-names-file`                 | `one-describe-per-file`                       |
| `c29-one-subject`                         | `one-subject-per-spec`                        |
| `c26-disk-named-in-the-test`              | `paths-named-in-the-test`                     |
| `c2-request-extension`                    | `request-file-extension-known`                |
| `k7-siblingless-module-declared`          | `siblingless-module-declared`                 |
| `c33-file-size`                           | `spec-file-within-line-limit`                 |
| `c30-subject-folder`                      | `spec-in-subject-folder`                      |
| `c32-aspect-name`                         | `spec-named-for-its-aspect`                   |
| `c35-capability-folder`                   | `specimen-filed-by-capability`                |
| `c1-domain-structure`                     | `specs-at-declared-depth`                     |
| `i2-sibling-test-naming`                  | `test-beside-its-module`                      |
| `c34-test-body-size`                      | `test-body-within-line-limit`                 |
| `c24-ground-role`                         | `verb-reads-its-ground-folder`                |
| `d4b-spec-shape`                          | `document-follows-its-grammar`                |
| `d4b-spec-key-order`                      | `document-keys-in-canonical-order`            |
| `d4b-spec-block-scalar`                   | `document-streams-written-as-block-scalars`   |
| `d28-shared-expectation`                  | `expected-constant-shared`                    |
| `c3-expected-http-shape`                  | `expected-headers-are-a-subset`               |
| `d3-a-golden-is-read-where-its-path-says` | `golden-read-from-its-path`                   |
| `d4b-http-first-line`                     | `http-first-line-follows-its-grammar`         |
| `d2-await-io-matcher`                     | `io-matcher-awaited`                          |
| `k10-lint-document-goldens-report`        | `lint-document-goldens-the-report`            |
| `d13w-unfrozen-negative-fixture`          | `negative-golden-frozen`                      |
| `d2w-await-sync-matcher`                  | `no-await-on-sync-matcher`                    |
| `d17w-double-only-oracle`                 | `no-double-only-assertion`                    |
| `j3w-spec-empty-assertion`                | `no-empty-expected-stream`                    |
| `d18w-existence-only-oracle`              | `no-existence-only-assertion`                 |
| `d29-no-foreign-expectation`              | `no-imported-expectation`                     |
| `d4-malformed-ref`                        | `no-malformed-ref`                            |
| `d19w-probe-cluster`                      | `no-probe-cluster`                            |
| `d8w-raw-bypass`                          | `no-raw-bypass`                               |
| `d16-sampled-oracle`                      | `no-sampled-value-in-expectation`             |
| `d11w-spec-silent-refusal`                | `no-silent-refusal`                           |
| `d9w-single-use-ref`                      | `no-single-use-ref`                           |
| `d15w-status-only-probe`                  | `no-status-only-test`                         |
| `d10w-tokens-in-requests`                 | `no-token-in-request`                         |
| `d6w-transform-token-equivalent`          | `no-transform-duplicating-tokens`             |
| `d4-unknown-token`                        | `no-unknown-token`                            |
| `d20-golden-not-snapshot`                 | `no-vitest-snapshot`                          |
| `d5-spec-volatile-literal`                | `no-volatile-literal`                         |
| `d14-one-verb-per-meaning`                | `one-verb-per-meaning`                        |
| `d11-golden-file`                         | `output-asserted-as-a-golden`                 |
| `d5w-spec-pinned-value`                   | `pinned-value-from-the-input`                 |
| `d1-read-only-accessors`                  | `result-accessor-read-only`                   |
| `d20-whole-result`                        | `result-compared-whole`                       |
| `m2-mockof-requires-the-port`             | `mock-of-needs-a-port`                        |
| `d7-strict-intercepts`                    | `network-strict-after-first-stub`             |
| `i4-no-module-doubles`                    | `no-module-mock`                              |
| `d16w-ambient-value`                      | `no-sampled-value-in-test`                    |
| `j2-no-sleep`                             | `no-sleep`                                    |
| `m3-no-vi-time-or-global-stub`            | `no-vitest-time-or-global-stub`               |
| `c7-seeds-sql-only`                       | `seeds-are-sql`                               |
| `c23-seed-no-clock-read`                  | `seeds-state-absolute-time`                   |
| `k9-spec-server-port-zero`                | `server-binds-port-zero`                      |
| `c11-stub-data-pairing`                   | `stub-data-has-a-builder`                     |
| `c10-stubs-boundary`                      | `stubs-imported-through-facade`               |
| `c4-stub-shape`                           | `stubs-root-holds-facades-and-kinds`          |
| `w3-unambiguous-element`                  | `descriptor-matches-one-element`              |
| `w1-scenario-pure`                        | `no-expect-in-scenario`                       |
| `w4-no-landmarks-on-mobile`               | `no-landmark-on-mobile`                       |
| `w5w-scenario-settles`                    | `scenario-ends-settled`                       |
| `w2-testid-states-what-is-missing`        | `test-id-states-what-is-missing`              |
| `w6-verb-subset-per-facet`                | `verb-belongs-to-its-specification`           |
| `f5-fixtures-only-from-tests`             | `fixtures-imported-by-tests-only`             |
| `f7-no-framework-internals`               | `no-framework-internals`                      |
| `f8-no-seam-dependency`                   | `no-redundant-test-dependency`                |
| `f6-no-foreign-test-runtime`              | `no-second-test-runtime`                      |
| `f2-no-test-imports-in-prod`              | `no-test-code-in-production`                  |
| `f4-no-test-to-test-import`               | `no-test-to-test-import`                      |
| `f1-no-subpath-import`                    | `no-unpublished-subpath`                      |
| `i8-definition-is-its-folder`             | `definition-is-its-module`                    |
| `i6-facet-is-composition`                 | `specification-is-a-composition`              |
| `i12-folder-shape`                        | `folder-named-for-a-concept`                  |
| `i1-layer-boundaries`                     | `import-within-declared-layers`               |
| `i7-kernel-loads-in-a-page`               | `kernel-loads-in-a-page`                      |
| `i10-facet-isolation`                     | `no-cross-facet-import`                       |
| `i11-engine-owner`                        | `one-owner-per-engine`                        |
| `i9-source-root`                          | `source-root-holds-known-entries`             |
| `k5-english-catalogue`                    | `catalogue-in-english`                        |
| `k2-cited-ids-resolve`                    | `cited-rules-exist`                           |
| `k1-retro-propagation`                    | `discovery-grows-a-guard`                     |
| `k6-matrix-no-empty-cell`                 | `every-capability-exercised`                  |
| `k4-reach-per-path`                       | `every-reach-proven`                          |
| `k8-corpus-coordinates-resolve`           | `links-resolve`                               |
| `k11-messages-teach`                      | `message-has-four-parts`                      |
| `k3-message-anchors`                      | `message-reads-its-row`                       |
| `k12-rule-audience`                       | `rule-declares-its-audience`                  |
