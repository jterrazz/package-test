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

The tarball is what `files` declares and nothing else: `dist/`, minus `dist/catalog.*`, plus `schema/`. The catalogue generator is a development gesture with no consumer — it writes this repository's own projections — so it is built but never shipped.

The entries that reach a consumer are the whole public contract, and they are listed once — [01 — Architecture § What the tree publishes](01-architecture.md#what-the-tree-publishes). What matters here is only that the ROOT entry resolves by CONDITION: a bundler serving a page takes `browser`, node takes `import`, and both are described by one `types` entry.

One binary ships with them: `jterrazz-test-check`, the conventions checker, pointed at `dist/checker.js`. It answers three runs — a specs tree by path, one workspace member with `--member`, and the whole project path-less — and `--format json` publishes the findings under the `jterrazz-check(<id>)` codes ([19 — Linting](19-linting.md#the-member-pass-and-the-json-contract)). When `typescript check` runs it, which install it resolves it from, and what the floor version is, are the toolchain's: `@jterrazz/typescript` `docs/06-quality-checks.md` § The Test Conventions pass.

## What a consumer must bring

The package refuses to guess at its environment, so several things it uses are the consuming project's to install.

- **`vitest ^5` is the required peer**, and the only one: the framework registers its matchers into vitest, and there is no standalone runner. Why 5 alone, why the four native seams became optional peers, and where every artefact goes: [ADR-008](decisions/008-vitest-5-node-24-and-the-native-seams-as-optional-peers.md).
- **Every seam is an OPTIONAL peer**, loaded lazily by the one module that owns it and NAMED at startup when it is missing: `playwright` for a page, `appium`/`webdriverio` for a screen, `@vitest/browser-playwright`, `vitest-browser-react`, `vite`, `react` and `react-dom` for a component, and the four native ones — `better-sqlite3`, `pg`, `redis`, `testcontainers` — for the services a chain declares. A project that specifies none of those installs none of them.

    The refusal names the facet that asked, the peer, and the install command of the package manager the project's own lockfile names. Under pnpm a native binding also has to be listed to be BUILT, so the message adds that line:

    ```
    sqlite() requires `better-sqlite3`, an optional peer dependency of @jterrazz/test: pnpm add -D better-sqlite3.
    Under pnpm the binding is not built unless the package is listed: add "better-sqlite3" to `onlyBuiltDependencies`
    in package.json (or `only-built-dependencies` in .npmrc) and reinstall.
    ```

    **A native peer has a second way of not being there**, and it is the one that costs an afternoon: the package installed, and its `.node` never compiled, because the package manager withheld the install script — npm since 11, pnpm since 10 and bun since 1.2 all do, by default. `sqlite()` opens one in-memory database the first time it loads the driver, so that failure is caught where it can be named rather than surfacing as a `bindings` stack trace from whichever spec seeded first:

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

Nothing persistent. Inside a consuming project the framework writes only under `.artifacts/` — vite's transform cache, the coverage directory if a provider is installed, and the SQLite schema template it reuses across runs. Everything else it creates is per-RUN scratch in the OS temp directory: the fresh working directory of each CLI spec, the per-worker database copies, the profile directory a browser or a simulator needs. One `rm -rf .artifacts` is a clean slate, and [02 — Developing](02-developing.md) holds the table of what lands where.

Containers are the one resource that outlives a process badly, which is why `afterAll(cleanup)` is a rule and not a suggestion: a suite that forgets it leaks its infrastructure into the next one.

## What a 16.0 adoption meets

The renames and the new rows land through the toolchain's own flow, with three
things to know before they surprise a reader:

- **A member whose ROOT is the specs tree** (`packages: ['specs']`) is judged by
  `jterrazz-test-check .` or by a path-less run from that member. The
  toolchain's own walk looks for a CHILD directory named `specs`, so until it
  makes the same move its Test Conventions pass reports the member findings
  alone — `TODO.md` carries the ask.
- **An include glob that names `.test.ts`** stops collecting the moment `--fix`
  renames a facet spec. The mover names every such glob in the member it moved
  files under; update them in the same commit, and E7w holds the class
  afterwards.
- **`typescript baseline` in an npm-hoisted member** cannot resolve oxlint
  today, so the step the adopt flow prescribes "where red" has to be run from a
  directory where `node_modules/.bin/oxlint` does resolve. Also in `TODO.md`.

## Pitfalls

- **Pushing the bump and expecting a publish.** `main` is not a release trigger. Without a created GitHub release, the version on npm does not move.
- **Releasing from a red tree.** The workflow will refuse, and it refuses AFTER the tag exists — so the tag has to be re-cut once the fix lands.
- **Adding a file to the tarball by putting it in the repository.** Only what `files` names ships. A new published asset is a manifest change, and a deliberate one.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [03 — Testing](03-testing.md)
