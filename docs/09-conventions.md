# 09 — Conventions: the constitution and the generated catalogue

The conventions are governed by two files that split by nature:

- [`/CONVENTIONS.md`](../CONVENTIONS.md) — the **constitution**: principles, the enforcement channels, non-mechanizable criteria, process rules, and design rationales. Hand-maintained and stable.
- [`/CONVENTIONS-CATALOG.md`](../CONVENTIONS-CATALOG.md) — the **generated catalogue**: the normative sentence of every _mechanized_ rule, across all four channels. It is generated FROM the code (`src/lint/manifest.ts`, where each rule carries its own text), never edited by hand.

This is the **docs-as-code inversion**: the code is the source of truth for the mechanized rules (a rule and its normative text live together, so they cannot drift), and the constitution is the source of truth for the principles. There is **no duplication** — a machine-checkable rule is written once, in the code. `npm run docs` regenerates the catalogue (into `CONVENTIONS-CATALOG.md` and the `docs/10-linting.md` table); a meta-test (`src/lint/plugin.test.ts`) fails if the committed output is no longer byte-identical.

## How the rules are enforced

Each mechanized rule names **one of four enforcement channels**. The goal is that most enforcement is programmatic, not manual review:

- **static** — the `jterrazz/*` oxlint plugin plus the `conventions` checker step of `typescript check` (AST + the token grammar of data fixtures).
- **checker** — passes of the same bundled binary that read what oxlint cannot: the `{{token}}` grammar of `expected/`/`requests/` fixtures (D4/D4b/D10) and cross-file analyses (a `*.specification.ts` crossed with its tests, or a whole feature tree: C9, B5-by-inference, A7).
- **runtime** — the framework refuses incorrect usage at execution time, where static analysis abstains or cannot reach (A6 ambiguous binding, A7, B2, B6 injection, D7 strict intercepts, I3 `.intercept()` in compose).
- **process** — review judgement no channel can settle alone (C1 asset-driven grouping, D11 golden-file, K1 retro-propagation).

The **meta-test** channel doubles several of these by running the framework on itself (every token has a positive + negative test; `TEST_UPDATE` fixtures round-trip; the catalogue stays fresh). The **type channel** covers what the type system guarantees without a dedicated rule (C4 trigger members, D1 read-only accessors).

Each catalogue entry is a row like:

| Code | Implementation            | Channel  | Convention                                                                  |
| ---- | ------------------------- | -------- | --------------------------------------------------------------------------- |
| A3   | `a3-no-destructure-alias` | statique | Le retour se destructure avec le nom canonique du constructeur, sans alias. |
| D7   | `d7-strict-intercepts`    | runtime  | Une requête sortante non matchée fait échouer le spec.                      |

The rule groups:

| Group | Scope                                                                | Explained in                                                               |
| ----- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A     | Runner creation (constructors, services, root)                       | [01](01-getting-started.md), [02](02-api.md), [08](08-services.md)         |
| B     | Spec chains (setups, terminal actions, Given/Then, `job` vocabulary) | [02](02-api.md), [03](03-jobs.md), [04](04-cli.md)                         |
| C     | Files & folders per feature                                          | [01](01-getting-started.md), [05](05-assertions.md), [07](07-contracts.md) |
| D     | Assertions, tokens, snapshots, strict intercepts                     | [05](05-assertions.md), [06](06-tokens.md), [07](07-contracts.md)          |
| E     | Framework environment variables                                      | [01](01-getting-started.md)                                                |
| F     | Imports (single package root) & production protection                | [01](01-getting-started.md)                                                |
| G     | Infrastructure (compose, isolation, docker-aware)                    | [04](04-cli.md), [08](08-services.md)                                      |
| H     | Naming recap                                                         | below                                                                      |
| I     | Source-code architecture (four layers, sibling module tests)         | `AGENTS.md`                                                                |
| J     | Hygiene (no `.only`/`.skip`, no arbitrary sleeps)                    | —                                                                          |
| K     | Retro-propagation — every defect class grows its own guard           | below                                                                      |

The full mechanized set is live: the `jterrazz/*` oxlint plugin, the D4 checker and its cross-file passes, the runtime refusals, and the meta-tests. Browse them in [`/CONVENTIONS-CATALOG.md`](../CONVENTIONS-CATALOG.md) (all four channels) or the [`docs/10-linting.md`](10-linting.md) rule table (the statique channel).

## H — Naming recap

| Thing           | Rule                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| Specs root      | `specs/` (`api/`, `jobs/`, `cli/`, `integrations/`, `lint/`, `fixtures/`)                   |
| Specification   | `specs/<facet>/<name>.specification.ts` (at the facet root)                                 |
| Instances       | `api`, `jobs`, `cli` — enforced by the destructuring (A3)                                   |
| Test file       | `specs/<facet>/<domain>/<aspect>.test.ts`                                                   |
| Module test     | `<file>.test.ts`, sibling of `<file>.ts` (under `src/`)                                     |
| Module fixtures | `<file>.fixtures.ts`, sibling of the `.test.ts` (typed exports)                             |
| Contracts       | `contracts/<name>.<provider>.ts`                                                            |
| Requests        | `requests/<name>.http` (inputs)                                                             |
| Snapshots       | `expected/<name>` (all expected, flat, extension included — incl. response `.http`)         |
| Service keys    | derive the compose service: exact name, else kebab-case (unless explicit `composeService:`) |
| Framework env   | `TEST_MODE`, `TEST_UPDATE`                                                                  |

## K — Retro-propagation

Every defect class discovered (review, bug, migration) must grow, **in the same change**, the guard that stops it recurring — a static rule, a meta-test, or a runtime error — or an explicit note of why no channel is possible (e.g. "redundant test" is a human judgement). This is the rule that keeps the other three channels growing instead of decaying (rule K1).

## Pitfalls

- **Treating these docs as the spec.** They explain and illustrate; the constitution (`/CONVENTIONS.md`) and the generated catalogue (`/CONVENTIONS-CATALOG.md`) decide. When you find a discrepancy in the docs, fix the docs (see the maintenance note in [README](README.md)).
- **Editing the generated catalogue by hand.** `/CONVENTIONS-CATALOG.md` and the `docs/10-linting.md` rule table are GENERATED from `src/lint/manifest.ts` — a hand edit is overwritten by the next `npm run docs` and fails the freshness meta-test. Change the rule's text in the code; regenerate.
- **Adding a mechanized rule to the constitution.** A machine-checkable rule lives in the code (its `meta.docs` / the manifest), not in `/CONVENTIONS.md`. The constitution holds principles and non-mechanizable criteria only.

## Related

[README](README.md) · [01 — Getting started](01-getting-started.md) · [05 — Assertions](05-assertions.md)
