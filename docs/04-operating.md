# 04 — Operating

This repository ships one thing: the npm package `@jterrazz/test`. Nothing here deploys, nothing here runs as a service, and merging to `main` publishes nothing — a release is a deliberate, separate act. This chapter says what that act is, what leaves the tree when it happens, and what a consumer has to have for the published artefact to work.

## Releasing

A release is three steps, in this order.

1. **Bump and land the version.** The version in `package.json` moves, alone, in a commit whose subject is `chore: <version> — <what changed>`. The commit log is the changelog: this repository carries no `CHANGELOG.md`, by decision, and the release notes plus that subject line are the record.
2. **Create the GitHub release**, tagged at that commit. This is the trigger and the only one — `.github/workflows/release.yaml` listens on `release: types: [created]`.
3. **Watch the gate.** The workflow delegates to the estate's `jterrazz/jterrazz-actions/.github/workflows/release-npm.yaml`, which runs the FULL validate job first — the same build, lint and test the push gate runs, chromium included — and publishes only if it is green.

The publish step is `npm publish --access public --provenance`, on Node 24, with `id-token: write` granted so npm records a provenance attestation linking the tarball to the workflow run that built it. The registry is npm's, stated as `publishConfig` in the manifest.

Because validate runs inside the release workflow, a red suite stops a publication rather than a merge. That is the design: the tree on `main` is always publishable, and nothing decides for you when it is published.

## What leaves the tree

The tarball is what `files` declares and nothing else: `dist/`, minus `dist/catalog.*`, `dist/coverage.*`, `dist/self-*` and the source maps the build writes for coverage, plus `docs/` and `schema/`. The catalogue generator is a development gesture with no consumer — it writes this repository's own projections — so it is built but never shipped; so is every `dist/self-*` bundle — the self checker and the self plugin — which wires a rule only this package is held to ([03 — Testing § The package's own rules](03-testing.md#the-packages-own-rules)).

**The manual ships with the code**, because the code points at it: every relative link of the shipped `README.md` and every `(… — see docs/19-linting.md#…)` a rule message ends on is read from inside an install, and a chapter that is not there makes both a dead end. The `package-exports` meta-test holds it — a citation whose file the manifest does not publish fails the suite.

The entries that reach a consumer are the whole public contract, and they are listed once — [01 — Architecture § What the tree publishes](01-architecture.md#what-the-tree-publishes). What matters here is only that the ROOT entry resolves by CONDITION: a bundler serving a page takes `browser`, node takes `import`, and both are described by one `types` entry.

One binary ships with them: `jterrazz-test-check`, the conventions checker, pointed at `dist/checker.js`. It answers three runs — a specs tree by path, one workspace member with `--member`, and the whole project path-less (a path that is NOT a specs tree is read as a project root and takes that third run, anchored there) — and `--format json` publishes the findings under the `jterrazz-check(<id>)` codes ([19 — Linting](19-linting.md#the-member-pass-and-the-json-contract)). When `typescript check` runs it, which install it resolves it from, and what the floor version is, are the toolchain's: `@jterrazz/typescript` `docs/06-quality-checks.md` § The Test Conventions pass.

## What a consumer must bring

The package refuses to guess at its environment, so several things it uses are the consuming project's to install.

- **`vitest ^5` and `@jterrazz/typescript ^11` are the required peers**, and the only two. The framework registers its matchers into vitest, and there is no standalone runner. The published types merge the `test` section into the toolchain's `JterrazzConfig` (`@jterrazz/typescript/config`), so a project that typechecks them needs the toolchain beside this package — which every repository of the family runs anyway. Why vitest 5 alone, why the four native seams became optional peers, and where every artefact goes: [ADR-008](decisions/008-vitest-5-node-24-and-the-native-seams-as-optional-peers.md).
- **Every seam is an OPTIONAL peer**, loaded lazily by the one module that owns it and NAMED at startup when it is missing: `playwright` for a page, `appium`/`webdriverio` for a screen, `@vitest/browser-playwright`, `vitest-browser-react`, `vite`, `react` and `react-dom` for a component, and the four native ones — `better-sqlite3`, `pg`, `redis`, `testcontainers` — for the services a chain declares. A project that specifies none of those installs none of them.

    The refusal names the facet that asked, the peer, and the install command of the package manager the project's own lockfile names. Under pnpm a native binding also has to be listed to be BUILT, so the message adds that line:

    ```
    sqlite() requires `better-sqlite3`, an optional peer dependency of @jterrazz/test: pnpm add -D better-sqlite3.
    Under pnpm the binding is not built unless the package is listed: add "better-sqlite3" to `onlyBuiltDependencies`
    in package.json (or `only-built-dependencies` in .npmrc) and reinstall.
    ```

    **A native peer has a second way of not being there**, and it is the one that costs an afternoon: the package installed, and its `.node` never compiled, because the package manager withheld the install script — npm since 11, pnpm since 10 and bun since 1.2 all do, by default. It is `better-sqlite3` 12's: the peer range takes `^12.11.1 || ^13`, and 13 ships its binding prebuilt, so it loads with no install script at all. `sqlite()` opens one in-memory database the first time it loads the driver, so that failure is caught where it can be named rather than surfacing as a `bindings` stack trace from whichever spec seeded first:

    ```
    sqlite() found `better-sqlite3` but its native binding is not built — npm does not run a
    dependency's install script unless it is told to: npm install-scripts approve better-sqlite3
    && npm rebuild better-sqlite3.
    ```

    ([ADR-008](decisions/008-vitest-5-node-24-and-the-native-seams-as-optional-peers.md) records what the four seams cost as dependencies and what the change buys under each package manager.)

- **The browser provider is pinned to the runner, patch included.** `@vitest/browser-playwright@X` peers `vitest: X` EXACTLY, so the two move together in one change or not at all. This package therefore declares the provider as `*` rather than a range of its own — a second, weaker statement of a constraint the provider already makes would be wrong the day the pair moves — and `component()` asserts the equality when the project is built, naming both versions:

    ```bash
    npm install -D vitest@5.0.1 @vitest/browser-playwright@5.0.1   # one unit, both versions
    ```

    The peer range is `^5` and nothing else: Vitest 5 is where the artefact paths the preset routes exist, and a package holding two majors would be holding two answers about where a run writes.

- **Docker must be running** for the container-backed services. `sqlite()` and plain CLI specs need none.
- **Node 24 or newer**, as `engines` states — the toolchain's floor, and vitest 5's.
- **A chromium**, for a page or a component: `npx playwright install chromium`, once. The component facet drives the same browser the website facet does, through the same peer.
- **The ARIA dialect a tree golden is written in is Playwright's**, produced by its `ariaSnapshot()` and therefore PINNED by the `playwright` peer: a major of that peer can reword a role line, and every committed `.aria.yaml` moves with it in one regeneration. It is the same dialect on a page and on a mounted unit ([07 — Component specs](07-component.md), [14 — Assertions](14-assertions.md)).
- **A Vite the peer range names** — `^6.4 || ^7 || ^8`. `component()` reads the installed major and states the JSX default on the key that Vite transforms with (`oxc` from 8, `esbuild` before it), so a project that states no pipeline of its own gets the automatic runtime on every one of the three. This package's own suite runs on Vite 8.1; the Vite 7 path is exercised by a consumer, not by this suite — see [07 — Component specs](07-component.md).

`msw` is a direct dependency, not a peer — outgoing interception is part of the framework rather than a choice a consumer makes.

## The footprint it leaves

Nothing persistent. Inside a consuming project the framework writes only under `.artifacts/` — vite's transform cache, the coverage directory if a provider is installed, the SQLite schema template it reuses across runs, and the screenshot a failed website or mobile scenario leaves as evidence. Everything else it creates is per-RUN scratch in one temp root of the run, below the OS temp directory, removed when the run ends: the fresh working directory of each CLI spec, the per-worker database copies, the profile directory a browser or a simulator needs. One `rm -rf .artifacts` is a clean slate, and [02 — Developing](02-developing.md) holds the table of what lands where.

Containers are the one resource that outlives a process badly, which is why `afterAll(cleanup)` is a rule and not a suggestion: a suite that forgets it leaks its infrastructure into the next one.

## What a 17.0 adoption meets

`npx jterrazz-test-check --fix` is the migration: over every `specs/` tree
and every member's module tests, it renames the four ground folders to their
bare names, deepest first — the 16 pool, `<specs>/_fixtures/`, becomes the
shared ground's `<specs>/shared/fixtures/` — rewrites every literal call and document to name the
disk with `file()` or `directory()` and a full relative path —
`.seed('x.sql')` to `.seed(file('./seeds/x.sql'))`,
`.fixture('$FIXTURES/app/')` to `.fixture(directory('../../shared/fixtures/app/'))`,
`toMatch('help.txt')` to `toMatch(file('./expected/help.txt'))`,
`.run('x.spec.yaml')` to `.run(file('./x.spec.yaml'))` — and imports the two
wrappers from the entry the specification file already uses.

A stream is a stream in 17, not a string: the mover makes one compared as a
value read its text — `expect(result.stdout).toContain('x')` to
`expect(result.stdout.text).toContain('x')` — and one asserted empty an empty
text, `await expect(result.stderr).toBeEmpty()` to
`expect(result.stderr.text).toBe('')`. A table keeps its `toBeEmpty`.

Its gate is per file: it moves only a file C13 still finds 16.x-shaped — one
with a 16 ground folder beside it, or one naming a 16 pool by `$FIXTURES/` —
so a second run, a run over a tree already on 17, or a 17 file beside a 16 one
in the same tree changes nothing. The one gesture outside that gate is the
directive rename below: it runs on every file of every run, and a renamed
directive no longer matches. It is 17.0's alone: C13 and its mover retire in 17.1, once the estate's wave
has run. What it leaves to the reader:

- **A `toMatch` literal with no golden behind it stays a value.** The mover
  moves a string only when a file of that name sits in the spec's `expected/`;
  anything else was already a substring check, and still is.
- **The ratchet is one file, a section per owner.** `oxlint.baseline.json`,
  `typescript.baseline.json` and `test.baseline.json` are gone:
  `typescript baseline` records the `typescript` section of
  `jterrazz.baseline.json` and refuses a `jterrazz/…` or `jterrazz-check/…`
  key in it, and `jterrazz-test-check baseline` records those in its `test`
  section — run the two gestures once, then delete the old files
  ([19 § The ratchet](19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson)).
  A leftover per-package file is never read again: `typescript check` names
  it (`baseline-legacy`) until it is deleted.
- **Family settings leave package.json.** A repository states its settings
  for the family in `jterrazz.config.ts` at its root, a section per package,
  typed by `defineConfig` from `@jterrazz/typescript/config`; a `jterrazz` key
  in package.json is no longer read. This package's section is `test`, merged
  into that interface as `TestSettings` — it holds nothing yet, so it accepts
  `{}` and refuses any key.
- **A helper that named ground moves where it stands.** The mover writes the
  `file()` where the string was, inside the helper, and C26 refuses it there:
  a path resolves against the spec that starts the chain, so the helper takes
  the `file()` as a parameter and each test builds its own.
- **A 16.x file with no 16 folder beside it is not moved.** Nothing in it
  tells a 16 string from a 17 value, so the compiler names each call the
  types refuse, and each is written by hand.
- **A suppression follows the rule it names.** `d8w-text-bypass` and `c2-http-only-requests` no longer exist
  under those names: the mover rewrites
  a directive naming one to `d8w-raw-bypass` or `c2-request-extension` on every
  file, a tree an earlier mover already moved included, and the line a
  `-next-line` or `-line` directive naming D8w covers reads `.raw` — the
  capture 16's `.text` was. A directive naming a rule 17 retired names nothing,
  and the toolchain's Suppressions pass reports it: delete it.
- **An override follows the rule it names too.** oxlint refuses to start on a
  config naming a rule the plugin does not define, so the mover rewrites each
  member's oxlint config (`oxlint.config.ts`, its `.js`/`.mjs`/`.mts` forms,
  `.oxlintrc.json`): an override of a renamed rule names its 17 id, and an
  override of a static rule 17 retired is removed with the comment lines
  directly above it —
  `b2-known-fixture-marker`, `c13-underscored-ground`, `c8-referenced-fixture-exists` and `d12w-response-body-probe` no longer exist.
  What a removed override tuned is not carried over: the rule that replaced
  it, if any, is judged at its own defaults.
- **A computed name is out of its reach.** A template or a variable naming a
  seed, a fixture or a golden is left as written, and the first run names each
  one the verb refuses.
- **A domain named with a reserved word** (`requests/`, `fixtures/`, …) is
  renamed by hand: C1 refuses it, and only its author knows the subject.
- **Element names are exact.** A partial name that 16.x widened now designates
  nothing; write the accessible name whole, as the ARIA tree prints it.

The toolchain's own flow carries three more things to know before they surprise
a reader:

- **A member whose ROOT is the specs tree** (`packages: ['specs']`) is judged by
  `jterrazz-test-check .` or by a path-less run from that member. The
  toolchain's own walk looks for a CHILD directory named `specs`, so until it
  makes the same move its Test Conventions pass reports the member findings
  alone — `TODO.md` carries the ask.
- **An include entry that names `.test.ts`** stops collecting the moment `--fix`
  renames a facet spec. The mover names the ones it BROKE — a glob whose prefix
  covers a file it moved, a literal naming one, and never a comment — so a
  notice is always about a file that just moved; update them in the same commit,
  and E7w holds the class afterwards.
- **`typescript baseline` in an npm-hoisted member** cannot resolve oxlint
  today, so the step the adopt flow prescribes "where red" has to be run from a
  directory where `node_modules/.bin/oxlint` does resolve. Also in `TODO.md`.

## Pitfalls

- **Pushing the bump and expecting a publish.** `main` is not a release trigger. Without a created GitHub release, the version on npm does not move.
- **Releasing from a red tree.** The workflow will refuse, and it refuses AFTER the tag exists — so the tag has to be re-cut once the fix lands.
- **Adding a file to the tarball by putting it in the repository.** Only what `files` names ships. A new published asset is a manifest change, and a deliberate one.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [03 — Testing](03-testing.md)
