# Changelog

All notable changes to `@jterrazz/test` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.2.0] - 2026-04-11

### ⚠ BREAKING CHANGES

#### CLI specs always run in a fresh empty temp directory

Previously, a CLI spec without `.project()` or `.fixture()` fell back to running in `fixturesRoot` itself — which meant scaffolding CLIs (copier, plop, your own codegen tools) would silently write into your committed fixture directory if you forgot to attach a project. The old fallback was surprising and unsafe.

Now every `.exec()` / `.spawn()` invocation runs in a fresh `mkdtemp` directory unconditionally. `.project("name")` still copies a fixture project into that temp dir before the command runs; `.fixture("file")` still copies individual files on top.

**You are affected if:** you wrote a CLI spec like `spec("x").exec("...")` _without_ calling `.project()` or `.fixture()` and were relying on the command running inside `fixturesRoot` (e.g., your CLI was modifying files committed under `tests/fixtures/`).

**Migration:**

```diff
// BEFORE — silently ran in fixturesRoot, polluted committed fixtures
const result = await spec("scaffold")
  .exec("copier copy template .")
  .run();

// AFTER (no change needed — you now get an isolated temp dir for free)
const result = await spec("scaffold")
  .exec("copier copy template .")
  .run();

// If you were ACTIVELY relying on running in fixturesRoot (rare),
// switch to .project() with an explicit fixture project:
const result = await spec("scaffold")
  .project("scaffold-base")     // copies fixturesRoot/scaffold-base into a temp dir
  .exec("copier copy template .")
  .run();
```

For most callers there is no migration step — you simply stop accidentally writing into your fixture directory. If you previously needed an `empty-project` placeholder fixture purely to force isolation (a common workaround), you can delete it.

### Fixed

- Lint baseline restored after the codestyle 2.2.0 + knip upgrade. Validate workflow is green again.

## [5.1.0] - 2026-04-11

### Added

- **`result.directory(path).toMatchFixture(name)`** — directory snapshot assertion. Walks the generated tree, diffs it against `expected/{name}/` (relative to the test file), and throws a structured diff (added / removed / changed, with line-level diff for changed files) on mismatch. Default ignores: `.git`, `.DS_Store`, `node_modules`, `.next`, `dist`, `.turbo`, `.cache`. Pass extra ignores via `{ ignore: [...] }`. Update fixtures with `JTERRAZZ_TEST_UPDATE=1`, `UPDATE_SNAPSHOTS=1`, or `vitest -u`. Designed for testing scaffolding tools, code generators, and bundler outputs.
- **`result.directory(path).files()`** — recursive sorted file list with the same default ignores, for ad-hoc presence/absence assertions when a full snapshot is overkill.
- **`spec.env({ KEY: "value" })`** — set environment variables on the CLI child process. `null` unsets a variable. The token `$WORKDIR` in any value expands to the temp working directory at run time (e.g. `HOME: "$WORKDIR"` for full home isolation). Multiple `.env()` calls merge.

### Changed

- README and skill docs reorganized; new sections for directory snapshots, env vars.

## [5.0.0] - 2026-03-28

### Added

- Initial 5.x baseline with `integration()`, `e2e()`, `cli()` specification runners; `postgres()` and `redis()` service factories; `mockOf` / `mockOfDate` mocking helpers; Docker assertion port; full `SpecificationBuilder` fluent API (`seed`, `fixture`, `project`, `mock`, `get` / `post` / `put` / `delete`, `exec`, `spawn`).

[Unreleased]: https://github.com/jterrazz/package-test/compare/v5.2.0...HEAD
[5.2.0]: https://github.com/jterrazz/package-test/compare/v5.1.0...v5.2.0
[5.1.0]: https://github.com/jterrazz/package-test/compare/v5.0.0...v5.1.0
[5.0.0]: https://github.com/jterrazz/package-test/releases/tag/v5.0.0
