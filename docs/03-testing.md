# 03 — Testing

What proves a change here: this package specifies itself with itself. The suites under `specs/` are written with `@jterrazz/test` against fixture apps, the module tests sit beside the modules they cover, and a family of meta-tests runs the framework on its own output. This chapter says which suite answers for what, and what a change owes each of them.

**The suffix says the kind.** `.test.ts` is the UNIT's word and sits beside the module it covers; `.test.tsx` is the same law for a rendered unit; `.spec.ts` is the ASSEMBLED product's word and lives under `specs/<facet>/`; a literate document stays `<case>.spec.yaml`. C12 holds both directions and its `--fix` renames with `git mv`, so a reader can tell what a file proves without opening it.

| Ground          | Where                                      | Proves                                                                 |
| --------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Module tests    | `src/**/<file>.test.ts`                    | One module's behaviour, beside it (rule I2)                            |
| Component tests | `specs/component-app/<file>.test.tsx`      | A rendered unit, beside it, in a real Chromium ([16](16-component.md)) |
| Product specs   | `specs/<facet>/<domain>/<aspect>.spec.ts`  | The framework's own facets, through the public surface                 |
| Spec documents  | `specs/cli/literate/*.spec.yaml`           | The document format, collected as test files by `literate()`           |
| Meta-tests      | `src/lint/*.test.ts`, `src/core/matching/` | The framework applied to itself and to its own projections             |

## The seven projects

`test.projects` in `vitest.config.ts` declares seven, and which one you can run is decided by what is installed and running on the machine.

| Project       | Collects                                                                                        | Needs                                                                |
| ------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `unit`        | `src/**/*.test.ts` + `specs/lint/**/*.test.ts`, built by `unit()`                               | Nothing — the lint specs need `npm run build` first                  |
| `cli`         | `specs/cli/**`, built by `cli()` — its documents included, through `literate()`                 | Nothing — the Docker specs self-skip                                 |
| `api`         | `specs/api/**/*.spec.ts`, built by `api()` (node mode, in-process Hono)                         | Docker                                                               |
| `jobs`        | `specs/jobs/**`, built by `jobs()`                                                              | Docker                                                               |
| `integration` | `specs/integration/**`, built by `integration({ serial: true })` — the container seams included | Docker                                                               |
| `website`     | `specs/website/**`, built by `website()`                                                        | playwright + `npx playwright install chromium`; no Docker            |
| `component`   | `specs/component-app/**/*.test.tsx`, built by `component()`                                     | the same chromium; no Docker. Runs in its own group, after `website` |

Every project the package runs comes from a helper, so `--project api` means the same tree here as in any consumer — `unit()` included, with the globs it takes naming the one specs tree that is no facet's. A member without `"type": "module"` writes its config as `vitest.config.mts`: the helpers ship ESM only, a CJS config would have to `require()` them, and `roleOf` already reads `.mts` as the config role — so the rules that judge a config still find it.

Why a file is reached by its ROLE and named by its suffix, and what was weighed against it: [ADR-006](decisions/006-the-catalogue-reaches-a-file-by-its-role.md) (proposed).

**`specs/lint/` is a repository suite, and it keeps `.test.ts`.** A repository suite covers a TREE rather than one assembled product: these files run the plugin and the checker over fixture PROJECTS, one per rule, and what they specify is a convention over a repository's shape. Its first level is not one of the six facets, so C12's rename clause never reaches it, C1's declared depth is what judges it, and `unit()` is what collects it.

**The `unit` project's budget is the whole suite's floor.** It collects the module tests and the lint suite and runs with no service, no browser and no container, so it is the one project a developer runs on every save: it stays under 12 seconds, and the meta-test that proves every rule's reach (`k4-reach-per-path`) runs inside it on ONE oxlint run for that reason.

There is no folder under `specs/` that belongs to no constructor. A probe of a container seam — the postgres and redis handles — is a module against a real service, so it is an integration spec: `specs/integration/<seam>/`, on `specification.integration({ services })` and its one terminal action. What the seam answers BEFORE it reaches a container, and the one adapter the public entry does not publish (`TestcontainersAdapter`), are module tests beside their modules under `src/seams/` — a spec reaches the framework through its public entry, and a probe that cannot is telling you where it belongs (rule F3).

```bash
npm test                            # every project — Docker and chromium both required
npx vitest --run --project unit     # the loop: no infrastructure, after npm run build
npx vitest --run --project website  # after npx playwright install chromium
npx vitest --run --project component  # the same chromium, a mounted unit at a time
```

There is no mobile tree under `specs/`, and that is a hole this chapter states rather than hides: an iOS simulator is not something CI provisions, so the mobile facet is proven by module tests under `src/facets/mobile/` — the simulator resolution, the page-source projection, the ambiguity messages — and by nothing end-to-end.

## How a spec tree is laid out

The layout is the one the conventions enforce on every consumer (rule C1), and this repository is its first consumer. A facet carries its runners at its ROOT and its tests one level down, in domain folders:

```
specs/
├── api/
│   ├── api.specification.ts          # runners at the facet root
│   ├── intercepts.specification.ts
│   └── requests/                     # a domain
│       ├── requests.spec.ts
│       ├── _requests/                # ground: complete requests, *.http
│       └── _expected/                # ground: every expected fixture, flat
└── _fixtures/                        # the SHARED pool, reached as $FIXTURES/…
```

**A domain shared by two facets carries the same name in both.** Six
capabilities belong to no facet in particular — a runner's `lifecycle`, the
declared network (`intercepts`), the ground a chain loads (`seeding`), what a
result answers (`assertions`), the `{{token}}` engine (`tokens`) and the pinned
calendar (`clock`) — and where a facet specifies one, its domain folder is
called that, so `specs/api/clock/` and `specs/website/clock/` are the same
question asked of two constructors. A domain present in every facet is core
behaviour; one present in a single facet is that facet's own, and keeps its own
name.

`requests/` and `responses/` are api's, `env/`, `exec/`, `directory/`,
`docker/` and `literate/` are cli's, `call/`, `golden/`, `postgres/` and
`redis/` are integration's, `triggering/` is jobs', `visit/`, `fetch/`,
`console/` and `services/` are website's. The tree is the reading: a name that
appears twice says the capability is shared, and a name that appears once says
where it is not.

A test at a facet root is forbidden and a `*.specification.ts` inside a domain is forbidden; a leading underscore means ground, never a domain. Which of the two legal shapes a given tree takes — its own domain, or sibling tests in a named group folder — is decided by the assets, and that judgement is the process channel's ([12 — Conventions](12-conventions.md)).

The fixture apps the specs drive live in the pool: `app` and `website-app` for the served facets, `cli-app`, `docker-cli`, `checker-cli` and `lint-cli` for the command facets, the `broken-*` trees for the infrastructure failure paths, and `lint-violations/` — a violation/compliant twin per lint rule.

**The component tree is the one exception, and the exception is the rule it dogfoods.** A rendered unit's test sits BESIDE the unit, so `specs/component-app/` holds the fixture app and its specs as neighbours — a table with a contract, a form carrying every verb, a modal hook with its Host in the test, a routed link, a vanilla-DOM list, a clock stamp, a noisy panel, a responsive note, a control that refuses input and a pair of links whose names overlap. It is not under `_fixtures/`: ground is what a spec stands on from a distance, and here the spec stands next to it. The exception is HELD by rules, not granted by omission: I2 requires every one of those `.test.tsx` files to have the `.tsx` (or the `.ts` of a hook) of the same basename beside it, and C1's row says a `.test.tsx` is out of its reach because a rendered unit never lives in a facet/domain tree.

## The lint suite is end-to-end

`specs/lint/**` runs the REAL oxlint binary and the real checker over the fixture projects and goldens their output, grouped by convention family (`runners/`, `chains/`, `files/`, `assertions/`, `imports/`, `architecture/`, `hygiene/`, `website/`, `checker/`, `meta/`). Because it loads `dist/oxlint.js`, `npm run build` must precede it — the same ordering `npm run lint` depends on.

Its goldens are full snapshots, not greps: `specs/lint/checker/_expected/*.txt` holds the exact lines the checker prints, including the chapter each message points a consumer at. A message that changes its wording moves its golden with it, in the same commit.

## The meta-test channel

Several truths about this package cannot be asserted from outside it, so they are asserted by running it on itself. Each of these exists because a defect class was found once and made unrepeatable (rule K1).

| Meta-test                                               | Holds                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/matching/match.test.ts`, `structural.test.ts` | Every `{{token}}` matches what it should and refuses what it should not — both directions                                                                                                                                                         |
| `src/lint/plugin.test.ts`                               | Catalogue **freshness** (regenerating reproduces the committed projections byte-for-byte) and **completeness** (every shipped rule carries `meta.docs`, every manifest entry maps to an implementation), plus the standing rule↔fixture inventory |
| `src/lint/docs-typecheck.test.ts`                       | Every framework code block in `docs/*.md` and `README.md` typechecks against the real surface, so a sample cannot outlive the API it calls                                                                                                        |
| `src/lint/env-allowlist.test.ts`                        | No `process.env` read outside `TEST_UPDATE` and vitest's own `VITEST_POOL_ID` (rule E1)                                                                                                                                                           |
| `src/lint/facet-matrix.test.ts`                         | The documented per-facet method matrix still matches the real facet interfaces                                                                                                                                                                    |
| `src/lint/package-exports.test.ts`                      | The subpath exemption is read from the manifest's `exports` map, not from a list a rule remembers                                                                                                                                                 |
| `specs/lint/meta/k4-reach-per-path.test.ts`             | The REACH of a rule, on one fixture project laid out with every path role and a single oxlint run (rule K4)                                                                                                                                       |
| `src/type-channel.test-d.ts`                            | What the COMPILER refuses — A8, A11, B1, B3, D1, M2, W6 — each as an `@ts-expect-error` that fails the day the line it marks starts compiling                                                                                                     |

`src/lint/plugin.test.ts` also holds the seven-channel contract: every row of
every channel carries the proof that channel can give — a rule file and a
fixture pair, an assertion on a resolved upstream option, a bundled checker
pass, a `// RUNTIME <ID>` marker above the spec that drives the refusal, a line
of the type-channel file, a named meta-test. A row that loses its proof fails
that test rather than going quietly stale.

The freshness meta-test is the reason a documentation change can turn the suite red: edit the generated catalogue by hand and it fails, correctly. Regenerate instead — the gesture is [02 — Developing](02-developing.md)'s.

## Goldens and update mode

A fixture the framework compares against is regenerated, never hand-tuned:

```bash
TEST_UPDATE=1 npx vitest --run --project unit   # or: npx vitest --run -u
```

Update mode writes **tokens, not values**: a segment already covered by a placeholder survives, and values known to be volatile — the working directory among them — are substituted back into placeholders (rule D5). Run the suite again afterwards; a fixture that does not round-trip on the second run was not a golden, it was a transcript.

Two fixture kinds are exactly wrong to update blindly, and they are the same trap twice: one that is deliberately WRONG (its diff is the behaviour under test) and one that is deliberately MISSING (its error is the behaviour under test). Update mode overwrites both into silence — [08 — Assertions](08-assertions.md) works the case.

## What CI runs

The workflow is `.github/workflows/validate.yaml`, on every push to `main` and every pull request, delegating to the estate's shared `validate.yaml`. It restores `.artifacts/`, then runs `make build`, `make lint` and `make test` in that order, with chromium provisioned because the website specs drive a real browser. The same three targets are what a local run owes before a push; the ordering is not decorative, since lint loads what build produced.

## Pitfalls

- **Running the lint specs on a stale `dist/`.** `specs/lint/**` and `oxlint.config.ts` both load `dist/oxlint.js`. Without `npm run build`, the suite judges the previous build's rules and reports a green that means nothing.
- **Hand-editing a golden under `specs/lint/checker/_expected/`.** Those are full-output snapshots of a real binary. Change the message in the code and regenerate with `TEST_UPDATE=1`; a hand-tuned golden asserts your typing, not the checker's output.
- **Expecting `npm test` to pass with Docker stopped.** Only `unit` and `cli` are infrastructure-free. The Docker-backed tests self-skip inside them, but `api`, `jobs` and `integration` fail honestly.
- **Adding a test at a facet root.** `specs/<facet>/<aspect>.spec.ts` is refused by `c1-domain-structure` in this repository's default depth — the runner lives at the root, the tests live one level down.
- **Writing a facet spec with the unit’s suffix.** `c12-spec-file-name` refuses it and `jterrazz-test-check specs --fix` renames it with `git mv` — and names every include glob of the member that still says `.test.ts`, since a glob the rename leaves behind collects nothing and the run stays green with fewer files. The reverse — a `.spec.ts` with no `specs/` ancestor — is the member pass's finding.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [08 — Assertions](08-assertions.md) · [12 — Conventions](12-conventions.md) · [13 — Linting](13-linting.md)
