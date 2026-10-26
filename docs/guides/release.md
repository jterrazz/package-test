# Release

This repository ships one thing: the npm package `@jterrazz/test`. Nothing here deploys, nothing here runs as a service, and merging to `main` publishes nothing: a release is a deliberate, separate act. This page says what that act is, what leaves the tree when it happens, and the footprint the package leaves in a project. What a consumer installs beside it is [Set up a project § What to install](../start/set-up-a-project.md#what-to-install).

## Releasing

A release is four steps, in this order.

1. **Bump and land the version.** The version in `package.json` moves, alone, in a commit whose subject is `chore: <version> — <what changed>`. The commit log is the changelog: this repository carries no `CHANGELOG.md`, by decision, and the release notes plus that subject line are the record. A major also adds what it makes a project rewrite to [Set up a project § Upgrading](../start/set-up-a-project.md#upgrading), the one page a consumer reads before bumping.
2. **Rehearse the gate.** `make rehearse` runs it on that commit as the runner will, on Linux ([A rehearsal on Linux](https://github.com/jterrazz/package-typescript/blob/main/docs/reference/commands.md#a-rehearsal-on-linux)), and exits 0.
3. **Create the GitHub release**, tagged at that commit. This is the trigger and the only one: `.github/workflows/release.yaml` listens on `release: types: [created]`.
4. **Watch the gate.** The workflow delegates to the shared `jterrazz/studio-actions/.github/workflows/release-npm.yaml`, which runs the FULL validate job first (the same targets the push gate runs, chromium included: [Test § What CI runs](test.md#what-ci-runs)) and publishes only if it is green.

The publish step is `npm publish --access public --provenance`, on Node 24, with `id-token: write` granted so npm records a provenance attestation linking the tarball to the workflow run that built it. The registry is npm's, stated as `publishConfig` in the manifest.

Because validate runs inside the release workflow, a red suite stops a publication rather than a merge. That is the design: the tree on `main` is always publishable, and nothing decides for you when it is published.

## What leaves the tree

The tarball is what `files` declares and nothing else: `dist/` less the source maps the build writes for coverage, plus `schema/` and `docs/` less the two pages that are this repository's own: `guides/test.md`, how it tests itself and the rules only it is held to, and `decisions/`, what it alone decided. `dist/` holds only the shipped entries; the repository's own programs are built into `.artifacts/dev/` and so never reach the tarball ([Develop § The build comes first](develop.md#the-build-comes-first)). This package's audience meta-test holds the line on the tarball as `npm pack` writes it: a byte of it that names a self rule, a published entry that registers one, a private entry that runs one, a packed chunk that only an unshipped bundle imports, or a packed bundle that imports a module the tarball lacks, fails the suite.

The shipped chapters keep their links to the two pages left home, so from inside an install such a link reaches nothing: both are read in the repository, at <https://github.com/jterrazz/package-test/tree/main/docs>.

**The manual ships with the code**, because the code points at it: every relative link of the shipped `README.md` and every `read: docs/reference/linting.md#...` a rule message ends on is read from inside an install, and a chapter that is not there makes both a dead end. `specs/cli/node/pages.spec.ts` holds it from the packed tarball: every chapter the installed README and modules cite is listed with whether the install holds it.

The entries that reach a consumer are the whole public contract, and they are listed once: [Architecture § What the tree publishes](../concepts/architecture.md#what-the-tree-publishes). What matters here is only that the ROOT entry resolves by CONDITION: a bundler serving a page takes `browser`, node takes `import`, and both are described by one `types` entry.

No binary ships with them. The conventions checker is the `#checker` private import, `dist/checker.js`, and the `test()` preset names it as its checks: `typescript check`, `fix` and `baseline` run it through the toolchain's own checker program, once over the repository (every specs tree, every member) and once per member declaring its own presets. Its findings are published under the `jterrazz-check/<name>` keys the ratchet counts ([Linting](../reference/linting.md#the-ratchet-the-test-section-of-studiobaselinejson)). How the toolchain runs a preset's checks is `@jterrazz/typescript`'s: [Quality checks § A preset's checks](https://github.com/jterrazz/package-typescript/blob/main/docs/reference/quality-checks.md#a-presets-checks).

## The footprint it leaves

Nothing persistent: inside a consuming project the framework writes only under `.artifacts/`, and keeps its scratch in one temp folder per run that it removes when the run ends; [Set up a project § Where a run writes](../start/set-up-a-project.md#where-a-run-writes) lists each path.

Containers are the one resource that outlives a process badly, which is why `afterAll(cleanup)` is a rule and not a suggestion: a suite that forgets it leaks its infrastructure into the next one.

## Pitfalls

- **Pushing the bump and expecting a publish.** `main` is not a release trigger. Without a created GitHub release, the version on npm does not move.
- **Releasing from a red tree.** The workflow will refuse, and it refuses AFTER the tag exists, so the tag has to be re-cut once the fix lands.
- **Adding a file to the tarball by putting it in the repository.** Only what `files` names ships. A new published asset is a manifest change, and a deliberate one.

## Related

[Architecture](../concepts/architecture.md) · [Develop](develop.md) · [Test](test.md)
