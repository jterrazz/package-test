# 03 — Testing

What proves a change here: this package specifies itself with itself. The suites under `specs/` are written with `@jterrazz/test` against fixture apps, the module tests sit beside the modules they cover, and a family of meta-tests runs the framework on its own output. This chapter says which suite answers for what, and what a change owes each of them.

**The suffix says the kind.** `.test.ts` is the UNIT's word and sits beside the module it covers; `.test.tsx` is the same law for a rendered unit; `.spec.ts` is the ASSEMBLED product's word and lives under `specs/<facet>/`; a literate document stays `<case>.spec.yaml`. C12 holds both directions and its `--fix` renames with `git mv`, so a reader can tell what a file proves without opening it.

| Ground          | Where                                     | Proves                                                                 |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Module tests    | `src/**/<file>.test.ts`                   | One module's behaviour, beside it (rule I2)                            |
| Component tests | `specs/component-app/<file>.test.tsx`     | A rendered unit, beside it, in a real Chromium ([07](07-component.md)) |
| Product specs   | `specs/<facet>/<domain>/<aspect>.spec.ts` | The framework's own facets, through the public surface                 |
| Spec documents  | `specs/cli/literate/*.spec.yaml`          | The document format, collected as test files by `literate()`           |
| Meta-tests      | `src/lint/*.test.ts`                      | The framework applied to itself and to its own projections             |

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

Why a file is reached by its ROLE and named by its suffix, and what was weighed against it: [ADR-006](decisions/006-the-catalogue-reaches-a-file-by-its-role.md).

**`specs/lint/` is a repository suite, and it keeps `.test.ts`.** A repository suite covers a TREE rather than one assembled product: these files run the plugin and the checker over fixture PROJECTS, one per rule, and what they specify is a convention over a repository's shape. Its first level is not one of the six facets, so C12's rename clause never reaches it, C1's declared depth is what judges it, and `unit()` is what collects it — the shape the constitution calls [the third door](18-conventions.md#the-third-door-a-repository-suite).

**The `unit` project's budget is the whole suite's floor.** It collects the module tests and the lint suite and runs with no service, no browser and no container, so it is the one project a developer runs on every save: the same tree takes between nine and eleven seconds on consecutive runs of a developer machine, and **the budget it may not pass is twelve**. The budget is set above the range and not at the best measurement, because a budget set at the best measurement is a budget that fails on noise. The meta-test that proves every rule's reach (`k4-reach-per-path`) runs inside it on ONE oxlint run for the same reason.

Every FACET folder under `specs/` belongs to a constructor, and the one folder that is not a facet says so in its name: `specs/component-app/` is the rendered subject this package ships, and its component tests sit beside its components because that is what a rendered unit's test does (A2, I2). A probe of a container seam — the postgres and redis handles — is a module against a real service, so it is an integration spec: `specs/integration/<seam>/`, on `specification.integration({ services })` and its one terminal action. What the seam answers BEFORE it reaches a container, and the one adapter the public entry does not publish (`TestcontainersAdapter`), are module tests beside their modules under `src/seams/` — a spec reaches the framework through its public entry, and a probe that cannot is telling you where it belongs (rule F3).

```bash
npm test                            # every project — Docker and chromium both required
npx vitest --run --project unit     # the loop: no infrastructure, after npm run build
npx vitest --run --project website  # after npx playwright install chromium
npx vitest --run --project component  # the same chromium, a mounted unit at a time
```

There is no mobile tree under `specs/`, and that is a hole this chapter states rather than hides: an iOS simulator is not something CI provisions, so the mobile facet is proven by module tests under `src/facets/mobile/` — the simulator resolution, the page-source projection, the ambiguity messages — and by nothing end-to-end.

A second hole is the RENDERER's, and it is not this repository's to close: a React Native screen never reaches the real Chromium the component facet mounts in, so jest stays on that surface until the `react-native-web` spike says otherwise — [07 — Component specs](07-component.md) lists it with the other three shapes the facet does not take.

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
calendar (`clock`) — and a facet that gives one of them a FOLDER calls it by
that name, so `specs/api/clock/` and `specs/website/clock/` are the same
question asked of two constructors. Everything else is one facet's own, and a
name that is one facet's own is never another's: two names for one capability
is the drift the vocabulary exists to stop.

It says nothing about where a METHOD may appear. `.seed()` is used inside jobs'
`triggering/` scenarios and integration's `call/` ones, because seeding is the
Given there and not the subject; a capability earns a folder when it is what
the specs in it are ABOUT.

The vocabulary is declared in `src/lint/domains.ts` and `domains.test.ts` holds
the tree equal to it in both directions — a folder nothing declares fails, and
a declared name nothing carries fails too.

<!-- GENERATED:domains — do not edit by hand; run `npm run docs`. Source: src/lint/domains.ts -->

| Facet         | Shared domains it carries                                        | Its own                                               |
| ------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `api`         | `assertions/`, `clock/`, `intercepts/`, `lifecycle/`, `seeding/` | `initiation-errors/`, `requests/`, `responses/`       |
| `cli`         | `assertions/`, `seeding/`, `tokens/`                             | `directory/`, `docker/`, `env/`, `exec/`, `literate/` |
| `integration` | `clock/`, `intercepts/`                                          | `call/`, `golden/`, `postgres/`, `redis/`             |
| `jobs`        | —                                                                | `triggering/`                                         |
| `website`     | `assertions/`, `clock/`                                          | `console/`, `fetch/`, `services/`, `visit/`           |

<!-- /GENERATED:domains -->

A test at a facet root is forbidden and a `*.specification.ts` inside a domain is forbidden; a leading underscore means ground, never a domain. Which of the two legal shapes a given tree takes — its own domain, or sibling tests in a named group folder — is decided by the assets, and that judgement is the process channel's ([18 — Conventions](18-conventions.md)).

The fixture apps the specs drive live in the pool: `app` and `website-app` for the served facets, `cli-app`, `docker-cli`, `checker-cli` and `lint-cli` for the command facets, the `broken-*` trees for the infrastructure failure paths, and `lint-violations/` — a violation/compliant twin per lint rule.

**The component tree is the one exception, and the exception is the rule it dogfoods.** A rendered unit's test sits BESIDE the unit, so `specs/component-app/` holds the fixture app and its specs as neighbours — a table with a contract, a form carrying every verb, a modal hook with its Host in the test, a routed link, a vanilla-DOM list, a clock stamp, a noisy panel, a responsive note, a control that refuses input and a pair of links whose names overlap. It is not under `_fixtures/`: ground is what a spec stands on from a distance, and here the spec stands next to it. The exception is HELD by rules, not granted by omission: I2 requires every one of those `.test.tsx` files to have the `.tsx` (or the `.ts` of a hook) of the same basename beside it, and C1's row says a `.test.tsx` is out of its reach because a rendered unit never lives in a facet/domain tree.

## The layered reading

The package proves itself in five layers, and they are meant to be read from the inside out: a module against its own exports, a rule against its own fixtures, a facet against its own tree, the built binary against a fixture project, and the CORPUS against what a meta-test says it must keep true. Each layer judges something the one below it cannot — and the meta-tests are counted apart rather than folded into the module tests, because what they judge is the one thing a test beside a module cannot see.

<!-- GENERATED:layers — do not edit by hand; run `npm run docs`. Source: src/lint/matrix.ts -->

| Layer                   | Where                                                   | What it judges                                                           | Files |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ | ----- |
| Module tests            | `src/**/*.test.ts` beside the module                    | one module, through its own exports, with nothing started                | 52    |
| Rule tests              | `src/lint/rules/<facet>/<rule>.test.ts` beside the rule | one rule: what it flags, what it leaves alone, and the message it prints | 56    |
| The package’s own specs | `specs/<facet>/`                                        | the framework's own facets, each met through its constructor             | 66    |
| The lint suite          | `specs/lint/**`                                         | the built binary end to end, over fixture projects                       | 88    |
| Meta-tests              | `src/lint/*.test.ts`                                    | the corpus itself: the catalogue, the matrix, the cards, the floor       | 18    |

<!-- /GENERATED:layers -->

The counts are generated: a layer that stops growing while the surface does is visible here before it is visible in a bug.

## The lint suite is end-to-end

`specs/lint/**` runs the REAL oxlint binary and the real checker over the fixture projects and goldens their output, grouped by convention family (`runners/`, `chains/`, `files/`, `assertions/`, `imports/`, `architecture/`, `hygiene/`, `website/`, `checker/`, `meta/`). Because it loads `dist/oxlint.js`, `npm run build` must precede it — the same ordering `npm run lint` depends on.

Its goldens are full snapshots, not greps: `specs/lint/checker/_expected/*.txt` holds the exact lines the checker prints, including the chapter each message points a consumer at. A message that changes its wording moves its golden with it, in the same commit.

## Coverage is a ratchet, not a threshold

`npx vitest --run --coverage` turns on v8 — the runtime's own counter, so there
is no instrumentation pass and the numbers do not move when the bundler does —
and writes three reports where the preset sends them ([02 — Developing §
Artefacts live under `.artifacts/`](02-developing.md#artefacts-live-under-artifacts)):
`text` for the person who ran it, `html` for the one chasing a line, and
`json-summary`, which is the one a machine reads.

`npm run coverage` records where the suite stands in `coverage.baseline.json`;
`npm run coverage:check` refuses a run that fell below it. Neither runs the
suite: both read the report of the LAST `--coverage` run, which is why
`make test` runs the suite WITH coverage (`npm test -- --coverage`) before the
gate — a plain `npm test` would leave it judging an older run, or, on a fresh
clone where `.artifacts/` does not exist yet, nothing at all. That target is
the one CI calls ([What CI runs](#what-ci-runs)), so the floor is judged on
every push. It only ever rises: lowering it is an edit to a committed file,
with a commit body saying why.

### One floor, over the whole suite

The baseline is keyed by scope and the CLI
takes `--scope`, so a project can keep its own; this repository records `all`
and nothing else, because the projects overlap — the browser projects and the
node ones both execute `model/`, and four floors summing to more than the tree
would ratchet on which project happened to run. A scope missing any of the four
metrics is refused rather than read as a zero, since a floor of zero forbids
nothing.

### Why a ratchet and not a threshold

A fixed threshold would be a number somebody picked. Set it where the project
stands and it forbids nothing; set it where the project should be and every run
is red until it gets there, which is how a gate becomes something people pass
with `--no-verify`. A ratchet asks the only question a gate can answer
honestly: is this change worse than the last one?

### What the report excludes

What the report EXCLUDES is the shape of the answer, not a way to raise the
number: `node_modules/` (Browser Mode instruments the page's bundle, and
react-dom alone is 19 000 statements), `specs/` and `_fixtures/` (a spec is a
test and the app it drives is ground), the type-only and config files.

## Modules with no sibling test

I2 says a module test lives beside its module. It never said every module has
one, and it cannot: a barrel executes nothing, a `*.port.ts` declares a shape,
and a facet's constructor is proven by the tree that constructs it. What was
missing is the LIST of the ones that do not, and why — a module with real
behaviour, no sibling test and nobody able to say what covers it is the silence
this section closes.

`src/lint/siblings.ts` declares the kinds, each naming the PATHS it claims —
never a prefix, because a kind claiming `src/seams/` would claim every module
written there next year and K7 would be a poster. **K7** fails on a module that
matches none of them, which is what makes a new, unclaimed module fail the
suite on the day it lands.

<!-- GENERATED:siblings — do not edit by hand; run `npm run docs`. Source: src/lint/siblings.ts -->

Today **81 modules** have no sibling test, and every one of them is claimed:

| Kind                                    | Proven instead by                                                                                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| composition root or barrel (4)          | it wires and re-exports; what it publishes is held by `package-exports.test.ts` and by every spec that imports the entry                                                                                                                       |
| type-only declaration (11)              | it declares a shape and executes nothing; the compiler is its test, and `type-channel.test-d.ts` holds what the compiler must refuse                                                                                                           |
| constant data (3)                       | it is a table, not a behaviour; every reader of it asserts on it (`preset.test.ts` for the artefact paths, `plugin.test.ts` for the manifest)                                                                                                  |
| the facet file set, as a re-export (12) | the six node facets share one builder, so these name it rather than implement it — `builder.test.ts` and `facet-matrix.test.ts` hold the thing they name                                                                                       |
| a facet's vitest project (7)            | `projects.test.ts` builds every one of them and asserts the project it produces                                                                                                                                                                |
| a mobile module that needs a device (2) | the mobile facet has no tree under `specs/` and cannot have one here (M1); what a device is NOT needed for — resolving the simulator, projecting the page source, wording the ambiguity — has its own sibling test, and these two are the rest |
| a facet module (8)                      | the facet is proven end to end by its own tree under `specs/<facet>/`, which is what the constructor exists to make possible                                                                                                                   |
| a result accessor (7)                   | an accessor is what a terminal action hands back: it is exercised by every spec that asserts on a result, and `result.test.ts` holds the base                                                                                                  |
| a seam adapter (13)                     | a seam is proven through the facet that drives it — a probe that could only reach it directly is an integration spec under `specs/integration/<seam>/` (chapter 03)                                                                            |
| a bundled CLI entry (3)                 | it is argument parsing over a module that has its own tests, and `specs/lint/` runs the built binary end to end                                                                                                                                |
| a lint-layer module (4)                 | the lint layer is proven by the rule tests beside each rule and by `specs/lint/`, which runs the real oxlint binary and the real checker over fixture projects                                                                                 |
| a chain or runner internal (7)          | it is reached through the chain, so its proof is the facet specs that drive the chain — a direct test would assert on a seam nothing else speaks to                                                                                            |

<!-- /GENERATED:siblings -->

A new module that matches no kind fails the meta-test, which is the moment to
write the test — not six months later, when a coverage number moved.

## The capability matrix

The catalogue in [19 — Linting](19-linting.md) answers "which conventions are
mechanized". This answers the other half: for each thing the framework can DO,
which facets declare it, and how many of the package's own test files exercise
it there.

It is generated by `npm run docs` from the facet declaration
(`src/lint/facet-matrix.ts`), the `{{token}}` list the runner and the checker
already share, and a scan of the trees each column owns. The same table is the
skill's `references/matrix.md`.

<!-- GENERATED:matrix — do not edit by hand; run `npm run docs`. Source: src/lint/matrix.ts -->

What the framework can do, and how many of this package’s own test FILES carry the literal that exercises it, per facet (comments stripped, so a sentence about a capability never counts as a test of it). A blank (`—`) is a capability the facet does not declare; a `0` is a declared capability nothing here exercises, and every one of them is named under **Exemptions** with the reason it is accepted. `matrix.test.ts` fails on a `0` that is not.

### Constructor option

| Capability  | api | jobs | cli | integration | website | mobile | component | module |
| ----------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `services`  | 2   | 1    | 1   | 2           | 1       | 0      | —         | —      |
| `root`      | 2   | 1    | 0   | 2           | 0       | 0      | 0         | —      |
| `server`    | 4   | —    | —   | —           | 3       | —      | —         | —      |
| `jobs`      | —   | 2    | —   | —           | —       | —      | —         | —      |
| `url`       | —   | —    | —   | —           | 0       | —      | —         | —      |
| `backend`   | —   | —    | —   | —           | 0       | 0      | —         | —      |
| `external`  | —   | —    | —   | —           | 0       | —      | —         | —      |
| `device`    | —   | —    | —   | —           | —       | 0      | —         | —      |
| `app`       | —   | —    | —   | —           | —       | 0      | —         | —      |
| `timeouts`  | —   | —    | —   | —           | —       | 0      | —         | —      |
| `defaults`  | —   | —    | 1   | —           | —       | —      | —         | —      |
| `env`       | —   | —    | 4   | —           | —       | —      | —         | —      |
| `docker`    | —   | —    | 1   | —           | —       | —      | —         | —      |
| `serve`     | —   | —    | 4   | —           | —       | —      | —         | —      |
| `transform` | —   | —    | 2   | —           | 1       | —      | —         | —      |
| `wrap`      | —   | —    | —   | —           | —       | —      | 1         | —      |
| `vite`      | —   | —    | —   | —           | —       | —      | 1         | —      |
| `clock`     | —   | —    | —   | —           | —       | —      | 0         | —      |
| `locale`    | —   | —    | —   | —           | —       | —      | 0         | —      |
| `timezone`  | —   | —    | —   | —           | —       | —      | 0         | —      |
| `viewport`  | —   | —    | —   | —           | —       | —      | 0         | —      |

### Setup

| Capability     | api | jobs | cli | integration | website | mobile | component | module |
| -------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.clock()`     | 1   | 0    | —   | 1           | 1       | —      | 1         | —      |
| `.intercept()` | 3   | 1    | —   | 1           | 0       | 0      | 4         | —      |
| `.seed()`      | 4   | 1    | 1   | 2           | —       | —      | —         | —      |
| `.headers()`   | 1   | —    | —   | —           | 1       | —      | —         | —      |
| `.fixture()`   | —   | —    | 6   | —           | —       | —      | —         | —      |
| `.env()`       | —   | —    | 1   | —           | —       | —      | —         | —      |
| `.wrap()`      | —   | —    | —   | —           | —       | —      | 2         | —      |
| `.viewport()`  | —   | —    | —   | —           | —       | —      | 1         | —      |

### Terminal action

| Capability   | api | jobs | cli | integration | website | mobile | component | module |
| ------------ | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.get()`     | 9   | —    | —   | —           | —       | —      | —         | —      |
| `.post()`    | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.put()`     | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.delete()`  | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.request()` | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.trigger()` | —   | 1    | —   | —           | —       | —      | —         | —      |
| `.call()`    | —   | —    | —   | 6           | —       | —      | —         | —      |
| `.exec()`    | —   | —    | 7   | —           | —       | —      | —         | —      |
| `.run()`     | —   | —    | 2   | —           | —       | —      | —         | —      |
| `.visit()`   | —   | —    | —   | —           | 11      | —      | —         | —      |
| `.fetch()`   | —   | —    | —   | —           | 2       | —      | —         | —      |
| `.open()`    | —   | —    | —   | —           | —       | 0      | —         | —      |
| `.render()`  | —   | —    | —   | —           | —       | —      | 14        | —      |

### Verb

| Capability | api | jobs | cli | integration | website | mobile | component | module |
| ---------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `see`      | —   | —    | —   | —           | 6       | 0      | 14        | —      |
| `fill`     | —   | —    | —   | —           | 3       | 0      | 2         | —      |
| `click`    | —   | —    | —   | —           | 3       | —      | 4         | —      |
| `gone`     | —   | —    | —   | —           | 2       | —      | 4         | —      |
| `press`    | —   | —    | —   | —           | 0       | —      | 2         | —      |
| `hover`    | —   | —    | —   | —           | 0       | —      | 1         | —      |
| `check`    | —   | —    | —   | —           | 0       | —      | 2         | —      |
| `select`   | —   | —    | —   | —           | 1       | —      | 2         | —      |
| `goto`     | —   | —    | —   | —           | 0       | —      | —         | —      |
| `tap`      | —   | —    | —   | —           | —       | 0      | —         | —      |
| `rerender` | —   | —    | —   | —           | —       | —      | 1         | —      |
| `unmount`  | —   | —    | —   | —           | —       | —      | 1         | —      |

### Descriptor

| Capability      | api | jobs | cli | integration | website | mobile | component | module |
| --------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `button`        | —   | —    | —   | —           | 3       | 0      | 4         | —      |
| `field`         | —   | —    | —   | —           | 4       | 0      | 3         | —      |
| `content`       | —   | —    | —   | —           | 3       | 0      | 10        | —      |
| `testId`        | —   | —    | —   | —           | 0       | 0      | 1         | —      |
| `heading`       | —   | —    | —   | —           | 0       | —      | 1         | —      |
| `link`          | —   | —    | —   | —           | 2       | —      | 2         | —      |
| `dialog`        | —   | —    | —   | —           | 0       | —      | 1         | —      |
| `status`        | —   | —    | —   | —           | 0       | —      | 2         | —      |
| `table`         | —   | —    | —   | —           | 0       | —      | 1         | —      |
| `row`           | —   | —    | —   | —           | 0       | —      | 1         | —      |
| `listitem`      | —   | —    | —   | —           | 0       | —      | 1         | —      |
| `option`        | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `banner`        | —   | —    | —   | —           | 0       | —      | 0         | —      |
| `complementary` | —   | —    | —   | —           | 0       | —      | 0         | —      |
| `contentinfo`   | —   | —    | —   | —           | 1       | —      | 0         | —      |
| `form`          | —   | —    | —   | —           | 0       | —      | 0         | —      |
| `main`          | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `navigation`    | —   | —    | —   | —           | 1       | —      | 2         | —      |
| `region`        | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `search`        | —   | —    | —   | —           | 0       | —      | 0         | —      |
| `within`        | —   | —    | —   | —           | 2       | —      | 5         | —      |
| `focused`       | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `selected`      | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `valued`        | —   | —    | —   | —           | 1       | —      | 2         | —      |
| `disabled`      | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `enabled`       | —   | —    | —   | —           | 1       | —      | 1         | —      |

### Result accessor

| Capability      | api | jobs | cli | integration | website | mobile | component | module |
| --------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.response`     | 7   | —    | —   | —           | —       | —      | —         | —      |
| `.status`       | 3   | —    | —   | —           | 2       | —      | —         | —      |
| `.table()`      | 4   | 1    | 1   | 1           | —       | —      | —         | —      |
| `.file()`       | 0   | —    | 5   | 0           | —       | —      | —         | —      |
| `.directory()`  | 0   | —    | 2   | 0           | —       | —      | —         | —      |
| `.stdout`       | —   | —    | 5   | —           | —       | —      | —         | —      |
| `.stderr`       | —   | —    | 2   | —           | —       | —      | —         | —      |
| `.exitCode`     | —   | —    | 8   | —           | —       | —      | —         | —      |
| `.filesystem`   | —   | —    | 1   | —           | —       | —      | —         | —      |
| `.container()`  | —   | —    | 1   | —           | —       | —      | —         | —      |
| `.containerIds` | —   | —    | 1   | —           | —       | —      | —         | —      |
| `.value`        | —   | —    | —   | 6           | —       | —      | —         | —      |
| `.error`        | —   | —    | —   | 5           | —       | —      | —         | —      |
| `.tree`         | —   | —    | —   | —           | 2       | —      | 3         | —      |
| `.content`      | —   | —    | —   | —           | 4       | 0      | 11        | —      |
| `.console`      | —   | —    | —   | —           | 1       | —      | 3         | —      |
| `.errors`       | —   | —    | —   | —           | 4       | —      | 5         | —      |
| `.html`         | —   | —    | —   | —           | 0       | —      | 5         | —      |
| `.title`        | —   | —    | —   | —           | 0       | —      | —         | —      |
| `.url`          | —   | —    | —   | —           | 2       | —      | —         | —      |
| `.head`         | —   | —    | —   | —           | 3       | —      | —         | —      |
| `.jsonLd`       | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.canonical`    | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.alternates`   | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.links`        | —   | —    | —   | —           | 0       | —      | —         | —      |
| `.meta()`       | —   | —    | —   | —           | 2       | —      | —         | —      |
| `.body`         | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.json`         | —   | —    | 2   | —           | 1       | —      | —         | —      |
| `.headers`      | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.location`     | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.screen`       | —   | —    | —   | —           | —       | 0      | —         | —      |

### Golden

| Capability          | api | jobs | cli | integration | website | mobile | component | module |
| ------------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `toMatch('<name>')` | 3   | 0    | 6   | 5           | 5       | —      | 1         | 6      |
| `toMatchRows()`     | 4   | 1    | 1   | 1           | —       | —      | 0         | 4      |
| `.http exchange`    | 3   | —    | —   | —           | —       | —      | —         | 7      |
| `.aria.yaml tree`   | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `.json body`        | 0   | —    | 2   | 5           | 2       | —      | —         | 10     |
| `.txt stream`       | 1   | —    | 8   | 2           | 2       | —      | —         | 12     |
| `{ frozen }`        | 2   | —    | 5   | —           | —       | —      | 1         | 3      |

### Time & doubles

| Capability    | api | jobs | cli | integration | website | mobile | component | module |
| ------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `clock()`     | —   | —    | —   | —           | —       | —      | —         | 4      |
| `intercept()` | —   | —    | —   | —           | —       | —      | —         | 1      |
| `mockOf()`    | —   | —    | —   | —           | —       | —      | —         | 6      |
| `match.*`     | —   | —    | —   | —           | —       | —      | —         | 22     |

### Token

| Capability     | api | jobs | cli | integration | website | mobile | component | module |
| -------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `{{any}}`      | 0   | —    | 2   | 0           | 0       | —      | —         | 1      |
| `{{base64}}`   | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{date}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{duration}}` | 0   | —    | 1   | 0           | 0       | —      | —         | 2      |
| `{{email}}`    | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{float}}`    | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{hex}}`      | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{int}}`      | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{ip}}`       | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{iso8601}}`  | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{number}}`   | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{path}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{port}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{semver}}`   | 0   | —    | 2   | 0           | 0       | —      | —         | 1      |
| `{{sha}}`      | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{string}}`   | 0   | —    | 1   | 0           | 0       | —      | —         | 1      |
| `{{time}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{ulid}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{url}}`      | 0   | —    | 2   | 0           | 0       | —      | —         | 1      |
| `{{uuid}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 3      |
| `{{workdir}}`  | 0   | —    | 5   | 0           | 0       | —      | —         | 1      |

### Exemptions

- no mobile tree: an iOS simulator is not something CI provisions (M1) — `services`·mobile, `root`·mobile, `backend`·mobile, `device`·mobile, `app`·mobile, `timeouts`·mobile, `.intercept()`·mobile, `.open()`·mobile, `see`·mobile, `fill`·mobile, `tap`·mobile, `button`·mobile, `field`·mobile, `content`·mobile, `testId`·mobile, `.content`·mobile, `.screen`·mobile
- the surface ships and this package does not specify it here yet — `root`·cli, `root`·website, `root`·component, `backend`·website, `external`·website, `clock`·component, `locale`·component, `timezone`·component, `viewport`·component, `.clock()`·jobs, `.intercept()`·website, `press`·website, `hover`·website, `check`·website, `goto`·website, `testId`·website, `heading`·website, `dialog`·website, `status`·website, `table`·website, `row`·website, `listitem`·website, `banner`·website, `banner`·component, `complementary`·website, `complementary`·component, `contentinfo`·component, `form`·website, `form`·component, `search`·website, `search`·component, `.file()`·api, `.file()`·integration, `.directory()`·api, `.directory()`·integration, `.html`·website, `.title`·website, `.links`·website, `toMatchRows()`·component, `.json body`·api
- the package serves its own fixture site, so `server` is what it proves; `url` targets an already-running deployment, which is a consumer shape (A11 states the XOR) — `url`·website
- a job's oracle is the table it wrote (`toMatchRows`): its result carries no file and no directory — `toMatch('<name>')`·jobs
- the engine owns the family (proven in the module column); a facet uses the ones its goldens need — `{{any}}`·api, `{{any}}`·integration, `{{any}}`·website, `{{base64}}`·api, `{{base64}}`·cli, `{{base64}}`·integration, `{{base64}}`·website, `{{date}}`·api, `{{date}}`·cli, `{{date}}`·integration, `{{date}}`·website, `{{duration}}`·api, `{{duration}}`·integration, `{{duration}}`·website, `{{email}}`·api, `{{email}}`·cli, `{{email}}`·integration, `{{email}}`·website, `{{float}}`·api, `{{float}}`·cli, `{{float}}`·integration, `{{float}}`·website, `{{hex}}`·api, `{{hex}}`·cli, `{{hex}}`·integration, `{{hex}}`·website, `{{int}}`·api, `{{int}}`·cli, `{{int}}`·integration, `{{int}}`·website, `{{ip}}`·api, `{{ip}}`·cli, `{{ip}}`·integration, `{{ip}}`·website, `{{iso8601}}`·api, `{{iso8601}}`·cli, `{{iso8601}}`·integration, `{{iso8601}}`·website, `{{number}}`·api, `{{number}}`·cli, `{{number}}`·integration, `{{number}}`·website, `{{path}}`·api, `{{path}}`·cli, `{{path}}`·integration, `{{path}}`·website, `{{port}}`·api, `{{port}}`·cli, `{{port}}`·integration, `{{port}}`·website, `{{semver}}`·api, `{{semver}}`·integration, `{{semver}}`·website, `{{sha}}`·api, `{{sha}}`·cli, `{{sha}}`·integration, `{{sha}}`·website, `{{string}}`·api, `{{string}}`·integration, `{{string}}`·website, `{{time}}`·api, `{{time}}`·cli, `{{time}}`·integration, `{{time}}`·website, `{{ulid}}`·api, `{{ulid}}`·cli, `{{ulid}}`·integration, `{{ulid}}`·website, `{{url}}`·api, `{{url}}`·integration, `{{url}}`·website, `{{uuid}}`·api, `{{uuid}}`·cli, `{{uuid}}`·integration, `{{uuid}}`·website, `{{workdir}}`·api, `{{workdir}}`·integration, `{{workdir}}`·website

<!-- /GENERATED:matrix -->

## The meta-test channel

Several truths about this package cannot be asserted from outside it, so they are asserted by running it on itself. Each of these exists because a defect class was found once and made unrepeatable (rule K1).

The table is GENERATED from the files, because the channel grows faster than a hand-kept list: what a row holds is the file's own `describe` titles, so a meta-test that lands is a row the next `npm run docs` writes.

<!-- GENERATED:meta-tests — do not edit by hand; run `npm run docs`. Source: src/lint/meta-tests.ts -->

**19 files** are the channel — every `*.test.ts` directly under `src/lint/`, plus the suite that needs the real binary. What each one holds is its own `describe` titles, read from the file:

| Meta-test                                   | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Tests |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `src/lint/ast.test.ts`                      | specsAnchor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 7     |
| `src/lint/cards.test.ts`                    | signature cards — generation freshness (meta-test) · signature cards — completeness against the facet declaration (meta-test) · the skill routes to the cards (meta-test) · signature cards — what a card says                                                                                                                                                                                                                                                                                       | 15    |
| `src/lint/checker-crossfile.test.ts`        | checker suppression — suppressedLines (checker-disable comments)                                                                                                                                                                                                                                                                                                                                                                                                                                     | 9     |
| `src/lint/checker-member.test.ts`           | the member pass — what a workspace member owes                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 17    |
| `src/lint/checker-spec.test.ts`             | fixSpecDocument — key order and block scalars                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 5     |
| `src/lint/checker.test.ts`                  | conventions checker — findUnknownTokens (D4) · conventions checker — findKnownTokens (D10) · conventions checker — checkConventionFiles (D4)                                                                                                                                                                                                                                                                                                                                                         | 8     |
| `src/lint/coverage.test.ts`                 | the coverage ratchet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 8     |
| `src/lint/docs-typecheck.test.ts`           | docs-typecheck — block selection · docs-typecheck — the published samples typecheck · docs-typecheck — the corpus does not await a sync matcher · docs-typecheck — harness                                                                                                                                                                                                                                                                                                                           | 6     |
| `src/lint/domains.test.ts`                  | the spec tree’s domain vocabulary                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 4     |
| `src/lint/env-allowlist.test.ts`            | framework env reads — e1-env-allowlist (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 4     |
| `src/lint/facet-matrix.test.ts`             | facet capability declaration (K1 guard)                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 6     |
| `src/lint/matrix.test.ts`                   | capability matrix (meta-test K6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 5     |
| `src/lint/meta-tests.test.ts`               | the meta-test channel, read off its own files                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 3     |
| `src/lint/oxlint-pin.test.ts`               | the oxlint pin — the toolchain owns it and this manifest mirrors it                                                                                                                                                                                                                                                                                                                                                                                                                                  | 2     |
| `src/lint/package-exports.test.ts`          | package-exports — F1 reads the published contract · package-exports — the root has two runtimes and one type surface · package-exports — the tarball carries what a message points at                                                                                                                                                                                                                                                                                                                | 8     |
| `src/lint/plugin.test.ts`                   | the composable fragment — what a consumer wires · the upstream options this vocabulary owns (ADR-005) · conventions catalogue — generation freshness (meta-test) · conventions catalogue — completeness (meta-test) · testing fragment — standalone oxlint config · conventions catalogue — the channels answer for themselves (meta-test) · conventions catalogue — E2E inventory (meta-test) · the corpus’ own coordinates (meta-test K8) · the corpus never offers an option the rulebook refuses | 34    |
| `src/lint/role.test.ts`                     | roleOf — the kind a path states · isTestRole — the three kinds that DECLARE tests · isTestFile — what the test conventions reach                                                                                                                                                                                                                                                                                                                                                                     | 14    |
| `src/lint/siblings.test.ts`                 | modules with no sibling test (meta-test K7)                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 4     |
| `specs/lint/meta/k4-reach-per-path.test.ts` | lint — k4-reach-per-path (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 4     |

<!-- /GENERATED:meta-tests -->

One proof of the channel declares no test and appears in no row: `src/type-channel.test-d.ts` states what the COMPILER refuses — A8, A11, B1, B3, D1, M2, W6 — as an `@ts-expect-error` per row, and `typescript check` fails the day the line it marks starts compiling. It runs under the typechecker the whole repository already runs, never under a vitest project.

`src/lint/plugin.test.ts` also holds the seven-channel contract: every row of
every channel carries the proof that channel can give — a rule file and a
fixture pair, an assertion on a resolved upstream option, a bundled checker
pass, a `// RUNTIME <ID>` marker above the spec that drives the refusal, a line
of the type-channel file, a named meta-test. A row that loses its proof fails
that test rather than going quietly stale.

The freshness meta-test is the reason a documentation change can turn the suite red: edit the generated catalogue by hand and it fails, correctly. Regenerate instead — the gesture is [02 — Developing](02-developing.md)'s.

## Goldens and update mode

A fixture this repository compares against is regenerated, never hand-tuned, and the gesture here is the `unit` project:

```bash
TEST_UPDATE=1 npx vitest --run --project unit   # or: npx vitest --run -u
```

What update mode writes, what it preserves and the discipline it asks for are [15 — Tokens § Update mode](15-tokens.md#update-mode-tokens-are-preserved)'s, whole.

## What CI runs

The workflow is `.github/workflows/validate.yaml`, on every push to `main` and every pull request, delegating to the estate's shared `validate.yaml`. It restores `.artifacts/`, then runs `make build`, `make lint` and `make test` in that order, with chromium provisioned because the website specs drive a real browser. The same three targets are what a local run owes before a push; the ordering is not decorative, since lint loads what build produced.

**`make test` carries the floor.** It runs the suite WITH coverage and then `npm run coverage:check`, so the ratchet is judged on every push rather than trusted to whoever remembered to type `make check` — a gate CI never runs is a courtesy, not a gate. `make check` is still the whole verdict locally: build, lint, then that same target.

## Pitfalls

- **Running the lint specs on a stale `dist/`.** `specs/lint/**` and `oxlint.config.ts` both load `dist/oxlint.js`. Without `npm run build`, the suite judges the previous build's rules and reports a green that means nothing.
- **Hand-editing a golden under `specs/lint/checker/_expected/`.** Those are full-output snapshots of a real binary. Change the message in the code and regenerate with `TEST_UPDATE=1`; a hand-tuned golden asserts your typing, not the checker's output.
- **Expecting `npm test` to pass with Docker stopped.** Only `unit` and `cli` are infrastructure-free. The Docker-backed tests self-skip inside them, but `api`, `jobs` and `integration` fail honestly.
- **Adding a test at a facet root.** `specs/<facet>/<aspect>.spec.ts` is refused by `c1-domain-structure` in this repository's default depth — the runner lives at the root, the tests live one level down.
- **Writing a facet spec with the unit’s suffix.** `c12-spec-file-name` refuses it and `jterrazz-test-check specs --fix` renames it with `git mv` — and names every `include`/`exclude` entry of the member the rename broke — the globs whose prefix covers a file it moved and the literals naming one — since an entry the rename leaves behind collects nothing and the run stays green with fewer files. The reverse — a `.spec.ts` with no `specs/` ancestor — is the member pass's finding.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [14 — Assertions](14-assertions.md) · [18 — Conventions](18-conventions.md) · [19 — Linting](19-linting.md)
