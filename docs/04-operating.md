# 04 — Operating

This repository ships one thing: the npm package `@jterrazz/test`. Nothing here deploys, nothing here runs as a service, and merging to `main` publishes nothing — a release is a deliberate, separate act. This chapter says what that act is, what leaves the tree when it happens, and the footprint the package leaves in a project. What a consumer installs beside it is [06 — Setting up a project § What to install](06-setting-up.md#what-to-install).

## Releasing

A release is three steps, in this order.

1. **Bump and land the version.** The version in `package.json` moves, alone, in a commit whose subject is `chore: <version> — <what changed>`. The commit log is the changelog: this repository carries no `CHANGELOG.md`, by decision, and the release notes plus that subject line are the record.
2. **Create the GitHub release**, tagged at that commit. This is the trigger and the only one — `.github/workflows/release.yaml` listens on `release: types: [created]`.
3. **Watch the gate.** The workflow delegates to the shared `jterrazz/jterrazz-actions/.github/workflows/release-npm.yaml`, which runs the FULL validate job first — the same build, lint and test the push gate runs, chromium included — and publishes only if it is green.

The publish step is `npm publish --access public --provenance`, on Node 24, with `id-token: write` granted so npm records a provenance attestation linking the tarball to the workflow run that built it. The registry is npm's, stated as `publishConfig` in the manifest.

Because validate runs inside the release workflow, a red suite stops a publication rather than a merge. That is the design: the tree on `main` is always publishable, and nothing decides for you when it is published.

## What leaves the tree

The tarball is what `files` declares and nothing else: `dist/`, minus `dist/route-split.*`, `dist/schema.*`, `dist/self.*`, `dist/self-*` and the source maps the build writes for coverage, plus `schema/` and `docs/` less the two pages that are this repository's own: `03-testing.md`, how it tests itself and the rules only it is held to, and `decisions/`, what it alone decided. `dist/self.*` — the self checker, the chapter generator and the coverage gesture — and every `dist/self-*` bundle — the self preset, which declares the coverage floor, the self plugin, and the chunks only those load — are development gestures with no consumer, wiring rules only this package is held to ([03 — Testing § The package's own rules](03-testing.md#the-packages-own-rules)), so they are built and never shipped; so is `dist/schema.*`, which writes the published schema this repository commits. `dist/route-split.*` is held back too: it judges the route ratchet of this repository's own split runs, and only `make test-merge` calls it. This package's audience meta-test holds the line on the tarball as `npm pack` writes it: a byte of it that names a self rule, a published entry or bin that registers or runs one, a packed chunk that only an unshipped bundle imports, or a packed bundle that imports a module the tarball lacks, fails the suite.

The shipped chapters keep their links to the two pages left home, so from inside an install such a link reaches nothing: both are read in the repository, at <https://github.com/jterrazz/package-test/tree/main/docs>.

**The manual ships with the code**, because the code points at it: every relative link of the shipped `README.md` and every `(… — see docs/24-linting.md#…)` a rule message ends on is read from inside an install, and a chapter that is not there makes both a dead end. `specs/cli/node/pages.spec.ts` holds it from the packed tarball: every chapter the installed README and modules cite is listed with whether the install holds it.

The entries that reach a consumer are the whole public contract, and they are listed once — [01 — Architecture § What the tree publishes](01-architecture.md#what-the-tree-publishes). What matters here is only that the ROOT entry resolves by CONDITION: a bundler serving a page takes `browser`, node takes `import`, and both are described by one `types` entry.

One binary ships with them: `jterrazz-test-check`, the conventions checker, pointed at `dist/checker.js`. It answers three runs — a specs tree by path, one workspace member with `--member`, and the whole project path-less (a path that is NOT a specs tree is read as a project root and takes that third run, anchored there) — and `--format json` publishes the findings under the `jterrazz-check/<name>` keys the ratchet counts ([24 — Linting](24-linting.md#the-member-pass-and-the-json-contract)). When `typescript check` runs it, which install it resolves it from, and what the floor version is, are the toolchain's: `@jterrazz/typescript`'s [Quality checks § The Test Conventions pass](https://github.com/jterrazz/package-typescript/blob/main/docs/07-quality-checks.md#the-test-conventions-pass).

## The footprint it leaves

Nothing persistent: inside a consuming project the framework writes only under `.artifacts/`, and keeps its scratch in one temp folder per run that it removes when the run ends — [06 — Setting up § Where a run writes](06-setting-up.md#where-a-run-writes) lists each path.

Containers are the one resource that outlives a process badly, which is why `afterAll(cleanup)` is a rule and not a suggestion: a suite that forgets it leaks its infrastructure into the next one.

## Pitfalls

- **Pushing the bump and expecting a publish.** `main` is not a release trigger. Without a created GitHub release, the version on npm does not move.
- **Releasing from a red tree.** The workflow will refuse, and it refuses AFTER the tag exists — so the tag has to be re-cut once the fix lands.
- **Adding a file to the tarball by putting it in the repository.** Only what `files` names ships. A new published asset is a manifest change, and a deliberate one.

## Related

[01 — Architecture](01-architecture.md) · [02 — Developing](02-developing.md) · [03 — Testing](03-testing.md)
