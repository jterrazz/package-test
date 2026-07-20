# 09 — Conventions: the constitution

This chapter is the **constitution**: the principles, the enforcement channels, the non-mechanizable criteria, and the design rationales behind the conventions. It is hand-maintained and stable.

The **mechanized per-rule catalogue** does not live here — it is **generated from the code** (`src/lint/manifest.ts`, where each rule carries its own normative text) into the [10 — Linting](10-linting.md) catalogue and the agent-facing [`skills/jterrazz-test/references/rules.md`](../skills/jterrazz-test/references/rules.md).

This is the **docs-as-code inversion**: the code is the source of truth for the mechanized rules (a rule and its normative text live together, so they cannot drift), and this constitution is the source of truth for the principles. There is **no duplication** — a machine-checkable rule is written once, in the code. The broader repo-structure doctrine this follows (corpus, injection layers, compiler; committed projections vs CI-built presentations) is documented once, in `@jterrazz/typescript`'s **Repo structure** chapter (`docs/06-repo-structure.md`) — its canonical home.

Guiding aim: **most enforcement is programmatic, not manual review.**

## How the rules are enforced

Each mechanized rule names **one of four enforcement channels**:

- **static** — the `jterrazz/*` oxlint plugin (one `jterrazz/<rule>` per rule, AST analysis) plus the `conventions` checker step (`dist/checker.js`) for the data fixtures oxlint never visits.
- **checker** — passes of the same bundled binary that read what oxlint cannot: the `{{token}}` grammar of `expected/`/`requests/` fixtures (D4/D4b/D10) and cross-file analyses (a `*.specification.ts` crossed with its tests, or a whole feature tree: C9, B5-by-inference, A7).
- **runtime** — the framework refuses incorrect usage at execution time, where static analysis abstains (a non-literal argument) or cannot reach (network, container lifecycle): A6 ambiguous binding, A7, B2, B6 injection, D7 strict intercepts, I3 `.intercept()` in compose.
- **process** — review judgement no channel can settle alone: C1 asset-driven grouping, D11 golden-file, K1 retro-propagation.

The **meta-test** channel doubles several of these by running the framework on itself: every `match.*` token has a positive and a negative test (`src/core/matching/`); every fixture written by `TEST_UPDATE=1` round-trips on the next run; the catalogue stays byte-fresh (`src/lint/plugin.test.ts`). The **type channel** covers what the type system guarantees without a dedicated rule (C4 trigger members, D1 read-only accessors).

## The rule families

The catalogue is organized by family. Each family's usage is illustrated in the chapters; the generated catalogue in [10 — Linting](10-linting.md) carries the normative sentence and channel of every rule.

| Group | Scope                                                                | Explained in                                                               |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A     | Runner creation (constructors, services, root)                       | [01](01-getting-started.md), [02](02-api.md), [08](08-services.md)         |
| B     | Spec chains (setups, terminal actions, Given/Then, `job` vocabulary) | [02](02-api.md), [03](03-jobs.md), [04](04-cli.md)                         |
| C     | Files & folders per feature                                          | [01](01-getting-started.md), [05](05-assertions.md), [07](07-contracts.md) |
| D     | Assertions, tokens, snapshots, strict intercepts                     | [05](05-assertions.md), [06](06-tokens.md), [07](07-contracts.md)          |
| E     | Framework environment variables                                      | [01](01-getting-started.md)                                                |
| F     | Imports (single package root) & production protection                | [01](01-getting-started.md)                                                |
| W     | Website specs (visit scenarios, user-facing elements)                | [11](11-website.md)                                                        |
| G     | Infrastructure (compose, isolation, docker-aware)                    | [04](04-cli.md), [08](08-services.md)                                      |
| H     | Naming recap                                                         | below                                                                      |
| I     | Source-code architecture (four layers, sibling module tests)         | `AGENTS.md`                                                                |
| J     | Hygiene (no `.only`/`.skip`, no arbitrary sleeps)                    | [10](10-linting.md)                                                        |
| K     | Retro-propagation — every defect class grows its own guard           | below                                                                      |

## Process rules (review-borne)

Three rules cannot be mechanized — they turn on judgement no single channel can settle. They are listed in the catalogue for completeness, but their full rationale lives here.

### C1 — the folder follows the assets

The grouping criterion: a test that owns **its own** asset directories (`fixtures/`, `expected/`, `seeds/`, …) gets **its own** domain folder; tests **without local assets** (or sharing the `$FIXTURES/` pool) group as sibling `<aspect>.test.ts` files inside a named **group** folder. Both shapes are legal — the assets decide, and a nascent single-test domain is legitimate. The static rule `c1-domain-structure` checks only the depth (a `*.test.ts` at facet/domain depth, a `*.specification.ts` at the facet root); which of the two shapes is right is the review call.

### D11 — golden-file, not a cluster of greps

A tool's output (a linter, a compiler, a product CLI) is asserted as a **full snapshot per scoped use case**. Each case gets **its own fixture project** (its small valid/invalid files) — the fixture IS the Given, no shared `beforeAll` state — and the assertion is the whole snapshot (`expect(result.stdout).toMatch('<use-case>.txt')` + `exitCode`), volatile parts covered by tokens, generated with `TEST_UPDATE=1`.

`.grep()` / `toContain` remain the **scalpel** — targeted probes, never the default mode. They are legitimate only for:

- **(a)** assertions of **absence**;
- **(b)** output **cut at an arbitrary instant** (`waitFor`, a long-running process);
- **(c)** **container-log probes**;
- **(d)** asserting **rule ids** in the E2E lint specs (avoiding coupling to a third-party binary's exact format);
- **(e)** probes into **third-party-formatted** output.

Every other use is converted to a full snapshot. A single "kitchen-sink" project + full snapshot serves as the whole-surface regression net (it churns — that is its job). The static channel cannot tell a legitimate grep from a lazy one, hence the process channel. The mechanized boundary for API responses (an amas of raw `.response.body` probes, or a lone HTTP-status probe) is caught by `d12w`/`d15w`; the negative-fixture guard is `d13w` (wrapped forms) plus a process rule for helper-routed residue.

### K1 — retro-propagation

Every defect class discovered (review, bug, migration) grows, **in the same change**, the guard that stops it recurring — a static rule, a meta-test, or a runtime error — or an explicit note of why no channel is possible (e.g. "redundant test" is a human judgement). This is the rule that keeps the other three channels growing instead of decaying. When a defect class is mechanizable, its rule joins `src/lint/manifest.ts` and the catalogue regenerates.

## H — Naming recap

| Thing           | Rule                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| Specs root      | `specs/` (`api/`, `jobs/`, `cli/`, `website/`, `integrations/`, `lint/`, `fixtures/`)       |
| Specification   | `specs/<facet>/<name>.specification.ts` (at the facet root)                                 |
| Instances       | `api`, `jobs`, `cli`, `website` — enforced by the destructuring (A3)                        |
| Test file       | `specs/<facet>/<domain>/<aspect>.test.ts`                                                   |
| Module test     | `<file>.test.ts`, sibling of `<file>.ts` (under `src/`)                                     |
| Module fixtures | `<file>.fixtures.ts`, sibling of the `.test.ts` (typed exports)                             |
| Contracts       | `contracts/<name>.<provider>.ts`                                                            |
| Requests        | `requests/<name>.http` (inputs)                                                             |
| Snapshots       | `expected/<name>` (all expected, flat, extension included — incl. response `.http`)         |
| Service keys    | derive the compose service: exact name, else kebab-case (unless explicit `composeService:`) |
| Framework env   | `TEST_MODE`, `TEST_UPDATE`                                                                  |

## Maintaining the constitution

- A new **mechanizable** rule is added to the **code** (`src/lint/manifest.ts` + its implementation), not here — then `npm run docs` regenerates the catalogue. The freshness meta-test fails if the committed catalogue is no longer byte-identical.
- A new **principle** or a non-mechanizable criterion is added here, in its family section or as a process rule.
- Never duplicate a mechanized rule in this constitution: the code is its single source of truth.

## Pitfalls

- **Treating these docs as the spec.** They explain and illustrate; this constitution and the generated catalogue ([10 — Linting](10-linting.md)) decide. When you find a discrepancy in the docs, fix the docs (see the maintenance note in [README](README.md)).
- **Editing the generated catalogue by hand.** The [10 — Linting](10-linting.md) catalogue and `skills/jterrazz-test/references/rules.md` are GENERATED from `src/lint/manifest.ts` — a hand edit is overwritten by the next `npm run docs` and fails the freshness meta-test. Change the rule's text in the code; regenerate.
- **Adding a mechanized rule to the constitution.** A machine-checkable rule lives in the code (its `meta.docs` / the manifest), not in this chapter. The constitution holds principles and non-mechanizable criteria only.

## Related

[README](README.md) · [01 — Getting started](01-getting-started.md) · [05 — Assertions](05-assertions.md) · [10 — Linting](10-linting.md)
