# 01 — Architecture

What this package IS: one runner model behind six constructors, one chain that needs none, four source layers with declared edges, and seven channels through which its conventions are enforced — each row of the catalogue naming exactly one. The chapters that follow explain how to USE each facet; this one draws the lines they sit inside.

| The shape                  | Held below                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------- |
| The runner model           | [The runner model](#the-runner-model) — constructor, handle, chain, result              |
| The source layers          | [The four layers](#the-four-layers) — `specification`, `integrations`, `vitest`, `lint` |
| How a convention is held   | [The seven enforcement channels](#the-seven-enforcement-channels)                       |
| What ships out of the tree | [What the tree publishes](#what-the-tree-publishes)                                     |

The rules themselves — what each family says, what a reviewer must judge — are the constitution, [12 — Conventions](12-conventions.md); their normative sentences are the generated catalogue, [13 — Linting](13-linting.md).

## The runner model

Every facet is the same four steps. A **constructor** takes options and returns a **handle**; the handle opens a **chain** of zero or more setups closed by exactly one terminal action; the action executes and resolves to a **typed result**; the result is asserted through vitest's `expect()`. Nothing else is public — there is no imperative escape hatch, because a spec that can do anything proves nothing in particular.

Five constructors exist and the list is closed (`src/specification/facets/_common/specification.ts`):

| Constructor               | Handle destructures to      | Subject under test                               |
| ------------------------- | --------------------------- | ------------------------------------------------ |
| `specification.api()`     | `{ api, cleanup, docker }`  | An HTTP API, built and served in this process    |
| `specification.jobs()`    | `{ jobs, cleanup }`         | A background pipeline, triggered by name         |
| `specification.cli()`     | `{ cli, cleanup, docker }`  | A command binary in a fresh temp directory       |
| `specification.website()` | `{ website, cleanup, url }` | A rendered page — fetched, or driven in chromium |
| `specification.mobile()`  | `{ mobile, cleanup, udid }` | A native screen on an iOS simulator              |

The asymmetry in that column is the model, not an oversight: `jobs` never spawns a container, so it is handed no `docker`; `website` and `mobile` drive a browser and a simulator rather than an orchestrated stack, so they carry neither.

**One facet has no constructor**, and the same reason explains it: a rendered component starts nothing. `component` ([16 — Component specs](16-component.md)) is a chain the package exports directly — `component.intercept(…).render(<X />)` — so there is no handle to destructure and no `cleanup` to pass to `afterAll`. What every render of a project shares (the providers, the Vite pipeline, the viewport) is the PROJECT's, stated once by `component()` in `vitest.config.ts`.

A runner is created **once per suite**, in a `*.specification.ts` file, and imported by the test files beside it. That split is what makes the container lifecycle affordable — one Postgres per suite, not one per test — and it is why `afterAll(cleanup)` belongs in the specification file and nowhere else.

### The seam under the chain

`SpecificationBuilder` (`src/specification/facets/_common/builder.ts`) holds the chain for every facet; each facet contributes its own setups and its own terminal actions on top. The infrastructure a chain needs is reached through **ports** — `src/specification/ports/` declares eight of them (`browser`, `cli`, `container`, `database`, `device`, `isolation`, `server`, `service`) — and an integration implements one. So the chain knows "a database exists"; it never knows Postgres.

Every seam is opened lazily rather than imported, and each one is an optional peer loaded by the one module that owns it: `playwright` for `.visit()`, `appium`/`webdriverio` for `.open()`, `@vitest/browser-playwright` + `vitest-browser-react` + `react` for `component.render()`, and — since 16.0 — `better-sqlite3`, `pg`, `redis` and `testcontainers` for the services a record declares. A project that tests no page, no component and no database installs none of them; `src/integrations/peer.ts` owns the one message a missing peer produces, which names the facet that asked, the command, and under pnpm the `onlyBuiltDependencies` line a native binding needs.

## The four layers

The source tree is four layers with declared, one-directional edges. The map is not the linter's to assume — `i1-layer-boundaries` ships inert — so this package declares its own as `FRAMEWORK_LAYERS` in `oxlint.config.ts`, and that declaration is the enforced statement of what follows.

| Layer            | May import                                                                                                                                              | Holds                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specification/` | itself, plus the docker/hono/yaml integrations and two `vitest/` helpers                                                                                | The model: the specification builder and its facets, the results and their accessors, the `{{token}}` engine, the `.http` and `<case>.spec.yaml` grammars, the contract queue, the ports |
| `integrations/`  | its OWN external dependency, plus `specification/`                                                                                                      | One folder per dependency: `postgres`, `redis`, `sqlite`, `testcontainers`, `docker`, `hono`, `playwright`, `vitest-browser`, `appium`, `msw`, `openai`, `anthropic`, `yaml`             |
| `vitest/`        | `vitest`, `vite`, `@vitest/browser-playwright`, `vitest-mock-extended`, `specification/`, `integrations/docker`, `integrations/vitest-browser/commands` | The CONFIG side of the runner coupling: the `expect()` matchers, update-mode detection, `mockOf`, `clock`, the preset, the `literate()` plugin and the project helpers                   |
| `lint/`          | itself, plus a short list of PURE `specification/` modules                                                                                              | The tool-facing channel: the oxlint plugin, the conventions checker, the catalogue manifest and generator                                                                                |

Three of those edges carry their reason in the declaration itself. `specification/` reaches `integrations/docker` because that adapter has no dependency of its own to leak. `lint/` reaches exactly the pure modules the runner also uses — the token list, the ground names, the root walk, the `<case>.spec.yaml` parser — so that the file the lint accepts is the file the runner runs, from ONE parser. And the runner is named in exactly TWO places outside a test, one per side of it: `vitest/` for the config side — the preset, the project helpers, the matchers — and `integrations/vitest-browser/` for the page side, where the locators, the visitor, the golden commands and the page's own `vitest` primitives live. Swapping the runner would be a rewrite of those two folders and of nothing else; `specification/` states what a render IS and never which runner performs it, which is why the layer map exempts that seam from the prod-import ban (F2) by name.

The table's May-import column is a reading of `FRAMEWORK_LAYERS`, never a second statement of it: the declaration in `oxlint.config.ts` is what the linter enforces and what a change edits.

There are TWO composition roots and neither names a layer. `src/index.ts` is node's: it wires the container integrations into the registry seam and re-exports the public surface. `src/browser/index.ts` is the page's, and `src/surface.ts` is what they agree on — see [What the tree publishes](#what-the-tree-publishes).

## The seven enforcement channels

A convention this package states is held by a **channel**, and every row of the catalogue names exactly one of seven. The guiding aim is that most enforcement is programmatic, not review-borne.

- **statique** — the `jterrazz/*` oxlint plugin: one file per rule under `src/lint/rules/`, AST analysis, one diagnostic per file.
- **upstream** — a convention an oxlint vitest-plugin rule already holds, set as an OPTION from the `testing` fragment rather than duplicated as a rule of ours ([ADR-005](decisions/005-the-doubles-ladder-is-closed.md)).
- **checker** — passes of the `jterrazz-test-check` binary reading what an AST cannot: the `{{token}}` grammar of `_requests/` and `_expected/` fixtures, the `<case>.spec.yaml` document family, cross-file analyses that cross a `*.specification.ts` with its tests, and the member pass that judges a package rather than a tree.
- **runtime** — the framework refuses incorrect usage as it executes, where static analysis abstains (a non-literal argument) or cannot reach (the network, a container lifecycle).
- **type** — what the compiler refuses with no rule at all, proven by `src/type-channel.test-d.ts`.
- **meta** — what the framework's own suite holds about itself: the catalogue's freshness, its completeness, the reach of its rules — [03 — Testing](03-testing.md) owns the channel.
- **process** — the judgement no single channel settles: asset-driven grouping, golden-file discipline, retro-propagation.

The channel a rule sits on is not prose here: it is a field of `src/lint/manifest.ts`, the single source of truth from which the catalogue in [13 — Linting](13-linting.md) is generated. A rule and its normative sentence live together in the code, so the two cannot drift.

## What the tree publishes

The bundle is built by `tsdown` into `dist/` and its shape follows how each entry is consumed. `index` and `vitest`, plus the `checker`/`catalog` CLIs, are ESM-only — vitest is ESM-only and the CLIs are invoked as `node dist/*.js`. The `oxlint` plugin ships dual, because oxlint loads it from a consumer project that may itself be CommonJS.

**There are FOUR entries and no more**: `@jterrazz/test` for everything a spec uses, `@jterrazz/test/vitest` for what `vitest.config.ts` needs, `@jterrazz/test/oxlint` for the lint plugin, `@jterrazz/test/schema` for an editor validating a `<case>.spec.yaml`. That is rule F1 rather than a convention of taste, and the exemption is derived from the manifest's own `exports` map (`src/lint/package-exports.ts`), so a subpath is exempt the moment it is published and stops being exempt the moment it is withdrawn.

**The root entry has two runtimes.** A component test renders in a real browser, and the node entry cannot load there: it wires `pg`, `better-sqlite3`, `testcontainers` and `node:fs` at import. So `exports["."]` carries a `browser` condition resolving to `dist/browser/index.js` — the same public surface, built for a page, where every node-only name (the six constructors, the services, the docker accessors, the results that walk a disk) is a stub that throws where it was called, naming the facet and saying it runs under node. The split is the RUNTIME's and never the facets': one specifier, so no spec has to remember which entry it may import.

`types` is stated once, and it is the node build's — so the two runtimes are ONE type surface and a name cannot exist on one side only. What both agree on lives in `src/surface.ts`, and the `package-exports` meta-test compares the two builds' exported names on every run.

Two committed projections leave the code and land in the corpus: the API reference under `docs/reference/` (typedoc, through `typescript docs`) and the rule catalogue spliced into [13 — Linting](13-linting.md) and `skills/jterrazz-test/references/rules.md`. A third, `schema/spec.schema.json`, is generated from the document grammar's own constants and ships in the tarball. All three are regenerated by one gesture and sync-checked — see [02 — Developing](02-developing.md).

## Pitfalls

- **Reaching for a dependency from `specification/`.** A new external package belongs in a folder of `integrations/` that imports it and nothing else; `specification/` importing it directly is the one boundary this package cannot afford to blur, and `i1-layer-boundaries` refuses it.
- **Adding a seventh constructor.** The six are the closed vocabulary the conventions, the linter and the documentation are all shaped around. A new SUBJECT to specify is a design decision, and it earns a record in [`decisions/`](decisions/) before it earns a constructor — as `integration` did in [ADR-004](decisions/004-a-module-against-real-services-or-a-golden-is-the-integration-facet.md).
- **Writing a rule's normative sentence into a chapter.** It belongs in `src/lint/manifest.ts` beside the implementation; a chapter that restates it is the second copy the whole design exists to prevent.

## Related

[02 — Developing](02-developing.md) · [03 — Testing](03-testing.md) · [12 — Conventions](12-conventions.md) · [13 — Linting](13-linting.md)
