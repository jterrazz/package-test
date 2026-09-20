# @jterrazz/test — the corpus

The manual of this repository: what the framework is, how it is changed, what proves a change, how it is released, and one chapter per subject it holds. The vitrine is the root `README.md`; the brief a session opens first is the root `AGENTS.md`.

| Chapter                                     | Holds                                                                                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [01 — Architecture](01-architecture.md)     | The runner model behind the seven constructors, the three source trees and their edges, the seven enforcement channels, the four entries, what the tarball publishes |
| [02 — Developing](02-developing.md)         | The repository's own loop and what a change owes; then install, first specs, the vitest preset and its helpers                                                       |
| [03 — Testing](03-testing.md)               | The vitest projects, the generated capability matrix, the layered reading, the coverage ratchet, the meta-test channel, what CI runs                                 |
| [04 — Operating](04-operating.md)           | The npm release; the peers a consumer brings — required, optional, the provider's exact pin, the native seams; Node 24; the ARIA dialect                             |
| [05 — Module tests](05-module-tests.md)     | The majority kind: what a `*.test.ts` beside its module may and may not do — `mockOf`, `vi.fn`, `clock`, `intercept`, `vi.stubEnv`, `*.fixtures.ts`, `test.each`     |
| [06 — Integration specs](06-integration.md) | `specification.integration()`: a module against real services or a golden — `.call()`, `value`/`error`, the `integration()` project                                  |
| [07 — Component specs](07-component.md)     | `component`: a rendered unit in Chromium — the chain, the visitor, `tree`/`html`, the `component()` project, the hook and DOM-function recipes                       |
| [08 — Website specs](08-website.md)         | `specification.website()`: `.fetch()` / `.visit()`, visit scenarios, declared backends, the `head` golden                                                            |
| [09 — Mobile specs](09-mobile.md)           | `specification.mobile()`: `.open()`, simulator resolution, open scenarios, the `screen` golden                                                                       |
| [10 — API specs](10-api.md)                 | `specification.api()`: options, the in-process app, `.http` request files, inline actions, seeds, intercepts                                                         |
| [11 — Jobs specs](11-jobs.md)               | `specification.jobs()`: in-process pipelines, `.trigger()`, provider error cases                                                                                     |
| [12 — CLI specs](12-cli.md)                 | `specification.cli()`: `.exec()`, `.env()`, fixtures and projects, `<case>.spec.yaml` documents, the three doors, services, Docker-aware mode                        |
| [13 — Elements](13-elements.md)             | The one element vocabulary: descriptors, modifiers, verbs, `see()` semantics, W3 and its evidence, `within()`, exact names, `testId`                                 |
| [14 — Assertions](14-assertions.md)         | The reference: every matcher, grouped by subject, sync/async rules, `toMatch` resolution, diffs                                                                      |
| [15 — Tokens](15-tokens.md)                 | The `{{token}}` grammar: all 21 tokens, `#ref` captures, `match.*`, and update mode end to end                                                                       |
| [16 — Contracts](16-contracts.md)           | `defineContract` / `defineContracts`, the facade layout, selection, provider builders, `intercept()` and its origin, streams, the browser transport                  |
| [17 — Services](17-services.md)             | `postgres` / `redis` / `sqlite` / `process`, the services record, init scripts, per-worker isolation, the optional peer each one names                               |
| [18 — Conventions](18-conventions.md)       | The constitution: the principles, the fork, the doubles ladder, the rule families, the backlog, what stays human, the naming recap, retro-propagation (K1)           |
| [19 — Linting](19-linting.md)               | The oxlint plugin (`@jterrazz/test/oxlint`), the conventions checker, and the GENERATED seven-channel rule catalogue                                                 |

The decisions this package alone took stand in [`decisions/`](decisions/), numbered in the order they were taken, the mold `_template.md` beside them. A decision that spans several repositories belongs to the corpus that spans them. The generated API reference is [`reference/`](reference/) — a projection of the source, never authored by hand.

## How to read it

- **01 to 04 are the spine**, and they answer for the repository itself: what it is, how it is changed, what proves a change, how it ships.
- **05 to 12 are the kinds of test, in the order the fork asks them.** A module test needs no runner and has no folder (05); everything below it is an assembled product met through an entry. Read 02, then the one chapter matching what you specify.
- **13 to 17 are shared references.** The element vocabulary reaches every rendered surface; assertions and the token grammar reach every facet; contracts apply wherever a facet meets the network, services wherever it has a database. The kind chapters link into them and restate nothing.
- **18 and 19 cover enforcement.** 18 is the constitution — the principles and the criteria no machine settles. 19 documents the static plugin and the checker, and carries the generated catalogue, sourced from `src/lint/manifest.ts`. The chapters explain and illustrate; the constitution and the catalogue decide.

Every kind chapter (05 to 12) is written on the same seven sections — **What it specifies · The constructor · The chain · The result · Unique here · Pitfalls · Related** — so the reader who learned one facet already knows where to look in the next. All examples use the Given/Then comment convention the framework itself enforces (rule B4).
