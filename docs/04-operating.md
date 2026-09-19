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

One binary ships with them: `jterrazz-test-check`, the conventions checker, pointed at `dist/checker.js`. A consumer wires it into its own lint step.

## What a consumer must bring

The package refuses to guess at its environment, so several things it uses are the consuming project's to install.

- **`vitest` is a required peer.** The framework registers its matchers into vitest; there is no standalone runner.
- **Every seam is an OPTIONAL peer**, loaded lazily by the one module that owns it and NAMED at startup when it is missing: `playwright` for a page, `appium`/`webdriverio` for a screen, and `@vitest/browser-playwright`, `vitest-browser-react`, `vite`, `react` and `react-dom` for a component. A project that specifies none of those installs none of them.
- **The browser provider is pinned to the runner, patch included.** `@vitest/browser-playwright@X` peers `vitest: X` EXACTLY, so the two move together in one change or not at all. This package therefore declares the provider as `*` rather than a range of its own — a second, weaker statement of a constraint the provider already makes would be wrong the day the pair moves — and `component()` asserts the equality when the project is built, naming both versions:

    ```bash
    npm install -D vitest@4.1.11 @vitest/browser-playwright@4.1.11   # one unit, both versions
    ```

- **Docker must be running** for the container-backed services and for compose mode. `sqlite()` and plain CLI specs need none.
- **Node 20 or newer**, as `engines` states.
- **A chromium**, for a page or a component: `npx playwright install chromium`, once. The component facet drives the same browser the website facet does, through the same peer.
- **A Vite the peer range names** — `^6.4 || ^7 || ^8`. `component()` reads the installed major and states the JSX default on the key that Vite transforms with (`oxc` from 8, `esbuild` before it), so a project that states no pipeline of its own gets the automatic runtime on every one of the three. 15.2's own suite runs on Vite 8.1; the Vite 7 path is exercised by a consumer, not by this package's suite — see [16 — Component specs](16-component.md).

`msw` is a direct dependency, not a peer — outgoing interception is part of the framework rather than a choice a consumer makes.

## The footprint it leaves

Nothing persistent. Inside a consuming project the framework writes only under `.artifacts/` — vite's transform cache, the coverage directory if a provider is installed, and the SQLite schema template it reuses across runs. Everything else it creates is per-RUN scratch in the OS temp directory: the fresh working directory of each CLI spec, the per-worker database copies, the profile directory a browser or a simulator needs. One `rm -rf .artifacts` is a clean slate, and [02 — Developing](02-developing.md) holds the table of what lands where.

Containers are the one resource that outlives a process badly, which is why `afterAll(cleanup)` is a rule and not a suggestion: a suite that forgets it leaks its infrastructure into the next one.

## Pitfalls

- **Pushing the bump and expecting a publish.** `main` is not a release trigger. Without a created GitHub release, the version on npm does not move.
- **Releasing from a red tree.** The workflow will refuse, and it refuses AFTER the tag exists — so the tag has to be re-cut once the fix lands.
- **Adding a file to the tarball by putting it in the repository.** Only what `files` names ships. A new published asset is a manifest change, and a deliberate one.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [03 — Testing](03-testing.md)
