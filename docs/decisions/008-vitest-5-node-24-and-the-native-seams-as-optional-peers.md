# ADR-008: Vitest 5, Node 24, the native seams as optional peers, and every artefact under `.artifacts/`

**Status:** Accepted
**Date:** 2026-09-20

## Context

Three questions came due together at the major.

**Which runner?** 15.2 and 15.3 shipped against `vitest ^4.1.10 || ^5`, which
meant the package proved itself on two runners and a consumer could be on
either. Vitest 5 is not a drop-in: `Assertion` gained a type parameter (an
augmentation whose parameter list differs is refused outright), and Browser Mode
pins its provider to the runner's EXACT patch — `@vitest/browser-playwright@X`
peers `vitest: X`.

**Which dependencies?** `better-sqlite3`, `pg`, `redis` and `testcontainers`
were plain dependencies: every consumer installed four native packages, and
three of them built native code on install, to run a suite most of them never
pointed at a database. Under pnpm a native seam only builds when it is named in
`only-built-dependencies`, so the cost was not even paid consistently.

**Where do artefacts go?** Vitest 5 writes to `.vitest/` at the repository root,
Browser Mode leaks `.vitest-attachments/` there and `__screenshots__/` beside
the tests. The estate's doctrine says an artefact is never on the row, and the
toolchain's gate enforces it — which would have failed every consumer's first
run on 5.

## Decision

**`vitest ^5`, and only 5.** The peer is `^5`; the package's own devDependency
pins `vitest` and `@vitest/browser-playwright` to the same exact patch, and
`component()` asserts that equality at startup, naming both versions. The adopt
flow bumps the pair in one unit.

**`engines.node: ">=24"`** — the toolchain's floor, not a third one.

**The four native seams become OPTIONAL peers**, each loaded on first use
through `loadPeer()`, whose refusal names the facet, the peer, the install
command of the package manager the project's own lockfile names, and — under
pnpm — the `onlyBuiltDependencies` line. What stays a dependency is what every
consumer uses and none should declare: `msw`, `vitest-mock-extended`, `yaml`.
That list is what rule F8 reads.

The saving is npm's and Bun's. pnpm resolves a peer it can satisfy whatever
the consumer declares — with `auto-install-peers` (its default since 8) all
four arrive anyway, and the native one builds — so under pnpm the change buys
the DECLARATION, not the install: a member that uses `sqlite()` says so, and a
member that does not is no longer described by its dependency tree as a
database consumer.

**Every artefact under `.artifacts/vitest/`**: `attachmentsDir`, the
json/junit/html/blob `outputFile` map, and both screenshot directories, set by
the preset. A path the tool pins and cannot relocate is the toolchain map's to
list, not this package's to hide.

The preset also takes the hygiene defaults a suite should not have to restate:
`retry: 0`, `restoreMocks`, `unstubGlobals`, `unstubEnvs`.

## Consequences

- A consumer on vitest 4 stays on `@jterrazz/test` 15.x until it adopts 5. The
  package no longer pays for two runners, and the type augmentation can state
  vitest 5's signature character for character.
- A consumer using `sqlite()`, `postgres()`, `redis()` or a container declares
  that peer — three repositories on the workbench use `sqlite()` today. Every
  other consumer stops installing four native packages it never loads.
- The failure mode for a missing peer is a startup message naming the install
  command, not a module-resolution error from inside an adapter.
- The artefact paths are the package's to set and the toolchain's to allow: one
  entry in its allowlist, one row in the estate's toolchain map, and the gate
  holds for every consumer from their first run.
- The version pin is exact on purpose. It is the one dependency where "compatible"
  is not enough: the provider and the runner exchange a protocol, and a patch
  apart they refuse each other at startup rather than at type-check.
