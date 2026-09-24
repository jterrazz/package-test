# 03 — Testing

What proves a change here: this package specifies itself with itself. The suites under `specs/` are written with `@jterrazz/test` against fixture apps, the module tests sit beside the modules they cover, and a family of meta-tests runs the framework on its own output. This chapter says which suite answers for what, and what a change owes each of them.

**The suffix says the kind.** `.test.ts` is the UNIT's word and sits beside the module it covers; `.test.tsx` is the same law for a rendered unit; `.spec.ts` is the ASSEMBLED product's word and lives under `specs/<facet>/`; a literate document stays `<case>.spec.yaml`. C12 holds both directions and its `--fix` renames with `git mv`, so a reader can tell what a file proves without opening it.

| Ground          | Where                                      | Proves                                                                                  |
| --------------- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| Module tests    | `src/**/<file>.test.ts`                    | One module's behaviour, beside it (rule I2)                                             |
| Component tests | `specs/component/<file>.test.tsx`          | A rendered unit, beside it, in a real Chromium ([07](07-component.md))                  |
| Product specs   | `specs/<facet>/<subject>/<aspect>.spec.ts` | The framework's own facets, through the public surface                                  |
| Spec documents  | `specs/cli/<domain>/<case>.spec.yaml`      | A cli session as data, collected as a test file by `literate()` ([20](20-documents.md)) |
| Meta-tests      | `lint/*.test.ts`                           | The framework applied to itself and to its own projections                              |

## The eight projects

`test.projects` in `vitest.config.ts` declares eight, and which one you can run is decided by what is installed and running on the machine.

| Project       | Collects                                                                                        | Needs                                                                |
| ------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `unit`        | `src/**/*.test.ts` + `specs/lint/**/*.test.ts`, built by `unit()`                               | Nothing — the lint specs need `npm run build` first                  |
| `cli`         | `specs/cli/**`, built by `cli()` — its documents included, through `literate()`                 | Nothing — the Docker specs self-skip                                 |
| `api`         | `specs/api/**`, built by `api()` (node mode, in-process Hono)                                   | Docker                                                               |
| `jobs`        | `specs/jobs/**`, built by `jobs()`                                                              | Docker                                                               |
| `integration` | `specs/integration/**`, built by `integration({ serial: true })` — the container seams included | Docker                                                               |
| `website`     | `specs/website/**`, built by `website()`                                                        | playwright + `npx playwright install chromium`; no Docker            |
| `component`   | `specs/component/**/*.test.tsx`, built by `component()`                                         | the same chromium; no Docker. Runs in its own group, after `website` |
| `mobile`      | `specs/mobile/**`, built by `mobile()` — serial by default, one driver session per run          | Nothing — the Appium protocol double, served once per run            |

Every project the package runs comes from a helper, so `--project api` means the same tree here as in any consumer — `unit()` included, with the globs it takes naming the one specs tree that is no facet's. A member without `"type": "module"` writes its config as `vitest.config.mts`: the helpers ship ESM only, a CJS config would have to `require()` them, and `roleOf` already reads `.mts` as the config role — so the rules that judge a config still find it.

Why a file is reached by its ROLE and named by its suffix, and what was weighed against it: [ADR-006](decisions/006-the-catalogue-reaches-a-file-by-its-role.md).

**`specs/lint/` is a repository suite, and it keeps `.test.ts`.** A repository suite covers a TREE rather than one assembled product: these files run the plugin and the checker over fixture PROJECTS, one per rule, and what they specify is a convention over a repository's shape. Its first level is not one of the six facets, so C12's rename clause never reaches it, C1's declared depth is what judges it, and `unit()` is what collects it — the shape the constitution calls [the third door](18-conventions.md#the-third-door-a-repository-suite).

**The `unit` project's budget is the whole suite's floor.** It collects the module tests and the lint suite and runs with no service, no browser and no container, so it is the one project a developer runs on every save: the same tree takes between nine and eleven seconds on consecutive runs of a developer machine, and **the budget it may not pass is twelve**. The budget is set above the range and not at the best measurement, because a budget set at the best measurement is a budget that fails on noise. The meta-test that proves every rule's reach (`k4-reach-per-path`) runs inside it on ONE oxlint run for the same reason.

Every FACET folder under `specs/` is named for its facet: six belong to a constructor, and `specs/component/` to the one facet that is a chain — it is the rendered subject this package ships, and its component tests sit beside its components because that is what a rendered unit's test does (A2, I2). A probe of a container seam — the postgres and redis handles — is a module against a real service, so it is an integration spec: `specs/integration/<seam>/`, on `specification.integration({ services })` and its one terminal action. What the seam answers BEFORE it reaches a container, and the one adapter the public entry does not publish (`TestcontainersAdapter`), are module tests beside their modules under `src/seams/` — a spec reaches the framework through its public entry, and a probe that cannot is telling you where it belongs (rule F3).

```bash
npm test                            # every project — Docker and chromium both required
npx vitest --run --project unit     # the loop: no infrastructure, after npm run build
npx vitest --run --project website  # after npx playwright install chromium
npx vitest --run --project component  # the same chromium, a mounted unit at a time
```

**The mobile tree runs two ways, and the specs are the same both times.** `specs/mobile/` drives Specimen, a small native app. In every run — `make check`, CI — its runner connects to `specs/shared/fixtures/appium-double/`: a WebDriver server that answers like Appium's XCUITest driver, drawing the app from its description as data (`specs/shared/fixtures/specimen-mobile/specimen.ts`). Before a release, or when the appium adapter or the double changes, `make test-mobile` runs the same files against a real iOS simulator and the same app in SwiftUI; no CI job runs it, because CI provisions no simulator. The double proves the facet over the protocol, and only the simulator proves the double tells the truth about a device: a spec green on one and red on the other is a gap in the double. What the target does and needs is `specs/shared/fixtures/specimen-mobile/README.md`'s.

A second hole is the RENDERER's, and it is not this repository's to close: a React Native screen never reaches the real Chromium the component facet mounts in, so jest stays on that surface until the `react-native-web` spike says otherwise — [07 — Component specs](07-component.md) lists it with the other three shapes the facet does not take.

## How a spec tree is laid out

The layout is the one the conventions enforce on every consumer (rules C1, C29, C30, C35), and this repository is its first consumer — with one difference an application never meets: every app its specs drive is a SPECIMEN, kept as ground under `specs/shared/fixtures/`, so every spec here specifies the FRAMEWORK, and is filed by the CAPABILITY it asks about rather than by the route, the command or the job it reaches ([18 — Conventions § A specimen's spec](18-conventions.md#a-specimens-spec)). A facet carries its runners at its ROOT and its tests one folder below, one file per aspect of the capability:

```
specs/
├── api/
│   ├── api.specification.ts          # runners at the facet root
│   ├── intercepts.specification.ts
│   └── intercept/                    # the capability, named as the matrix names it
│       ├── exhausted.spec.ts         # one aspect asked of it
│       └── contracts/                # the contracts its specs declare
├── website/
│   └── visit/
└── shared/                           # the ground several leaves share, and nothing else:
    ├── fixtures/                     # the specimens and file state, reached by ../../shared/fixtures/…;
    └── seeds/                        # seeds/, requests/, expected/ share the same way
```

**The folder names come from the capability matrix below, and nowhere else** — C35 holds them to it. A capability belongs to no facet in particular, so a facet that gives one a folder calls it by the matrix's name — `specs/api/clock/`, `specs/jobs/clock/` and `specs/website/clock/` are the same question asked of three constructors, and two names for one capability is the drift a closed vocabulary stops. A facet takes only the capabilities its own column declares: `appium` is mobile's, so the spec of a mobile run's one Appium session sits in `specs/mobile/appium/`, though it runs its vitest projects through the cli runner. It says nothing about where a METHOD may appear: `.seed()` is used inside integration's `call/` scenarios, because seeding is the Given there and not the subject; a capability earns a folder when it is what the specs in it are ABOUT. An integration spec reaches the module of the shared fixtures its chains call (`orders`, whose `stamp` and `tally` are what `clock/` and `table/` call), and is filed the same way. A spec that reaches no specimen is out of that reach, and its folder is its author's: an integration spec calling a module written inline, which this tree never does; integration's seam specs under `services/`, which call the redis or postgres handle itself; and `specs/api/services/initiation-errors.spec.ts`, whose runners never start — each hands a `broken-*` tree to its services as their root, and a root no server command runs from is no app.

A test at a facet root is forbidden and a `*.specification.ts` inside a domain is forbidden; `fixtures/`, `expected/`, `requests/` and `seeds/` are ground, never a domain, and `shared/` directly under `specs/` is the shared ground, never a facet — deeper, a domain or a route's segment may take the word. Which of the two legal shapes a given tree takes — its own domain, or sibling tests in a named group folder — is decided by the assets, and that judgement is the process channel's ([18 — Conventions](18-conventions.md)).

The fixture apps the specs drive live in the pool, `specs/shared/fixtures/`, each a SPECIMEN named for the facet that drives it: `specimen-api` (which carries the jobs too), `specimen-api-outbound`, `specimen-jobs`, `specimen-website` and its `specimen-website-backend`, `specimen-cli` and its `-docker`, `-vitest` and `-literate` variants, and `specimen-mobile`, the mobile facet's; beside them, `checker-cli` and `lint-cli` for the lint suite, and the `broken-*` trees for the infrastructure failure paths. A lint rule's trees are not in the pool: a rule specified by documents keeps them in its own `specs/lint/<rule-id>/fixtures/`, and the checker's twins sit in `specs/lint/checker/fixtures/`.

**The component tree is the one exception, and the exception is the rule it dogfoods.** A rendered unit's test sits BESIDE the unit, so `specs/component/` holds the fixture app and its specs as neighbours — a table with a contract, a form carrying every verb, a modal hook with its Host in the test, a routed link, a vanilla-DOM list, a clock stamp, a noisy panel, a responsive note, a control that refuses input, a panel that cancels a reply unread and a pair of links whose names overlap. It is not under `fixtures/`: ground is what a spec stands on from a distance, and here the spec stands next to it. The exception is HELD by rules, not granted by omission: I2 requires every one of those `.test.tsx` files to have the `.tsx` (or the `.ts` of a hook) of the same basename beside it, and C1's row says a `.test.tsx` is out of its reach because a rendered unit never lives in a facet/domain tree.

## The layered reading

The package proves itself in five layers, and they are meant to be read from the inside out: a module against its own exports, a rule against its own fixtures, a facet against its own tree, the built binary against a fixture project, and the CORPUS against what a meta-test says it must keep true. Each layer judges something the one below it cannot — and the meta-tests are counted apart rather than folded into the module tests, because what they judge is the one thing a test beside a module cannot see.

<!-- GENERATED:layers — do not edit by hand; run `npm run docs`. Source: lint/matrix.ts -->

| Layer                   | Where                                               | What it judges                                                           | Files |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ | ----- |
| Module tests            | `src/**/*.test.ts` beside the module                | one module, through its own exports, with nothing started                | 80    |
| Rule tests              | `lint/rules/<facet>/<rule>.test.ts` beside the rule | one rule: what it flags, what it leaves alone, and the message it prints | 63    |
| The package’s own specs | `specs/<facet>/`                                    | the framework's own facets, each met through its constructor             | 143   |
| The lint suite          | `specs/lint/**`                                     | the built binary end to end, over fixture projects                       | 171   |
| Meta-tests              | `lint/*.test.ts`                                    | the corpus itself: the catalogue, the matrix, the skill, the floor       | 43    |

<!-- /GENERATED:layers -->

The counts are generated: a layer that stops growing while the surface does is visible here before it is visible in a bug.

## The lint suite is end-to-end

`specs/lint/**` runs the REAL oxlint binary and the real checker over fixture projects and goldens their output. Because it loads `dist/oxlint.js` and `dist/checker.js`, `npm run build` must precede it — the same ordering `npm run lint` depends on.

A rule is specified in one of two forms, and the first is the one a new rule takes:

- **Documents.** `specs/lint/<rule-id>/<case>.spec.yaml`, the trees it lints in a local `fixtures/`: a tree in, the command, the report out. The runner is `specs/lint/report.specification.ts` — one wrapper for both channels (`command: .` lints with oxlint, `command: checker .` runs the checker), bound with the published `lintReport` as its `transform`: every diagnostic of either channel reads `file:line:column  plugin(rule)`, so the golden proves where the rule fired and which rule it was, and every other line — a tally, a summary — is dropped, so a clean run is an empty stream. The `unit` project collects these documents through `literate()`. Every rule of the oxlint plugin takes this form — all fifty-six, each with at least one document whose golden names the line and column it fires on, which a meta-test holds — and so do eleven checker passes, C27's moves and C28's inlining and moves among them, and C13's 16 → 17 mover; a second meta-test holds every checker pass to a spec of either form.
- **A test file per checker pass**, `specs/lint/checker/<pass>.test.ts` (and the reach meta-test under `specs/lint/meta/`), over a violation/compliant twin in `specs/lint/checker/fixtures/lint-violations/` — the pool entry moved beside the one leaf that reads it (C28). The checker's goldens there are full snapshots: `specs/lint/checker/expected/*.txt` holds the exact report lines the checker prints. A message that changes its wording moves its golden with it, in the same commit — the reason the documents golden the normalised report instead.

## Coverage is a ratchet, not a threshold

`npx vitest --run --coverage` turns on v8 — the runtime's own counter, so there
is no instrumentation pass and the numbers do not move when the bundler does —
and writes three reports where the preset sends them ([02 — Developing §
Artefacts live under `.artifacts/`](02-developing.md#artefacts-live-under-artifacts)):
`text` for the person who ran it, `html` for the one chasing a line, and
`json-summary`, which is the one a machine reads.

The count includes the child processes the suite spawns: a document that runs
`checker .` runs `dist/checker.js` in a child, and this repository's
`vitest.config.ts` turns on `autoAttachSubprocess`, so v8 merges what every
child executed. The build writes source maps, which take each bundle back to
the `lint/` and `src/` modules it was built from; `dist/` itself is judged
only after that remap, so no bundle is ever counted as a file of its own.

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
react-dom alone is 19 000 statements), `specs/` and `fixtures/` (a spec is a
test and the app it drives is ground), the type-only and config files.

## Modules with no sibling test

I2 says a module test lives beside its module. It never said every module has
one, and it cannot: a barrel executes nothing, a `*.port.ts` declares a shape,
and a facet's constructor is proven by the tree that constructs it. What was
missing is the LIST of the ones that do not, and why — a module with real
behaviour, no sibling test and nobody able to say what covers it is the silence
this section closes.

`lint/siblings.ts` declares the kinds, each naming the PATHS it claims —
never a prefix, because a kind claiming `src/seams/` would claim every module
written there next year and K7 would be a poster. **K7** fails on a module that
matches none of them, which is what makes a new, unclaimed module fail the
suite on the day it lands.

<!-- GENERATED:siblings — do not edit by hand; run `npm run docs`. Source: lint/siblings.ts -->

Today **80 modules** have no sibling test, and every one of them is claimed:

| Kind                                    | Proven instead by                                                                                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| composition root or barrel (4)          | it wires and re-exports; what it publishes is held by `package-exports.test.ts` and by every spec that imports the entry                                                                                                                       |
| type-only declaration (11)              | it declares a shape and executes nothing; the compiler is its test, and `type-channel.test-d.ts` holds what the compiler must refuse                                                                                                           |
| constant data (4)                       | it is a table, not a behaviour; every reader of it asserts on it (`preset.test.ts` for the artefact paths, `plugin.test.ts` for the manifest)                                                                                                  |
| the facet file set, as a re-export (12) | the six node facets share one builder, so these name it rather than implement it — `builder.test.ts` and `facet-matrix.test.ts` hold the thing they name                                                                                       |
| a facet's vitest project (6)            | `projects.test.ts` builds every one of them and asserts the project it produces                                                                                                                                                                |
| a mobile module that needs a device (1) | the mobile facet has no tree under `specs/` and cannot have one here (M1); what a device is NOT needed for — resolving the simulator, projecting the page source, wording the ambiguity — has its own sibling test, and these two are the rest |
| a facet module (8)                      | the facet is proven end to end by its own tree under `specs/<facet>/`, which is what the constructor exists to make possible                                                                                                                   |
| a result accessor (7)                   | an accessor is what a terminal action hands back: it is exercised by every spec that asserts on a result, and `result.test.ts` holds the base                                                                                                  |
| a seam adapter (11)                     | a seam is proven through the facet that drives it — a probe that could only reach it directly is an integration spec under `specs/integration/<seam>/` (chapter 03)                                                                            |
| a bundled CLI entry (3)                 | it is argument parsing over a module that has its own tests, and `specs/lint/` runs the built binary end to end                                                                                                                                |
| a lint-layer module (6)                 | the lint layer is proven by the rule tests beside each rule and by `specs/lint/`, which runs the real oxlint binary and the real checker over fixture projects                                                                                 |
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
(`lint/facet-matrix.ts`), the `{{token}}` list the runner and the checker
already share, and a scan of the trees each column owns.

A file counts in the column whose tree holds it, and only for what that column
declares: `specs/mobile/appium/session.spec.ts` drives the cli runner, so its
`.exec()`, `.fixture()` and `.env()` fall in cells the mobile column leaves
blank, and are counted in no column.

<!-- GENERATED:matrix — do not edit by hand; run `npm run docs`. Source: lint/matrix.ts -->

What the framework can do, and how many of this package’s own test FILES exercise it, per facet: a call read from each file’s syntax tree, whatever lines a formatter splits it across, and any other probe read as its literal with comments stripped — strings too for a key or an accessor — so a sentence or a string naming a capability never counts as a test of it. A blank (`—`) is a capability the facet does not declare; a `0` is a declared capability nothing here exercises, and every one of them is named under **Exemptions** with the reason it is accepted. `matrix.test.ts` fails on a `0` that is not.

### Constructor option

| Capability  | api | jobs | cli | integration | website | mobile | component | module |
| ----------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `services`  | 2   | 1    | 1   | 2           | 1       | 1      | —         | —      |
| `root`      | 2   | 1    | 1   | 2           | 1       | 1      | 1         | —      |
| `server`    | 4   | —    | —   | —           | 4       | —      | —         | —      |
| `jobs`      | —   | 2    | —   | —           | —       | —      | —         | —      |
| `url`       | —   | —    | —   | —           | 2       | —      | —         | —      |
| `backend`   | —   | —    | —   | —           | 1       | 1      | —         | —      |
| `external`  | —   | —    | —   | —           | 1       | —      | —         | —      |
| `device`    | —   | —    | —   | —           | —       | 1      | —         | —      |
| `app`       | —   | —    | —   | —           | —       | 1      | —         | —      |
| `appium`    | —   | —    | —   | —           | —       | 1      | —         | —      |
| `timeouts`  | —   | —    | —   | —           | —       | 1      | —         | —      |
| `commands`  | —   | —    | 1   | —           | —       | —      | —         | —      |
| `defaults`  | —   | —    | 1   | —           | —       | —      | —         | —      |
| `env`       | —   | —    | 4   | —           | —       | —      | —         | —      |
| `docker`    | —   | —    | 1   | —           | —       | —      | —         | —      |
| `serve`     | —   | —    | 3   | —           | —       | —      | —         | —      |
| `transform` | —   | —    | 2   | —           | 1       | —      | —         | —      |
| `wrap`      | —   | —    | —   | —           | —       | —      | 1         | —      |
| `vite`      | —   | —    | —   | —           | —       | —      | 1         | —      |
| `clock`     | —   | —    | —   | —           | —       | —      | 1         | —      |
| `locale`    | —   | —    | —   | —           | —       | —      | 1         | —      |
| `timezone`  | —   | —    | —   | —           | —       | —      | 1         | —      |
| `viewport`  | —   | —    | —   | —           | —       | —      | 1         | —      |

### Setup

| Capability     | api | jobs | cli | integration | website | mobile | component | module |
| -------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.clock()`     | 1   | 1    | —   | 1           | 1       | —      | 1         | —      |
| `.intercept()` | 10  | 1    | —   | 2           | 1       | 1      | 5         | —      |
| `.seed()`      | 9   | 1    | 1   | 3           | —       | —      | —         | —      |
| `.headers()`   | 3   | —    | —   | —           | 1       | —      | —         | —      |
| `.with()`      | 3   | 1    | 1   | 1           | 1       | —      | —         | —      |
| `.fixture()`   | —   | —    | 27  | —           | —       | —      | —         | —      |
| `.env()`       | —   | —    | 3   | —           | —       | —      | —         | —      |
| `.wrap()`      | —   | —    | —   | —           | —       | —      | 2         | —      |
| `.viewport()`  | —   | —    | —   | —           | —       | —      | 1         | —      |

### Terminal action

| Capability   | api | jobs | cli | integration | website | mobile | component | module |
| ------------ | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.get()`     | 20  | —    | —   | —           | —       | —      | —         | —      |
| `.post()`    | 5   | —    | —   | —           | —       | —      | —         | —      |
| `.put()`     | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.delete()`  | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.request()` | 2   | —    | —   | —           | —       | —      | —         | —      |
| `.trigger()` | —   | 6    | —   | —           | —       | —      | —         | —      |
| `.call()`    | —   | —    | —   | 8           | —       | —      | —         | —      |
| `.exec()`    | —   | —    | 33  | —           | —       | —      | —         | —      |
| `.run()`     | —   | —    | 4   | —           | —       | —      | —         | —      |
| `.visit()`   | —   | —    | —   | —           | 20      | —      | —         | —      |
| `.fetch()`   | —   | —    | —   | —           | 3       | —      | —         | —      |
| `.open()`    | —   | —    | —   | —           | —       | 7      | —         | —      |
| `.render()`  | —   | —    | —   | —           | —       | —      | 21        | —      |

### Route option

| Capability   | api | jobs | cli | integration | website | mobile | component | module |
| ------------ | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `{ params }` | 1   | —    | —   | —           | —       | —      | —         | —      |

### Verb

| Capability | api | jobs | cli | integration | website | mobile | component | module |
| ---------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `see`      | —   | —    | —   | —           | 11      | 6      | 19        | —      |
| `fill`     | —   | —    | —   | —           | 4       | 1      | 2         | —      |
| `click`    | —   | —    | —   | —           | 3       | —      | 8         | —      |
| `gone`     | —   | —    | —   | —           | 3       | —      | 6         | —      |
| `press`    | —   | —    | —   | —           | 1       | —      | 2         | —      |
| `hover`    | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `check`    | —   | —    | —   | —           | 1       | —      | 2         | —      |
| `select`   | —   | —    | —   | —           | 1       | —      | 2         | —      |
| `goto`     | —   | —    | —   | —           | 1       | —      | —         | —      |
| `tap`      | —   | —    | —   | —           | —       | 3      | —         | —      |
| `rerender` | —   | —    | —   | —           | —       | —      | 1         | —      |
| `unmount`  | —   | —    | —   | —           | —       | —      | 1         | —      |

### Descriptor

| Capability      | api | jobs | cli | integration | website | mobile | component | module |
| --------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `button`        | —   | —    | —   | —           | 4       | 3      | 8         | —      |
| `field`         | —   | —    | —   | —           | 6       | 1      | 5         | —      |
| `content`       | —   | —    | —   | —           | 7       | 6      | 13        | —      |
| `testId`        | —   | —    | —   | —           | 1       | 1      | 1         | —      |
| `heading`       | —   | —    | —   | —           | 3       | —      | 2         | —      |
| `link`          | —   | —    | —   | —           | 3       | —      | 3         | —      |
| `dialog`        | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `status`        | —   | —    | —   | —           | 1       | —      | 3         | —      |
| `table`         | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `row`           | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `listitem`      | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `option`        | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `banner`        | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `complementary` | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `contentinfo`   | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `form`          | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `main`          | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `navigation`    | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `region`        | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `search`        | —   | —    | —   | —           | 2       | —      | 2         | —      |
| `within`        | —   | —    | —   | —           | 4       | 1      | 6         | —      |
| `focused`       | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `selected`      | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `valued`        | —   | —    | —   | —           | 1       | —      | 2         | —      |
| `disabled`      | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `enabled`       | —   | —    | —   | —           | 1       | —      | 1         | —      |

### Result accessor

| Capability      | api | jobs | cli | integration | website | mobile | component | module |
| --------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.response`     | 21  | —    | —   | —           | —       | —      | —         | —      |
| `.status`       | 1   | —    | —   | —           | 3       | —      | —         | —      |
| `.table()`      | 7   | 3    | 1   | 1           | —       | —      | —         | —      |
| `.file()`       | 1   | —    | 9   | 1           | —       | —      | —         | —      |
| `.directory()`  | 1   | —    | 4   | 1           | —       | —      | —         | —      |
| `.stdout`       | —   | —    | 16  | —           | —       | —      | —         | —      |
| `.stderr`       | —   | —    | 7   | —           | —       | —      | —         | —      |
| `.exitCode`     | —   | —    | 24  | —           | —       | —      | —         | —      |
| `.filesystem`   | —   | —    | 1   | —           | —       | —      | —         | —      |
| `.container()`  | —   | —    | 2   | —           | —       | —      | —         | —      |
| `.containerIds` | —   | —    | 1   | —           | —       | —      | —         | —      |
| `.value`        | —   | —    | —   | 7           | —       | —      | —         | —      |
| `.error`        | —   | —    | —   | 5           | —       | —      | —         | —      |
| `.tree`         | —   | —    | —   | —           | 5       | —      | 4         | —      |
| `.content`      | —   | —    | —   | —           | 9       | 5      | 14        | —      |
| `.console`      | —   | —    | —   | —           | 4       | —      | 4         | —      |
| `.errors`       | —   | —    | —   | —           | 8       | —      | 8         | —      |
| `.html`         | —   | —    | —   | —           | 2       | —      | 5         | —      |
| `.title`        | —   | —    | —   | —           | 3       | —      | —         | —      |
| `.url`          | —   | —    | —   | —           | 3       | —      | —         | —      |
| `.head`         | —   | —    | —   | —           | 3       | —      | —         | —      |
| `.jsonLd`       | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.canonical`    | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.alternates`   | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.links`        | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.meta()`       | —   | —    | —   | —           | 2       | —      | —         | —      |
| `.body`         | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.json`         | —   | —    | 5   | —           | 1       | —      | —         | —      |
| `.headers`      | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.location`     | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.screen`       | —   | —    | —   | —           | —       | 3      | —         | —      |

### Golden

| Capability             | api | jobs | cli | integration | website | mobile | component | module |
| ---------------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `toMatch(file())`      | 1   | —    | 6   | 3           | 0       | —      | 0         | 3      |
| `toMatch(directory())` | 1   | —    | 5   | 1           | —       | —      | —         | 1      |
| `toMatch(<rows>)`      | 7   | 3    | 1   | 1           | —       | —      | —         | —      |
| `.http exchange`       | 3   | —    | —   | —           | —       | —      | —         | 4      |
| `.aria.yaml tree`      | —   | —    | —   | —           | 0       | —      | 0         | —      |
| `.json body`           | 2   | —    | 2   | 2           | 0       | —      | —         | 9      |
| `.txt stream`          | 1   | —    | 7   | 1           | 1       | —      | —         | 10     |
| `{ frozen }`           | 2   | —    | 11  | —           | —       | —      | 1         | 3      |

### Time & doubles

| Capability    | api | jobs | cli | integration | website | mobile | component | module |
| ------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `clock()`     | —   | —    | —   | —           | —       | —      | —         | 3      |
| `intercept()` | —   | —    | —   | —           | —       | —      | —         | 1      |
| `mockOf()`    | —   | —    | —   | —           | —       | —      | —         | 1      |
| `match.*`     | —   | —    | —   | —           | —       | —      | —         | 8      |

### Token

| Capability     | api | jobs | cli | integration | website | mobile | component | module |
| -------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `{{any}}`      | 0   | —    | 2   | 0           | 0       | —      | —         | 2      |
| `{{base64}}`   | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{date}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{duration}}` | 0   | —    | 1   | 0           | 0       | —      | —         | 2      |
| `{{email}}`    | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{float}}`    | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{hex}}`      | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{int}}`      | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{ip}}`       | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{iso8601}}`  | 6   | —    | 0   | 1           | 0       | —      | —         | 2      |
| `{{number}}`   | 1   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{path}}`     | 1   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{port}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{semver}}`   | 0   | —    | 2   | 0           | 0       | —      | —         | 1      |
| `{{sha}}`      | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{string}}`   | 2   | —    | 1   | 0           | 0       | —      | —         | 1      |
| `{{time}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{ulid}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{url}}`      | 0   | —    | 4   | 0           | 0       | —      | —         | 1      |
| `{{uuid}}`     | 2   | —    | 0   | 0           | 0       | —      | —         | 3      |
| `{{workdir}}`  | 0   | —    | 6   | 0           | 0       | —      | —         | 1      |

### Exemptions

- every golden of this facet's tree is read by one test, so it is written in place (C28); the file form is proven where goldens are shared — `toMatch(file())`·website, `toMatch(file())`·component, `.aria.yaml tree`·website, `.aria.yaml tree`·component, `.json body`·website
- the engine owns the family (proven in the module column); a facet uses the ones its goldens need — `{{any}}`·api, `{{any}}`·integration, `{{any}}`·website, `{{base64}}`·api, `{{base64}}`·cli, `{{base64}}`·integration, `{{base64}}`·website, `{{date}}`·api, `{{date}}`·cli, `{{date}}`·integration, `{{date}}`·website, `{{duration}}`·api, `{{duration}}`·integration, `{{duration}}`·website, `{{email}}`·api, `{{email}}`·cli, `{{email}}`·integration, `{{email}}`·website, `{{float}}`·api, `{{float}}`·cli, `{{float}}`·integration, `{{float}}`·website, `{{hex}}`·api, `{{hex}}`·cli, `{{hex}}`·integration, `{{hex}}`·website, `{{int}}`·api, `{{int}}`·cli, `{{int}}`·integration, `{{int}}`·website, `{{ip}}`·api, `{{ip}}`·cli, `{{ip}}`·integration, `{{ip}}`·website, `{{iso8601}}`·cli, `{{iso8601}}`·website, `{{number}}`·cli, `{{number}}`·integration, `{{number}}`·website, `{{path}}`·cli, `{{path}}`·integration, `{{path}}`·website, `{{port}}`·api, `{{port}}`·cli, `{{port}}`·integration, `{{port}}`·website, `{{semver}}`·api, `{{semver}}`·integration, `{{semver}}`·website, `{{sha}}`·api, `{{sha}}`·cli, `{{sha}}`·integration, `{{sha}}`·website, `{{string}}`·integration, `{{string}}`·website, `{{time}}`·api, `{{time}}`·cli, `{{time}}`·integration, `{{time}}`·website, `{{ulid}}`·api, `{{ulid}}`·cli, `{{ulid}}`·integration, `{{ulid}}`·website, `{{url}}`·api, `{{url}}`·integration, `{{url}}`·website, `{{uuid}}`·cli, `{{uuid}}`·integration, `{{uuid}}`·website, `{{workdir}}`·api, `{{workdir}}`·integration, `{{workdir}}`·website

<!-- /GENERATED:matrix -->

## The meta-test channel

Several truths about this package cannot be asserted from outside it, so they are asserted by running it on itself. Each of these exists because a defect class was found once and made unrepeatable (rule K1).

The table is GENERATED from the files, because the channel grows faster than a hand-kept list: what a row holds is the file's own `describe` titles, so a meta-test that lands is a row the next `npm run docs` writes.

<!-- GENERATED:meta-tests — do not edit by hand; run `npm run docs`. Source: lint/meta-tests.ts -->

**44 files** are the channel — every `*.test.ts` directly under `lint/`, plus the suite that needs the real binary. What each one holds is its own `describe` titles, read from the file:

| Meta-test                                   | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Tests |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `lint/ast.test.ts`                          | specsAnchor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 7     |
| `lint/checker-capability.test.ts`           | c35 — a spec of a specimen is filed by its capability                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 6     |
| `lint/checker-crossfile.test.ts`            | checker suppression — suppressedLines (checker-disable comments)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 10    |
| `lint/checker-member.test.ts`               | the member pass — what a workspace member owes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 19    |
| `lint/checker-migration.test.ts`            | the 16 → 17 mover (C13 --fix) · the 16 → 17 mover — the oxlint config                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 22    |
| `lint/checker-spec.test.ts`                 | fixSpecDocument — key order and block scalars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 5     |
| `lint/checker-sql-seeds.test.ts`            | the seed branch of C28 — a seed file is named by its first comment · the seed branch of C28 — a seed with no comment is named by its test                                                                                                                                                                                                                                                                                                                                                                                                                 | 3     |
| `lint/checker-subject.test.ts`              | c29 and c30 — one subject per file, filed under its standard name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 22    |
| `lint/checker.test.ts`                      | conventions checker — findUnknownTokens (D4) · conventions checker — findKnownTokens (D10) · conventions checker — checkConventionFiles (D4) · the tree the checker judges — what git does not ignore · the moves the fixers make · the single paths the checker probes — through the same tree                                                                                                                                                                                                                                                           | 17    |
| `lint/coverage.test.ts`                     | the coverage ratchet · what the count reaches — the child processes the suite spawns (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 10    |
| `lint/docs-typecheck.test.ts`               | docs-typecheck — block selection · docs-typecheck — the published samples typecheck · docs-typecheck — the corpus does not await a sync matcher · docs-typecheck — harness                                                                                                                                                                                                                                                                                                                                                                                | 6     |
| `lint/document-report.test.ts`              | k10 — a lint-rule document goldens its report (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2     |
| `lint/env-allowlist.test.ts`                | framework env reads — e1-env-allowlist (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 4     |
| `lint/facet-matrix.test.ts`                 | facet capability declaration (K1 guard)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 7     |
| `lint/first-level.test.ts`                  | first-level                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 3     |
| `lint/fork.test.ts`                         | the fork — generation freshness (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2     |
| `lint/lesson.test.ts`                       | whyOf — the convention in one sentence · k11 — every message teaches: found, why, fix, read (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 6     |
| `lint/linted-file.test.ts`                  | linted-file — what every rule asks, answered once per file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 3     |
| `lint/makefile.test.ts`                     | the Makefile — the six targets a repository answers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 5     |
| `lint/matrix-calls.test.ts`                 | the matrix reads a call probe as a shape of the syntax tree                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 5     |
| `lint/matrix.test.ts`                       | capability matrix (meta-test K6) · the capability folders — the vocabulary a spec of a specimen is filed by                                                                                                                                                                                                                                                                                                                                                                                                                                               | 11    |
| `lint/meta-tests.test.ts`                   | the meta-test channel, read off its own files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 3     |
| `lint/module-tests.test.ts`                 | the module tests of a member — what C8 and the ground fixers read beside specs/                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 1     |
| `lint/oxlint-pin.test.ts`                   | the oxlint pin — the toolchain owns it and this manifest mirrors it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2     |
| `lint/package-exports.test.ts`              | package-exports — F1 reads the published contract · package-exports — the root has two runtimes and one type surface · package-exports — the published types name what a consumer has · package-exports — the tarball carries what a message points at · package-exports — the build is compiled from production alone                                                                                                                                                                                                                                    | 11    |
| `lint/path-references.test.ts`              | pathReferenceVisitor · literalPathVisitor · mergeVisitors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 5     |
| `lint/plugin.test.ts`                       | the composable fragment — what a consumer wires · the upstream options this vocabulary owns (ADR-005) · conventions catalogue — generation freshness (meta-test) · conventions catalogue — completeness (meta-test) · testing fragment — standalone oxlint config · conventions catalogue — the channels answer for themselves (meta-test) · conventions catalogue — E2E inventory (meta-test) · the corpus’ own coordinates (meta-test K8) · the corpus never offers an option the rulebook refuses · the ./oxlint entry publishes what test material is | 38    |
| `lint/port-readers.test.ts`                 | k9 — a spec server binds port 0 (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2     |
| `lint/production.test.ts`                   | isProductionModule · materialAt · testPackageOf · resolveSpecifier · reachOf · reachOf across a run                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 15    |
| `lint/ratchet-fix.test.ts`                  | the test ratchet under --fix — what fell is recorded, what rose is not                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 2     |
| `lint/ratchet-own-fixes.test.ts`            | the checker’s own fix pass — the plugin’s fixers, and no one else’s                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 10    |
| `lint/ratchet.test.ts`                      | the test ratchet — exact counts that a fix may lower and never raise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 16    |
| `lint/role.test.ts`                         | roleOf — the kind a path states · roleOf — read below the project root · projectRootOf — remembered per folder · isTestRole — the three kinds that DECLARE tests · isTestFile — what the test conventions reach                                                                                                                                                                                                                                                                                                                                           | 19    |
| `lint/rule-shape.test.ts`                   | rule-shape — a rule built once judges each file as if it were the only one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 2     |
| `lint/schema-documents.test.ts`             | the published schema validates every document of the tree (meta-test) · what no keyword states, the parser alone refuses · the published schema refuses a wrong document · the schema holds every presence law the parser holds (meta-test)                                                                                                                                                                                                                                                                                                               | 9     |
| `lint/siblings.test.ts`                     | modules with no sibling test (meta-test K7)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 5     |
| `lint/skill.test.ts`                        | the skill names only what exists (meta-test) · knowledge has one owner each — the skill is one page, the API is the types (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                     | 5     |
| `lint/spec-values.test.ts`                  | spec values — what a fix names a value written in a test by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 3     |
| `lint/specimen.test.ts`                     | specimen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 7     |
| `lint/subject.test.ts`                      | subjectFolder — the standard name, derived from the subject · the subject a spec reaches, read statically · what a repository declares — its runner commands, its irregular collections                                                                                                                                                                                                                                                                                                                                                                   | 14    |
| `lint/test-settings.test.ts`                | the test section of jterrazz.config.ts, as the checker reads it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 5     |
| `lint/type-aware.test.ts`                   | the type-aware rules D2 hands its promise matchers to (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 2     |
| `lint/type-channel.test.ts`                 | the type channel — each row refused for the reason it states (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 3     |
| `specs/lint/meta/k4-reach-per-path.test.ts` | lint — k4-reach-per-path (meta-test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 6     |

<!-- /GENERATED:meta-tests -->

One proof of the channel declares no test: `src/type-channel.test-d.ts` states what the COMPILER refuses — A8, A11, B1, B2, B3, D1, D14, M2, W6 — as an `@ts-expect-error` per row, and `typescript check` fails the day the line it marks starts compiling. An `@ts-expect-error` is satisfied by ANY error, so each marker ends on the words of the one it is written for, in brackets, and `lint/type-channel.test.ts` compiles the file with the markers taken out and fails a row the compiler refuses for another reason. It runs under the typechecker the whole repository already runs, never under a vitest project.

`lint/plugin.test.ts` also holds the seven-channel contract: every row of
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

## Hunting a flake

A test that fails once and passes on the rerun is chased, never retried: the preset sets `retry: 0`. The gesture is Vitest's `--repeats`, which runs every test of the files it is handed ten times in one process:

```bash
npm run test:repeat -- --project unit lint/type-channel.test.ts
```

It is aimed at named files, not at a whole project. A rule test declares its cases through oxlint's `RuleTester`, which refuses a case it has already seen, so a repeated rule test fails on its second pass whatever the rule does. A test that fails on its own second pass is a defect all the same: it cannot run twice in one process.

## What CI runs

The workflow is `.github/workflows/validate.yaml`, on every push to `main` and every pull request, delegating to the estate's shared `validate.yaml`. It restores `.artifacts/`, then runs `make build`, `make lint` and `make test` in that order, with chromium provisioned because the website specs drive a real browser. The same three targets are what a local run owes before a push; the ordering is not decorative, since lint loads what build produced.

**`make test` carries the floor.** It runs the suite WITH coverage and then `npm run coverage:check`, so the ratchet is judged on every push rather than trusted to whoever remembered to type `make check` — a gate CI never runs is a courtesy, not a gate. `make check` is still the whole verdict locally: build, lint, then that same target.

**A run can be split.** `make test SHARD=<index>/<count>` runs one shard of the suite with coverage, and writes its blob report to `.artifacts/vitest/blob/blob-<index>-<count>.json` — the preset names the blob for its shard, so the shards of one run land side by side. A shard judges no floor, since its coverage is a part of the tree. `make test-merge`, run once every shard's blob is in that folder, reads them back as one run with coverage and judges the floor on it. The shared workflow does not split the run yet: it has no shard input.

## Pitfalls

- **Running the lint specs on a stale `dist/`.** `specs/lint/**` and `oxlint.config.ts` both load `dist/oxlint.js`. Without `npm run build`, the suite judges the previous build's rules and reports a green that means nothing.
- **Hand-editing a golden under `specs/lint/checker/expected/`.** Those are full-output snapshots of a real binary. Change the message in the code and regenerate with `TEST_UPDATE=1`; a hand-tuned golden asserts your typing, not the checker's output.
- **Expecting `npm test` to pass with Docker stopped.** Only `unit` and `cli` are infrastructure-free. The Docker-backed tests self-skip inside them, but `api`, `jobs` and `integration` fail honestly.
- **Adding a test at a facet root.** `specs/<facet>/<aspect>.spec.ts` is refused by `c1-domain-structure` in this repository's default depth — the runner lives at the root, the tests live one level down.
- **Writing a facet spec with the unit’s suffix.** `c12-spec-file-name` refuses it and `jterrazz-test-check specs --fix` renames it with `git mv` — and names every `include`/`exclude` entry of the member the rename broke — the globs whose prefix covers a file it moved and the literals naming one — since an entry the rename leaves behind collects nothing and the run stays green with fewer files. The reverse — a `.spec.ts` with no `specs/` ancestor — is the member pass's finding.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [14 — Assertions](14-assertions.md) · [18 — Conventions](18-conventions.md) · [19 — Linting](19-linting.md)
