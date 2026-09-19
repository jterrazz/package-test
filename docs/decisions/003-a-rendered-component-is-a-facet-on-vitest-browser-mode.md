# ADR-003: A rendered component is a facet, on Vitest Browser Mode

**Status:** Accepted
**Date:** 2026-09-19

## Context

The estate tested its UI in two dialects at once. A page spec said
`click(link('Articles'))` against a real Chromium and goldened what the page
MEANT; beside it, in the same repository, a component test said
`render / screen / fireEvent / waitFor` against `happy-dom` with a scripted
`fetch`, and goldened nothing. Same product, same reader, two vocabularies —
and the second proves the least of the two, because the thing it renders never
met a browser.

The corpus had sanctioned that split. `docs/12-conventions.md` and the agent
skill both said a component test "needs vitest alone", on the ground that the
framework is for a SURFACE and a component has none. The reading was wrong in
one word: a component has no surface it is SERVED through, but it needs
everything the framework owns — a real browser, a Vite pipeline, a network
double, a golden engine, an element vocabulary. Rule I2's own message had been
saying so all along: "a test needing more than its module is a specification".

What forced a decision now is that the estate has a UI to migrate (a console's
42 tests, a browser extension's DOM renderer, a web app's string renderer) and
every one of them would otherwise be written a third time.

## Decision

A rendered component is a FACET of `@jterrazz/test`, running in Vitest Browser
Mode on the `playwright` peer the website facet already drives.

It is the facet with **no constructor**. A component starts nothing — no
server, no database, no binary, no simulator — so there is no handle to
destructure and no `*.specification.ts` to hold it. The chain is exported
directly (`component.intercept(…).wrap(…).render(<X />, scenario)`), and what
every render of a project shares belongs to the PROJECT: `component()` in
`vitest.config.ts`.

Its test file sits **beside its subject**, as a module test does, and the
suffix states the kind: `<file>.test.ts` is a module, `<file>.test.tsx` is a
component. `unit()` excludes `.test.tsx`; `component()` collects exactly those.

The package keeps **one specifier**. A page cannot load the node entry, so
`exports["."]` gains a `browser` condition resolving to a second build of the
same surface, in which every node-only name is a stub that throws where it was
called. The split is the runtime's, never the facets'.

Weighed and rejected:

- **A Node-side gallery** — Playwright driven from the test process, one
  browser context per render. Measured at ~15 s against 0.6–1.1 s per file for
  Browser Mode, and it needs an undeclared `vite` to build what it serves.
- **Playwright Component Testing** — a second runner beside vitest, with its
  own config, its own reporters and its own assertion library. The estate has
  one runner on purpose.
- **`happy-dom` + Testing Library** — the status quo. Two vocabularies, and the
  cheaper one is the one that proves least.
- **A second specifier, `@jterrazz/test/browser`** — considered and dropped: it
  makes every test file remember which entry it may import, and needs a rule to
  enforce the memory. One specifier and a condition costs nothing at the call
  site.

## Consequences

- `happy-dom`, `jsdom` and `@testing-library/*` leave the estate's test
  vocabulary. Rules E5, E5b, F6 and G4 refuse them and name the move; E6
  refuses a hand-rolled `browser:` project, because the provider pin, the
  service worker, the JSX transform and the cold-cache pre-bundling are four
  ways for a run to pass here and fail on the next machine.
- A component spec and a page spec now read alike: same descriptors, same
  verbs, same W3 ambiguity refusal, same ARIA-tree golden in the same dialect.
  The vocabulary gains what a rendered surface needs and a page lacked —
  `gone`, `focused`, and five role descriptors.
- A consumer takes on optional peers it did not have (`@vitest/browser-playwright`,
  `vitest-browser-react`, `vite`, `react`), and one hard constraint with them:
  the provider peers vitest on an EXACT version, so the two move in one change.
- CI pays for a second Chromium project. `sequence.groupOrder` keeps it from
  sharing a slot with the website project on a two-vCPU runner.
- React Native stays out: Browser Mode does not run it. `.astro` pages stay
  website specs; only islands are components.
- The package's own suite grows a component tree that is NOT under `_fixtures/`
  — ground is what a spec stands on from a distance, and here the spec stands
  next to it.
