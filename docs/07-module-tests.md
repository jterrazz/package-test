# 07 — Module tests (`*.test.ts`, beside the module)

A module test is one file of source code, met through its own exports, with nothing started. It needs no constructor, no folder and no runner — it is the rung the doubles ladder opens on. It is also the exception: a behaviour a user relies on is specified end to end, and a module test is kept only for a pure algorithm or a failure no end-to-end path provokes ([23 § Which test earns its place](23-conventions.md#which-test-earns-its-place)).

| The shape           | Held below                                                         |
| ------------------- | ------------------------------------------------------------------ |
| What it specifies   | [What it specifies](#what-it-specifies)                            |
| Where it is written | [The constructor: there is none](#the-constructor-there-is-none)   |
| The chain           | [The chain: there is none either](#the-chain-there-is-none-either) |
| What it may hold    | [What it may and may not do](#what-it-may-and-may-not-do)          |
| The result          | [The result is the return value](#the-result-is-the-return-value)  |
| What only it does   | [Unique here](#unique-here)                                        |
| What it will refuse | [Pitfalls](#pitfalls)                                              |

## What it specifies

A module test answers one question: **given these inputs and these ports, what does this module return, and what does it ask of its collaborators?** Its subject is a unit of code, so it sits beside that code:

```text
src/domain/posts/
├── ranking.ts
├── ranking.test.ts          # the module's spec — the `.test.ts` suffix IS the kind
└── ranking.fixtures.ts      # the payloads it feeds itself, if any
```

The suffix decides which project collects the file and therefore which rules judge it. `unit()` takes `**/*.test.ts` outside `specs/` and excludes `**/*.test.tsx`; a `.test.ts` UNDER `specs/<facet>/` is rule `file-suffix-matches-place`'s error, with the fix "rename it `.spec.ts`", and a rendered thing in a `.test.ts` is rule `no-dom-in-module-test`'s, with the fix "rename it `.test.tsx`" ([09 — Component specs](09-component.md)).

Nothing in this kind is slow, so the `unit` project is the one every developer runs on every save, and this package holds its own to a time budget ([03 — Testing § The eight projects](03-testing.md#the-nine-projects) states it).

## The constructor: there is none

Every facet below this chapter starts something — a server, a database, a binary, a browser, a simulator — so every one of them has a `*.specification.ts` holding what was started. A module starts nothing. This kind has no folder under `specs/` at all — no specification file, and no project helper to configure beyond `unit()`.

That is the fork's whole criterion, and it runs both ways: the moment a test needs a real service, a real binary or a real screen, it is no longer this kind, and the chapter that owns it says which one it became ([05 — Getting started § Which kind of test](05-getting-started.md#which-kind-of-test)).

## The chain: there is none either

A module test is plain vitest: `test`, `expect`, the native matchers. What the framework adds are four primitives it may reach for by name — `mockOf`, `intercept()`, `clock` and `text()` — and the two that touch shared state, `intercept()` and `clock`, are scopes that give back what they took.

```typescript
import { clock } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { twoPosts } from './ranking.fixtures.js';
import { rank } from './ranking.js';

describe('rank', () => {
    test('ranks a fresher post above an older one of equal score', () => {
        // Given - two posts of equal score, one written this morning
        using _ = clock.at('2026-03-04T09:30:00Z');

        // Then - the fresher one leads
        expect(rank(twoPosts).map((post) => post.id)).toStrictEqual(['fresh', 'stale']);
    });
});
```

## What it may and may not do

The table is the rule set, and every row names the rule that holds it, where one does ([24 — Linting § The rule catalogue](24-linting.md#the-rule-catalogue)).

| May                                                                                                                                                                                                                  | May not                                                                                                                                                            | Rule                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| import its module and pure helpers; a sibling `<file>.fixtures.ts`                                                                                                                                                   | import a data asset (`.json` / `.txt` / `.sql` / `.yaml`); keep a `__mocks__/` or `__fixtures__/` directory                                                        | `no-module-mock`                                                                               |
| `mockOf<Port>()` / `mockOf<Port>({ deep: false })` for an injected interface; `vi.fn<Fn>()`; `vi.spyOn` on an object passed in                                                                                       | `vi.mock` / `vi.doMock`, except a specifier on the consumer's `modules` allow-list, written `{ module, reason }`                                                   | `no-module-mock`                                                                               |
| `await using _ = await intercept(http.get(url), http.json(…))`                                                                                                                                                       | `vi.stubGlobal('fetch')`, `msw/node`, `nock`                                                                                                                       | `no-vitest-time-or-global-stub`, `no-second-test-runtime`                                      |
| `using _ = clock.at('2026-03-04T09:30:00Z')`; `using _ = clock.run()`; `await clock.advance(ms)`                                                                                                                     | `Date.now()`, zero-argument `new Date()`, `Math.random()`, `randomUUID()` reaching an oracle; `vi.useFakeTimers` / `vi.setSystemTime`                              | `no-sampled-value-in-expectation`, `no-sampled-value-in-test`, `no-vitest-time-or-global-stub` |
| `vi.stubEnv('X', 'y')` for a module whose stub IS an env read — it restores itself                                                                                                                                   | `process.env.X = …`, a raw assignment nothing gives back                                                                                                           | `no-raw-env-write`                                                                             |
| one top-level `describe` titled with the subject — the module's export, `describe('rank', …)` — every test inside it; a `test.each` table (`given-and-then-markers-present` judges the table once, not once per row) | a nested `describe`; a second `describe`, or a test beside it; a `beforeEach` / `beforeAll` that builds the Given                                                  | `one-describe-per-file`, `one-describe-level`, `given-in-the-test`                             |
| `expect(text(value).text).toContain(…)`; `toStrictEqual` against a literal                                                                                                                                           | a golden (`toMatch(file(…))`) — a module with a golden is an integration spec ([08](08-integration.md)), a convention no rule holds; any `toMatchSnapshot` matcher | `no-vitest-snapshot`                                                                           |
| —                                                                                                                                                                                                                    | `document` / `window` / `navigator`; `@vitest-environment happy-dom`; `react-dom/server`                                                                           | `no-dom-in-module-test`, `no-simulated-dom`, `no-second-test-runtime`                          |

A module that fetches a RELATIVE url is browser code and cannot run under node as it stands: either state where it resolves (`intercept(stubs, { origin })`, below) or specify it where it renders — a component spec.

### Doubles

`mockOf<Port>()` doubles an injected interface and `vi.fn<Fn>()` a function; a module test is the only kind that builds its own double. Both, and the ladder that says when a double is the right tool, are [19 — Time and doubles](19-time-and-doubles.md#doubles).

### `intercept()` — the network, declared, with no chain

A module that reaches the network states what it expects to find there, in the same stub vocabulary every facet uses — the same double, with no chain to hang it on.

```typescript
test('reads the feed the gateway publishes', async () => {
    // Given - the feed answers with two posts
    await using _ = await intercept(
        http.get('https://console.test/api/posts'),
        http.json({ posts: [{ id: 'fresh' }, { id: 'stale' }] }),
    );

    // Then - the client hands back what the feed carried
    await expect(fetchPosts()).resolves.toHaveLength(2);
});
```

The two awaits, `{ origin }` for a subject that calls a RELATIVE url, the refusal of an empty stub list, and everything about the stubs themselves — selection, `times`, `required`, the facades, the streams — are [17 — Stubs § `intercept()`](17-stubs.md#intercept--the-same-double-with-no-chain)'s.

### Time

`using _ = clock.at(iso)` pins `Date` for the scope; `clock.run()` and `await clock.advance(ms)` take the timers too, for a subject whose behaviour is elapsed time — [19 — Time and doubles § The clock](19-time-and-doubles.md#the-clock).

### Fixtures

A payload a module test feeds itself lives in a sibling `<file>.fixtures.ts` — TypeScript, type-checked with the test, reviewed in the same diff. A `.json` beside a module test is `no-module-mock`'s error: an asset the compiler never reads is a second source of truth, and the kind that legitimately owns assets is the one that has a folder for them.

### Tables

`test.each` is the form for a rule with many cases, and `given-and-then-markers-present` judges the table ONCE — the Given/Then narration is written on the table, not repeated in every row.

```typescript
test.each([
    { expected: 'fresh', label: 'a fresher post of equal score', posts: equalScore },
    { expected: 'high', label: 'a higher score of equal age', posts: equalAge },
])(
    // Given - $label
    // Then - it leads the ranking
    'ranks $label first',
    ({ expected, posts }) => {
        expect(rank(posts)[0]?.id).toBe(expected);
    },
);
```

## The result is the return value

There is no result object here, because there is no chain to hand one back. The subject is the module's own return value, its thrown error, or a call recorded on a port double — and those are vitest's native matchers' to judge ([21 — Assertions](21-assertions.md#scalars--native-expect)). `text(value)` is the one helper that borrows the framework's stream vocabulary for a plain string.

## Unique here

- **It is the only kind with no folder.** Every other kind is collected by a path (`specs/<facet>/`); this one is collected by a suffix, beside what it specifies. Moving a module test away from its module is `facet-test-uses-its-runner`'s error in one direction and `file-suffix-matches-place`'s in the other.
- **It is the only kind that may build its own double.** Below this chapter a double is DECLARED — a stub, a service, a seeded row — because the subject is an assembled product and the test does not hold its wiring. A module test is handed the wiring, so `mockOf` is in its hands.
- **It is the only kind with no golden.** A golden is a file, and a file beside a module test is an asset; a module whose answer deserves a golden is describing something assembled, and the integration facet is where that goes ([08](08-integration.md#the-golden-half--a-pure-module-no-services-at-all)).
- **It is the kind the budget is written for.** The `unit` project is the fast one, and the budget [above](#what-it-specifies) keeps the loop a loop.

## Pitfalls

- **Reaching for `vi.mock` to avoid injecting a port.** The mock outlives the test's intent: every importer of that specifier gets the double, and the design pressure the injection would have applied is gone. Double the port.
- **`vi.setSystemTime` instead of `clock`.** A fake timer taken without `using` outlasts the test that took it, and the next test in the file inherits a clock nobody declared. `no-vitest-time-or-global-stub` refuses it and names the primitive.
- **Importing a `.json` payload.** `no-module-mock` refuses it. Put the payload in `<file>.fixtures.ts`, where the compiler reads it.
- **Nesting `describe`.** The one level is THE describe, titled with the subject, holding every test ([23 § One file, one subject](23-conventions.md#one-file-one-subject)); a second level describes a structure the test file does not have. `one-describe-per-file` refuses a file with no describe or two, `one-describe-level` the nesting.
- **Asserting on a DOM.** There is no document here, and there will not be one: `no-dom-in-module-test` refuses the globals, `no-simulated-dom` refuses the `@vitest-environment` comment that would conjure them, and the route is a `.test.tsx` in a real browser.
- **Letting the Given drift into `beforeEach`.** A Given nobody can read in the test is a Given nobody maintains. `given-in-the-test` says so.

## Related

[02 — Developing](02-developing.md) · [03 — Testing](03-testing.md) · [08 — Integration specs](08-integration.md) · [09 — Component specs](09-component.md) · [21 — Assertions](21-assertions.md) · [22 — Tokens](22-tokens.md) · [17 — Stubs](17-stubs.md) · [23 — Conventions](23-conventions.md) · [24 — Linting](24-linting.md)
