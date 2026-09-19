# ADR-005: The doubles ladder is closed, and a ban an upstream rule can carry is an option, not a rule

**Status:** Proposed
**Date:** 2026-09-19

## Context

Two questions had no written answer, and the estate's tests answered them
differently in every repository.

**What may stand in for the real thing?** The measured failure mode is not
subtle: a survey of the workbench found seven files replacing `fetch` with
`vi.stubGlobal`, thirteen importing `vitest-mock-extended` directly, sixteen
calling `vi.mock` on a module, two declaring `msw` themselves, five using
`toMatchSnapshot`. Every one of them is a substitute chosen because nothing
said which substitute to reach for first. Agents make this worse rather than
better — the published measurements put a third of agent-written test commits
at "adds a mock", and nearly all of those at "mocks everything".

**Who owns a ban?** ADR-002 settled that a convention oxlint's own `vitest`
plugin already enforces belongs to that plugin, and four hygiene rules left the
`jterrazz/*` channel on that ground. It did not settle the case where the
upstream rule exists but is inert without OPTIONS —
`vitest/no-restricted-matchers` bans nothing until it is told which matchers,
`vitest/no-restricted-vi-methods` until it is told which methods. Those options
are a convention, and they had nowhere to live.

Two shapes were weighed and refused. Writing a `jterrazz/*` rule for each ban
duplicates an upstream rule that already does the work, which is exactly what
ADR-002 forbids. Asking `compose()` to MERGE options across fragments is a
toolchain change with no other caller, and it would make two owners of one
rule's configuration.

## Decision

**The ladder is closed and ordered.** An agent takes the first rung that fits:

1. **The real thing**, in-process — a pure module, a Hono app handed to
   `server`, a component mounted in a real Chromium.
2. **A declared service** — `sqlite()`, `postgres()`, `redis()`, `process()`:
   real, isolated per worker, reset per chain.
3. **A contract** — `.intercept()` on a chain, `intercept()` in module scope;
   msw's server, msw's worker, or the `node:http` stub, all over one queue;
   strict from the first contract.
4. **A typed port double** — `mockOf<Port>()`, or `vi.fn<Fn>()` for a
   function-shaped dependency.

Nothing else is a rung. `vi.mock`, `vi.stubGlobal`, a raw `msw` import, `nock`,
`sinon`, `jest` and `mockdate` are not lower rungs; they are off the ladder,
and each has a named destination.

**A ban an upstream vitest rule can carry as an OPTION is set from the
`testing` fragment**, and the rulebook marks that rule `covered` so one owner
states it. A ban a CORE rule would carry — `no-restricted-imports`,
`no-restricted-globals` — stays a `jterrazz/*` rule, because an oxlint override
REPLACES a rule's options rather than merging them, and three toolchain owners
already set those two.

This extends ADR-002: the option mechanism is this record's, the principle it
serves is that one.

## Consequences

- **The ladder is citable.** "Use a contract, not a stubbed `fetch`" is a rung
  number, not an opinion, and each ban's message names the rung above it.
- **`mockOf` earns its place on rung four.** It pins
  `vitest-mock-extended`'s range on the consumer's behalf, which is why the
  consumer is forbidden to declare it. Its `{ deep: false }` form exists so
  rung four does not push a test back down to a hand-written object.
- **A mandatory type argument is not expressible.** `mockOf<T extends object>()`
  has no default, but TypeScript falls back to the CONSTRAINT where no
  inference site says otherwise, so `mockOf()` compiles and answers for
  `object`. The refusal lands where the double is used — it is assignable to
  no port — rather than where it was made. Stated rather than worked around: a
  cast or a never-typed overload would buy the earlier error with a worse
  signature.
- **Three bans move upstream.** `no-restricted-matchers` (the snapshot
  matchers), `no-restricted-vi-methods` (`stubGlobal`, the timer methods) and
  `max-nested-describe` are configured, not reimplemented. They turn on in the
  toolchain release that follows the package's next major.
- **`vi.mock` keeps one door.** A native module a consumer cannot inject is
  allow-listed per specifier, with a reason, and the allow-list is the
  repository's — not a silent exception.
- **A cost accepted.** Two channels now state bans: the fragment's options and
  the `jterrazz/*` rules. The catalogue carries both, with `upstream` as a
  channel value, so a reader still finds one list.
