# 12 — Conventions: the constitution

This chapter is the **constitution**: the principles, the non-mechanizable criteria, and the design rationales behind the conventions. It is hand-maintained and stable.

The **mechanized per-rule catalogue** does not live here — it is **generated from the code** (`src/lint/manifest.ts`, where each rule carries its own normative text) into the [13 — Linting](13-linting.md) catalogue and the agent-facing [`skills/jterrazz-test/references/rules.md`](../skills/jterrazz-test/references/rules.md).

This is the **docs-as-code inversion**: the code is the source of truth for the mechanized rules (a rule and its normative text live together, so they cannot drift), and this constitution is the source of truth for the principles. There is **no duplication** — a machine-checkable rule is written once, in the code. The broader repo-layout doctrine this follows — a written corpus, thin injection layers, a compiler that projects; committed projections against CI-built presentations — is `jterrazz-studio`'s repo-structure chapter, its canonical home for every language.

Guiding aim: **most enforcement is programmatic, not manual review.**

Which CHANNEL holds a given rule — static, checker, runtime, process, and the meta-test and type channels that double them — is not this chapter's: it is [01 — Architecture](01-architecture.md), where the shape of the enforcement machinery is drawn. What follows is what the rules SAY and what a reviewer must judge.

## The rule families

The catalogue is organized by family. Each family's usage is illustrated in the chapters; the generated catalogue in [13 — Linting](13-linting.md) carries the normative sentence and channel of every rule.

| Group | Scope                                                                | Explained in                                                          |
| ----- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A     | Runner creation (constructors, services, root)                       | [02](02-developing.md), [05](05-api.md), [11](11-services.md)         |
| B     | Spec chains (setups, terminal actions, Given/Then, `job` vocabulary) | [05](05-api.md), [06](06-jobs.md), [07](07-cli.md)                    |
| C     | Files & folders per feature                                          | [02](02-developing.md), [08](08-assertions.md), [10](10-contracts.md) |
| D     | Assertions, tokens, snapshots, strict contracts                      | [08](08-assertions.md), [09](09-tokens.md), [10](10-contracts.md)     |
| E     | Environment & runner configuration                                   | [02](02-developing.md), [16](16-component.md)                         |
| F     | Imports (single package root) & production protection                | [02](02-developing.md)                                                |
| W     | Website & mobile specs (scenarios, user-facing elements)             | [14](14-website.md), [15](15-mobile.md)                               |
| G     | Infrastructure                                                       | [07](07-cli.md), [11](11-services.md), [16](16-component.md)          |
| I     | Source-code architecture (four layers, sibling module tests)         | below · [01](01-architecture.md) for this repo's own layer map        |
| J     | Hygiene (no arbitrary sleeps, honest spec documents)                 | [13](13-linting.md)                                                   |
| K     | Retro-propagation — every defect class grows its own guard           | below                                                                 |

## The reach of the conventions

The framework and the conventions do not have the same scope, and confusing the two is the commonest misreading of this constitution. `specification.*` — with its seeds, fixtures, contracts, goldens and containers — is for specifying a **surface** something is served through: an HTTP API, a background job, a CLI, a rendered page, a native screen. A plain unit test of a pure function has no such surface and needs none of it.

A **rendered component** needs no RUNNER — nothing is started, so it has no constructor and no `*.specification.ts` — and it does need a real browser, a Vite pipeline and a network double, every one of which the framework owns. So the fork is the SUBJECT, not the amount of machinery: one unit — a module, a component — sits beside its code and is judged by its suffix (`<file>.test.ts`, `<file>.test.tsx`); the assembled product, reached through an entry, sits under `specs/`. [16 — Component specs](16-component.md) holds the rendered half.

The conventions bind **every test file of the repository**, that plain unit test included, whether or not `@jterrazz/test` is imported in it. A test is a test: it sits beside the module it covers (I2), it narrates its Given then its Then (B4), it keeps its doubles out of `src/` (I4), and it stays honest under the J hygiene floor — no committed `.only`/`.skip`, an assertion in every test, no two literal titles alike in a file, a lowercase title. That floor is oxlint's own `vitest` plugin, which `@jterrazz/typescript` turns on over the test globs in every profile; this package's J family keeps only what the plugin has no counterpart for — the arbitrary-sleep ban (J2), narrowed to `specs/**` where waiting is a real temptation, and the spec-document mirrors. Every one of these is mechanized, so its normative sentence lives in the catalogue ([13 — Linting](13-linting.md)) and not here.

The reason for the wide reach: a repository has **one** way to write a test, so a reader moving between a sibling module test and a spec of a surface reads the same shape and the tooling has a single target. A rule that applied only to framework tests would leave the majority of test files — the plain ones — unguarded.

## Process rules (review-borne)

Three rules cannot be mechanized — they turn on judgement no single channel can settle. They are listed in the catalogue for completeness, but their full rationale lives here.

### C1 — the folder follows the assets

The grouping criterion: a test that owns **its own** asset directories (`_fixtures/`, `_expected/`, `_seeds/`, …) gets **its own** domain folder; specs **without local assets** (or sharing the `$FIXTURES/` pool) group as sibling `<aspect>.spec.ts` files inside a named **group** folder. Both shapes are legal — the assets decide, and a nascent single-test domain is legitimate. The static rule `c1-domain-structure` checks only placement; which of the two shapes is right is the review call.

Placement itself is **declared**, because a spec tree may legitimately have a shape this package cannot know:

```jsonc
"jterrazz/c1-domain-structure": ["error", { "depth": "facet-domain" }] // the default
```

| `depth`          | The tree                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'facet-domain'` | the default — `specs/<facet>/<domain>/<aspect>.spec.ts`, `*.specification.ts` at the facet root                                                                     |
| `'facet'`        | the assets decide the folder — a spec at the facet root (`specs/<facet>/<aspect>.spec.ts`) OR one domain down, never deeper; `*.specification.ts` at the facet root |
| `'mirror'`       | the tree mirrors a structure outside itself (a command tree, a source tree): a test at any depth ≥ 1, named `<dir>/<dir>.test.ts`                                   |
| `'off'`          | no placement check — for a tree whose shape is guarded by something stronger and project-specific                                                                   |

A project states the shape it has — `facet` when asset-less tests sit beside their siblings at the facet root, `mirror` when the tree mirrors something outside itself — and keeps a checked shape, instead of switching the rule off and keeping none.

One clause of the rule is not the project's to declare, and holds in every mode, `off` included: **a folder whose name carries a leading underscore is ground, never a domain**, so no spec lives inside one. Depth is a shape a tree may choose; the ground/member split is the naming law recapped under [H](#h--naming-recap).

Ground is not always inert. It may be **code** the specs stand on — the build of the subject under test, a harness the runner spawns — and code carries its unit test as a sibling under [I2](#i--architecture). So the clause lets exactly one pairing through: `<module>.test.ts` NEXT to the `<module>.ts` it is named after, inside the ground it belongs to. A test with no module beside it, or a `*.specification.ts`, is a spec that wandered in and is still reported — which is why the clause needs no `off`, and why no project has to switch off a rule it cannot switch off.

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

Every defect class discovered (review, bug, migration) grows, **in the same change**, the guard that stops it recurring — a static rule, a meta-test, or a runtime error — or an explicit note of why no channel is possible (e.g. "redundant test" is a human judgement). This is the rule that keeps the other six channels growing instead of decaying. When a defect class is mechanizable, its rule joins `src/lint/manifest.ts` and the catalogue regenerates.

## The naming recap

One rule decides every folder of a spec tree: **what a spec stands on carries the underscore; a spec's own folder never does.** The four names are `_fixtures/`, `_expected/`, `_requests/` and `_seeds/` — inert material the framework resolves by path. A facet, a domain, and `contracts/` are members of the row, not ground: a contract is TypeScript a spec imports, so it stays bare. `docker/` sits at the project root, outside any row of specs, and is untouched by the rule.

Two further rules decide WHERE a fixture lives, and they are the same question asked twice. **The pool is for what several leaves share**: a directory of `specs/_fixtures/` that exactly one spec directory reaches for belongs beside that leaf, as `<leaf>/_fixtures/<name>/` (C14, autofixed by `jterrazz-test-check --fix`). **A leaf's own ground is reached only from that leaf**: a `.fixture()` path that climbs out of the referring spec's `_fixtures/` is an error, and the sharing it wants is what the pool declares (C15).

| Thing           | Rule                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Specs root      | `specs/` (`api/`, `jobs/`, `cli/`, `integration/`, `website/`, `mobile/`, `_fixtures/`) — one folder per constructor        |
| Specification   | `specs/<facet>/<name>.specification.ts` (at the facet root)                                                                 |
| Instances       | `api`, `jobs`, `cli`, `website`, `mobile` — enforced by the destructuring (A3)                                              |
| Spec file       | `specs/<facet>/<domain>/<aspect>.spec.ts` — the assembled product's word (C12)                                              |
| Spec document   | `<case>.spec.yaml`, beside the spec it belongs to — never under `_expected/` ([07](07-cli.md#spec-documents--casespecyaml)) |
| Module test     | `<file>.test.ts`, sibling of `<file>.ts` (under `src/`)                                                                     |
| Component test  | `<file>.test.tsx`, sibling of `<file>.tsx` — or of the `<file>.ts` of a hook or a DOM function ([16](16-component.md))      |
| Module fixtures | `<file>.fixtures.ts`, sibling of the `.test.ts` (typed exports)                                                             |
| Contracts       | `contracts/<name>.contracts.ts` (facade) · `contracts/<provider>/<name>.ts` (unit, provider ∈ http\|openai\|anthropic)      |
| Contract data   | `contracts/<provider>/<name>[.<qualifier>].response.json` (served) · `<name>.request.ts` (matched)                          |
| Requests        | `_requests/<name>.http` (inputs)                                                                                            |
| Seeds           | `_seeds/<name>.sql` (database state)                                                                                        |
| Fixtures        | `_fixtures/<name>` (file state) — the leaf's own; the shared pool is `specs/_fixtures/`, reached by `$FIXTURES/`            |
| Snapshots       | `_expected/<name>` (all expected, flat, extension included — incl. response `.http`)                                        |
| Service keys    | name the service: the report prints the key, and its kebab-case form is the folder its init script sits in                  |
| Framework env   | `TEST_UPDATE`                                                                                                               |

## I — Source-code architecture

Family I governs the source tree rather than the spec tree, and it splits in two.

**The layer map is the project's to declare.** `i1-layer-boundaries` ships **inert**: this package cannot know another repository's architecture, so the rule enforces nothing until the project states its own layers in `oxlint.config.ts`. What THIS repository declares there, and why each sanctioned edge exists, is [01 — Architecture](01-architecture.md) — a consumer's own map is its own chapter's, written the same way.

**The test-file rules need no declaration.** I2 (a module's test is its sibling) and I4 (no `vi.mock`, `__mocks__/`, `__fixtures__/` or data-asset imports under `src/`) hold in any repository that adopts this preset — they are part of the floor described above, not of the layer map. A module's typed fixtures are a sibling `<file>.fixtures.ts`, as the naming recap says.

## The fork — which kind of test this is

Three questions, in order. The answer fixes the folder, the constructor (or none), and the project.

| Question                                                               | Kind             | Lives at                                      | Constructor                   | Project       |
| ---------------------------------------------------------------------- | ---------------- | --------------------------------------------- | ----------------------------- | ------------- |
| Does it render in a browser as a whole served page?                    | website          | `specs/website/<domain>/<aspect>.spec.ts`     | `specification.website()`     | `website`     |
| Does it render as a component (React, a DOM function, a hook)?         | component        | `<file>.test.tsx` beside `<file>.tsx`         | none — the `component` chain  | `component`   |
| Does it render on a simulator?                                         | mobile           | `specs/mobile/<domain>/<aspect>.spec.ts`      | `specification.mobile()`      | `mobile`      |
| Does it answer HTTP?                                                   | api              | `specs/api/<domain>/<aspect>.spec.ts`         | `specification.api()`         | `api`         |
| Is it triggered by name, in-process?                                   | jobs             | `specs/jobs/<domain>/<aspect>.spec.ts`        | `specification.jobs()`        | `jobs`        |
| Is it a binary?                                                        | cli              | `specs/cli/<domain>/` (+ `<case>.spec.yaml`)  | `specification.cli(bin)`      | `cli`         |
| Is it a module that needs a real service, or whose oracle is a golden? | integration      | `specs/integration/<domain>/<aspect>.spec.ts` | `specification.integration()` | `integration` |
| Is it a module alone?                                                  | module           | `<file>.test.ts` beside `<file>.ts`           | none                          | `unit`        |
| Is it the repository itself — a suite over several apps?               | repository suite | `specs/<family>/<aspect>.test.ts`             | none                          | any name      |

The SUFFIX says the kind, and the checker holds it (rule C12): `.test.ts(x)`
beside the code for a unit, `.spec.ts` under `specs/<facet>/` for the assembled
product, `<case>.spec.yaml` for a literate document, `<facet>.specification.ts`
for the file that builds a runner. A repository suite is the one tree under
`specs/` that keeps `.test.ts`: its first level is not a facet, it covers a tree
rather than a product, and C1's declared depth is what judges its shape.

The fork is the SUBJECT, never the amount of machinery. A rendered component needs a real browser, a Vite pipeline, a network double and a golden engine — all of them the framework's — and it is still a unit, so it sits beside its code. A module that needs a real database needs nothing new at all, and it is still an assembled thing, so it sits under `specs/` ([17](17-integration.md)).

The table is total: **a folder under `specs/` is a constructor's name, and there is no ninth row**. A probe of an adapter against a real service — a database driver, a cache handle — answers the seventh question, so it is an integration spec like any other; what it cannot reach through the package's public entry it should not be reaching from a spec at all, and that probe is a module test beside its module (rule F3).

## The doubles ladder

Closed and ordered. An agent takes the FIRST rung that fits, and nothing below rung four is a rung.

1. **The real thing**, in-process — a pure module, a Hono app handed to `server`, a component mounted in a real Chromium.
2. **A declared service** — `sqlite()`, `postgres()`, `redis()`, `process()` ([11](11-services.md)): real, isolated per worker, reset at the start of every chain.
3. **A contract** — `.intercept()` on a chain (api, jobs, integration, component, website, mobile), `intercept()` in module scope ([10](10-contracts.md)). One queue, three transports, strict from the first contract (rule D7); a streamed body is `http.stream` / `http.sse`.
4. **A typed port double** — `mockOf<Port>()` for an injected interface, `vi.fn<Fn>()` for a function-shaped dependency. Asserting a call on one is a boundary observation; asserting ONLY on doubles the test built is not a test of anything. `T` is constrained to `object` and has no default, so a double asked for nothing answers for `object` — TypeScript falls back to the constraint where no inference site says otherwise, and the refusal lands where the double is USED rather than where it was made. State the port.

**Off the ladder**, each with a destination: `vi.stubGlobal('fetch')` → `intercept()`; a raw `msw`/`nock`/`sinon` import → a contract; `vi.useFakeTimers` / `vi.setSystemTime` → `clock`; `toMatchSnapshot` → a golden under `_expected/`; `vi.mock` of an application module → inject the port instead. A native module a consumer genuinely cannot inject is the one allow-listed exception, per specifier, with a reason.

Where a test lives is what makes the rungs mechanizable: a module test may not carry a golden, and a module that needs a real service is an integration spec ([17](17-integration.md)). The reasoning is [ADR-005](decisions/005-the-doubles-ladder-is-closed.md).

## Time — one primitive, two depths

Determinism is structural (rule D16): a value a test SAMPLES — `Date.now()`, `new Date()`, `Math.random()`, `randomUUID()` — never reaches an oracle. Time is the one of those the framework pins for you, and `clock` is the whole vocabulary. `vi.useFakeTimers()` and `vi.setSystemTime()` are what it replaces: each of them owns a teardown a test will one day forget.

```typescript
import { clock } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('stamps the moment the receipt was issued', () => {
    // Given - the calendar pinned for this scope
    using _ = clock.at('2026-03-04T09:30:00Z');

    // Then - the stamp is the stated instant
    expect(new Date().toISOString()).toBe('2026-03-04T09:30:00.000Z');
});
```

| Form                | Takes                          | For                                                                        |
| ------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `clock.at(iso)`     | the calendar (`Date`)          | a subject that READS the time — a stamp, an expiry, a greeting             |
| `clock.run(iso?)`   | the calendar and the scheduler | a subject whose behaviour IS elapsed time — a debounce, a backoff, a poll  |
| `clock.advance(ms)` | —                              | moving the pinned clock on; under `run()`, firing everything that came due |

Both forms are `Disposable`: `using _ = clock.at(…)` gives the REAL clock back at the end of the scope, however the scope ends. `at()` leaves the scheduler real, so promises, renders and the framework's own loops keep running; `run()` queues them instead, which is what lets a test assert a five-second backoff without the arbitrary sleep J2 forbids.

One clock per test: a second scope taken inside the first is refused, not nested. Disposing restores the real clock — the only state vitest's fake timers can give back — so a nested scope that ended would silently end the outer one too, and the refusal says which of the two the test meant.

Migrating a `beforeEach`/`afterEach` pair holds the `Disposable` by hand:

```typescript
let pinned: Disposable;
beforeEach(() => {
    pinned = clock.at('2026-03-04T09:30:00Z');
});
afterEach(() => {
    pinned[Symbol.dispose]();
});
```

That form works, and it is the migration shape rather than the destination: `using _ = clock.at(…)` inside the test states the instant where the test that needs it can be read, and cannot be forgotten.

A facet pins the same instant for the chain it is stated on — `.clock(iso)` on api, jobs, integration, component, and on a website visit (the PAGE's calendar, through the browser). A cli spec is another process: its instant travels through the product's own env (`TZ`) or is absorbed by a `{{iso8601}}` token in the golden.

## The backlog — the criterion written, coded on its first occurrence

A rule is written when its defect class has been SEEN once and its criterion is
decidable (rule K1). A class nobody has seen yet is not a rule: it is a line
here, with the criterion it would be written against, so the day it appears the
guard is a translation rather than a design. The R8 dry run of 16.0 — the whole
catalogue run over every repository of the workbench — is what moves a line
either way.

| Line                           | The criterion, ready to code                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B12 marker between statements  | a Given/When/Then marker whose offset falls inside a `VariableDeclaration` with ≥ 2 declarators                                                                                                                                                                                                                                                                                                                                                       |
| B13 no intercept in a loop     | an `.intercept(` call inside a `for`/`while` body, or a `.map(`/`forEach(` callback, in a test file                                                                                                                                                                                                                                                                                                                                                   |
| B15 pinned path tail           | a `toMatch(` fixture name whose directory part repeats the leaf's own domain folder                                                                                                                                                                                                                                                                                                                                                                   |
| C17 fixtures sibling           | a `_fixtures/` directory whose only referrer sits in a sibling domain rather than beside it                                                                                                                                                                                                                                                                                                                                                           |
| C19 ground per facet           | a `_seeds/` or `_requests/` under a facet whose specification constructs `website()` or `mobile()` — a screen owns no database                                                                                                                                                                                                                                                                                                                        |
| D21w expected pinned value     | a uuid, or an iso8601 whose time is NOT midnight UTC, in a file under `_expected/` that appears in no `_seeds/`, `_requests/`, `_fixtures/`, `contracts/` or referring test of the same leaf, nor in the `$FIXTURES` pool. The hour is part of the criterion: a clock read during a run is never exactly midnight, a publication date always is ([ADR-006](decisions/006-the-catalogue-reaches-a-file-by-its-role.md) records what the dry run found) |
| C22 golden in a module test    | a `toMatch('<name>.<ext>')` — a string literal carrying an extension — in a `module`-role file OUTSIDE every `specs/` tree: a unit test standing on a golden file is an integration spec, and `specs/integration/` is where it belongs (C6 holds the same call inside a specs tree)                                                                                                                                                                   |
| D22w empty golden              | a file under `_expected/` whose trimmed content is exactly `{{any}}`                                                                                                                                                                                                                                                                                                                                                                                  |
| D25 duplicate contract payload | two response payloads with the same content hash under one `contracts/` tree, outside the shared pool                                                                                                                                                                                                                                                                                                                                                 |
| D26w inline request body       | a request body written inline in a test that also carries a `_requests/` directory                                                                                                                                                                                                                                                                                                                                                                    |
| E10 no retry                   | a `retry:` option on `test(`/`describe(`, or `test.retry(`, or `retry` in a vitest config — react-query's `retry: false` is not one                                                                                                                                                                                                                                                                                                                   |
| I5 no namespace spy            | a `vi.spyOn(<namespace import>, …)` — a module's own export spied through its namespace object                                                                                                                                                                                                                                                                                                                                                        |

**Parked**, for a criterion that is not settled: **D23** no negated golden (15
hits on the workbench, every one a `toMatch(/re/)` the criterion must exclude)
and **D24** unreachable contract (the criterion has to compare filter arguments,
not just methods and urls).

## What stays human, and why

Every convention a machine can settle is a row with a channel. These are the
ones no channel can decide — listed with the reason, and with what the machine
takes of them anyway, so neither side is silently dropped.

| Convention                                        | Why no channel decides it                                             | What the machine takes                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| C1 grouping — own domain vs sibling aspects       | what the assets will become is a reading of the domain                | C21w flags the one-owner half                                                                                              |
| D11 the legitimacy of a probe                     | absence, cut output and a third-party format are meanings, not shapes | d12w / d15w / D19w draw the cluster boundary                                                                               |
| D13 residue routed through a helper               | inter-procedural analysis is out of an oxlint JS plugin's reach       | d13w's bounded heuristic                                                                                                   |
| K1 — whether a defect is a CLASS                  | a judgement about what will happen again                              | K2–K5 hold the catalogue complete and true                                                                                 |
| the truth of a Given/Then sentence, or of a title | a sentence can be well-formed and false                               | B4/B10/B11 and `vitest/valid-title` hold the shape                                                                         |
| whether an updated golden is RIGHT                | correctness is the diff, read at review                               | d5 holds the volatile literals, in a document and under `_expected/` alike; the pinned-value half of ground waits for D21w |
| whether an allow-listed `vi.mock` has no seam     | the claim is disputable, and recorded in the config comment           | I4 holds the list                                                                                                          |
| `exact` versus `within` when both disambiguate    | taste between two user-facing forms                                   | W2 forces a reason on the escape hatch; W3 offers both                                                                     |
| one fixture per answer of the system              | a reading of what the chain proves                                    | J4 holds unique descriptions                                                                                               |
| contract realism                                  | only a recorded exchange could judge it                               | —                                                                                                                          |
| the depth a repository declares                   | reviewed once, when the tree is born                                  | C1 thereafter                                                                                                              |

## Maintaining the constitution

- A new **mechanizable** rule is added to the **code** (`src/lint/manifest.ts` + its implementation), not here — then `npm run docs` regenerates the catalogue. The freshness meta-test fails if the committed catalogue is no longer byte-identical.
- A new **principle** or a non-mechanizable criterion is added here, in its family section or as a process rule.
- Never duplicate a mechanized rule in this constitution: the code is its single source of truth.

## Pitfalls

- **Treating these docs as the spec.** They explain and illustrate; this constitution and the generated catalogue ([13 — Linting](13-linting.md)) decide. When you find a discrepancy in the docs, fix the docs in the same change — [02 — Developing](02-developing.md) § What a change owes.
- **Editing the generated catalogue by hand.** The [13 — Linting](13-linting.md) catalogue and `skills/jterrazz-test/references/rules.md` are GENERATED from `src/lint/manifest.ts` — a hand edit is overwritten by the next `npm run docs` and fails the freshness meta-test. Change the rule's text in the code; regenerate.
- **Adding a mechanized rule to the constitution.** A machine-checkable rule lives in the code (its `meta.docs` / the manifest), not in this chapter. The constitution holds principles and non-mechanizable criteria only.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [03 — Testing](03-testing.md) · [08 — Assertions](08-assertions.md) · [13 — Linting](13-linting.md) · [17 — Integration specs](17-integration.md)
