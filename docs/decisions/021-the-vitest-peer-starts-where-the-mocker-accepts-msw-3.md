# ADR-021: The vitest peer starts where the mocker accepts msw 3

**Status:** Proposed
**Date:** 2026-10-21

Supersedes the `^5` peer of [ADR-008](008-vitest-5-node-24-and-the-native-seams-as-optional-peers.md); the rest of ADR-008 stands.

## Context

The package moved to msw 3. Vitest's `@vitest/mocker` peers on msw too, optionally, and through 5.0.3 that peer is `^2.4.9`; 5.0.4 (2026-10-12) is the first that reads `^2.4.9 || ^3.0.0`. In a project on vitest 5.0.1, npm keeps msw 2 at the top of `node_modules` for the mocker and installs msw 3 under `@jterrazz/test`. A component test then fails to load: Vite pre-bundles the package's page entry into its deps cache, and the `msw/browser` import that bundle keeps fails to resolve (jterrazz-web's `markdown-renderer.test.tsx`, every run).

Three answers were on the table: raise the vitest floor, make msw a peer resolved at the project, or stay on msw 2. A peer msw contradicts ADR-008, which keeps msw a dependency no consumer declares (rule `no-redundant-test-dependency` reads that list), and under a 5.0.1 mocker a peer `^3` conflicts all the same. Staying on msw 2 gives up the major for a constraint a patch of vitest already lifted.

## Decision

- The `vitest` peer is `^5.0.4`, the first version whose mocker accepts msw 3. The package's own pair, `vitest` and `@vitest/browser-playwright`, moves to 5.0.5 in one unit.
- msw stays a dependency, at `^3`.

## Consequences

- A project on vitest below 5.0.4 is refused at install with an `ERESOLVE` naming the peer, where it used to install and fail its first component test. It moves `vitest` and `@vitest/browser-playwright` together, a row of [Set up a project § From 17 to 18](../start/set-up-a-project.md#from-17-to-18).
- With the mocker at 5.0.4 or later, npm resolves one msw, 3, at the project's top, and `msw/browser` is the one the package's page entry was built against.
