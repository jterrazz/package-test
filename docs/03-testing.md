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

## Coverage is a ratchet, not a threshold

`npx vitest --run --coverage` turns on v8 — the runtime's own counter, so there
is no instrumentation pass and the numbers do not move when the bundler does —
and writes three reports under `.artifacts/vitest/coverage/`: `text` for the
person who ran it, `html` for the one chasing a line, and `json-summary`, which
is the one a machine reads.

`npm run coverage` records where the suite stands in `coverage.baseline.json`;
`npm run coverage:check` (and `make check`, which chains build, lint, test and
this) refuses a run that fell below it. The floor only ever rises: lowering it
is an edit to a committed file, with a commit body saying why.

A fixed threshold would be a number somebody picked. Set it where the project
stands and it forbids nothing; set it where the project should be and every run
is red until it gets there, which is how a gate becomes something people pass
with `--no-verify`. A ratchet asks the only question a gate can answer
honestly: is this change worse than the last one?

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

`src/lint/siblings.ts` declares the kinds, and **K7** fails on a module that
matches none of them. Today 83 modules have no sibling test, all claimed:

| Kind                           | Proven instead by                                                       |
| ------------------------------ | ----------------------------------------------------------------------- |
| composition root or barrel (4) | `package-exports.test.ts`, and every spec that imports the entry        |
| type-only declaration (11)     | the compiler, plus `type-channel.test-d.ts` for what it must refuse     |
| constant data (3)              | the readers that assert on it — `preset.test.ts`, `plugin.test.ts`      |
| the facet file set (13)        | the ONE builder they name (`builder.test.ts`, `facet-matrix.test.ts`)   |
| a facet's vitest project (7)   | `projects.test.ts`, which builds every one of them                      |
| a facet module (10)            | the facet's own tree under `specs/<facet>/`                             |
| a result accessor (7)          | every spec that asserts on a result, over `result.test.ts` for the base |
| a seam adapter (13)            | the facet that drives it, or `specs/integration/<seam>/`                |
| a bundled CLI entry (3)        | `specs/lint/`, which runs the built binary end to end                   |
| a lint-layer module (5)        | the rule tests beside each rule, and `specs/lint/`                      |
| a chain or runner internal (7) | the facet specs that drive the chain                                    |

A new module that matches no kind fails the meta-test, which is the moment to
write the test — not six months later, when a coverage number moved.

## The capability matrix

The catalogue in [19 — Linting](13-linting.md) answers "which conventions are
mechanized". This answers the other half: for each thing the framework can DO,
which facets declare it, and how many of the package's own test files exercise
it there.

It is generated by `npm run docs` from the facet declaration
(`src/lint/facet-matrix.ts`), the `{{token}}` list the runner and the checker
already share, and a scan of the trees each column owns. The same table is the
skill's `references/matrix.md`.

<!-- GENERATED:matrix — do not edit by hand; run `npm run docs`. Source: src/lint/matrix.ts -->

What the framework can do, and how many of this package’s own test files exercise it, per facet. A blank (`—`) is a capability the facet does not declare; a `0` is a declared capability nothing here exercises, and every one of them is named under **Exemptions** with the reason it is accepted. `matrix.test.ts` fails on a `0` that is not.

### Constructor option

| Capability | api | jobs | cli | integration | website | mobile | component | module |
| ---------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `services` | 2   | 1    | 1   | 2           | 1       | —      | —         | —      |
| `server`   | 4   | —    | —   | —           | 2       | —      | —         | —      |
| `jobs`     | —   | 2    | —   | —           | —       | —      | —         | —      |
| `url`      | —   | —    | —   | —           | 0       | —      | —         | —      |
| `device`   | —   | —    | —   | —           | —       | 0      | —         | —      |
| `app`      | —   | —    | —   | —           | —       | 0      | —         | —      |
| `defaults` | —   | —    | 1   | —           | —       | —      | —         | —      |
| `wrap`     | —   | —    | —   | —           | —       | —      | 5         | —      |

### Setup

| Capability     | api | jobs | cli | integration | website | mobile | component | module |
| -------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.clock()`     | 1   | 0    | —   | 1           | —       | —      | 1         | —      |
| `.intercept()` | 3   | 2    | —   | 1           | 0       | —      | 4         | —      |
| `.seed()`      | 4   | 1    | 2   | 2           | —       | —      | —         | —      |
| `.headers()`   | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.fixture()`   | —   | —    | 7   | —           | —       | —      | —         | —      |
| `.env()`       | —   | —    | 2   | —           | —       | —      | —         | —      |
| `.wrap()`      | —   | —    | —   | —           | —       | —      | 2         | —      |
| `.viewport()`  | —   | —    | —   | —           | —       | —      | 1         | —      |

### Terminal action

| Capability   | api | jobs | cli | integration | website | mobile | component | module |
| ------------ | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.get()`     | 10  | —    | —   | —           | —       | —      | —         | —      |
| `.post()`    | 2   | —    | —   | —           | —       | —      | —         | —      |
| `.put()`     | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.delete()`  | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.request()` | 1   | —    | —   | —           | —       | —      | —         | —      |
| `.trigger()` | —   | 1    | —   | —           | —       | —      | —         | —      |
| `.call()`    | —   | —    | —   | 6           | —       | —      | —         | —      |
| `.exec()`    | —   | —    | 7   | —           | —       | —      | —         | —      |
| `.run()`     | —   | —    | 3   | —           | —       | —      | —         | —      |
| `.visit()`   | —   | —    | —   | —           | 9       | —      | —         | —      |
| `.fetch()`   | —   | —    | —   | —           | 2       | —      | —         | —      |
| `.open()`    | —   | —    | —   | —           | —       | 0      | —         | —      |
| `.render()`  | —   | —    | —   | —           | —       | —      | 14        | —      |

### Verb

| Capability | api | jobs | cli | integration | website | mobile | component | module |
| ---------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `see`      | —   | —    | —   | —           | 5       | 0      | 14        | —      |
| `click`    | —   | —    | —   | —           | 3       | 0      | 4         | —      |
| `fill`     | —   | —    | —   | —           | 3       | 0      | 2         | —      |
| `press`    | —   | —    | —   | —           | 0       | 0      | 2         | —      |
| `gone`     | —   | —    | —   | —           | 2       | 0      | 4         | —      |
| `rerender` | —   | —    | —   | —           | —       | —      | 1         | —      |
| `unmount`  | —   | —    | —   | —           | —       | —      | 1         | —      |
| `button`   | —   | —    | —   | —           | 3       | 0      | 4         | —      |
| `field`    | —   | —    | —   | —           | 3       | 0      | 3         | —      |
| `heading`  | —   | —    | —   | —           | 0       | 0      | 1         | —      |
| `link`     | —   | —    | —   | —           | 2       | 0      | 2         | —      |
| `content`  | —   | —    | —   | —           | 3       | 0      | 10        | —      |
| `testId`   | —   | —    | —   | —           | 0       | 0      | 1         | —      |
| `within`   | —   | —    | —   | —           | 2       | —      | 5         | —      |
| `focused`  | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `selected` | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `valued`   | —   | —    | —   | —           | 1       | —      | 2         | —      |

### Result accessor

| Capability     | api | jobs | cli | integration | website | mobile | component | module |
| -------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `.response`    | 7   | —    | —   | —           | —       | —      | —         | —      |
| `.json`        | 4   | —    | 4   | —           | —       | —      | —         | —      |
| `.text`        | —   | —    | —   | —           | —       | —      | 2         | —      |
| `.table()`     | 4   | 1    | 1   | 1           | —       | —      | —         | —      |
| `.file()`      | —   | —    | 5   | —           | —       | —      | —         | —      |
| `.directory()` | —   | —    | 2   | —           | —       | —      | —         | —      |
| `.value`       | —   | —    | —   | 6           | —       | —      | —         | —      |
| `.error`       | 1   | —    | —   | 5           | —       | —      | —         | —      |
| `.tree`        | —   | —    | —   | —           | 2       | 0      | 3         | —      |
| `.html`        | —   | —    | —   | —           | —       | —      | 5         | —      |
| `.console`     | —   | —    | —   | —           | 1       | —      | —         | —      |
| `.content`     | —   | —    | —   | —           | 4       | —      | —         | —      |
| `.stdout`      | —   | —    | 6   | —           | —       | —      | —         | —      |
| `.stderr`      | —   | —    | 2   | —           | —       | —      | —         | —      |
| `.exitCode`    | —   | —    | 8   | —           | —       | —      | —         | —      |
| `.status`      | 4   | —    | —   | —           | 2       | —      | —         | —      |

### Golden

| Capability          | api | jobs | cli | integration | website | mobile | component | module |
| ------------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `toMatch('<name>')` | 3   | 0    | 6   | 6           | 4       | —      | 2         | 11     |
| `.http exchange`    | 3   | —    | —   | —           | —       | —      | —         | —      |
| `.aria.yaml tree`   | —   | —    | —   | —           | 1       | —      | 1         | —      |
| `directory golden`  | —   | —    | 2   | —           | —       | —      | —         | —      |
| `{ frozen }`        | 2   | —    | 5   | —           | —       | —      | —         | —      |

### Time & doubles

| Capability    | api | jobs | cli | integration | website | mobile | component | module |
| ------------- | --- | ---- | --- | ----------- | ------- | ------ | --------- | ------ |
| `clock()`     | —   | —    | —   | —           | —       | —      | —         | 2      |
| `intercept()` | —   | —    | —   | —           | —       | —      | —         | 4      |
| `mockOf()`    | —   | —    | —   | —           | —       | —      | —         | 5      |
| `match.*`     | —   | —    | —   | —           | —       | —      | —         | 23     |

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
| `{{iso8601}}`  | 1   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{number}}`   | 0   | —    | 1   | 0           | 0       | —      | —         | 1      |
| `{{path}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{port}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 2      |
| `{{semver}}`   | 0   | —    | 2   | 0           | 0       | —      | —         | 1      |
| `{{sha}}`      | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{string}}`   | 1   | —    | 1   | 0           | 0       | —      | —         | 1      |
| `{{time}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{ulid}}`     | 0   | —    | 0   | 0           | 0       | —      | —         | 1      |
| `{{url}}`      | 0   | —    | 2   | 0           | 0       | —      | —         | 1      |
| `{{uuid}}`     | 1   | —    | 1   | 0           | 0       | —      | —         | 3      |
| `{{workdir}}`  | 0   | —    | 5   | 0           | 0       | —      | —         | 1      |

### Exemptions

- `url` · **website** — the package serves its own fixture site, so `server` is what it proves; `url` targets an already-running deployment, which is a consumer shape (A11 states the XOR)
- `device` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `app` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `.clock()` · **jobs** — owed: the surface ships and this package does not specify it here yet
- `.intercept()` · **website** — owed: the surface ships and this package does not specify it here yet
- `.open()` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `see` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `click` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `fill` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `press` · **website** — owed: the surface ships and this package does not specify it here yet
- `press` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `gone` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `button` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `field` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `heading` · **website** — owed: the surface ships and this package does not specify it here yet
- `heading` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `link` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `content` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `testId` · **website** — owed: the surface ships and this package does not specify it here yet
- `testId` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `.tree` · **mobile** — no mobile tree: an iOS simulator is not something CI provisions (M1)
- `toMatch('<name>')` · **jobs** — a job's oracle is the table it wrote (`toMatchRows`): its result carries no file and no directory
- `{{any}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{any}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{any}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{base64}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{base64}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{base64}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{base64}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{date}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{date}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{date}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{date}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{duration}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{duration}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{duration}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{email}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{email}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{email}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{email}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{float}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{float}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{float}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{float}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{hex}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{hex}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{hex}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{hex}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{int}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{int}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{int}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{int}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{ip}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{ip}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{ip}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{ip}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{iso8601}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{iso8601}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{iso8601}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{number}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{number}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{number}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{path}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{path}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{path}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{path}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{port}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{port}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{port}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{port}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{semver}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{semver}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{semver}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{sha}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{sha}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{sha}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{sha}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{string}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{string}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{time}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{time}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{time}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{time}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{ulid}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{ulid}}` · **cli** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{ulid}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{ulid}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{url}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{url}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{url}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{uuid}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{uuid}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{workdir}}` · **api** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{workdir}}` · **integration** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need
- `{{workdir}}` · **website** — the engine owns the family (proven in the module column); a facet uses the ones its goldens need

<!-- /GENERATED:matrix -->

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
