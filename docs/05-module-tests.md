# 05 — Module tests (`*.test.ts`, beside the module)

A module test is the majority kind: one file of source code, met through its own exports, with nothing started. It needs no constructor, no folder and no runner — it is the rung the doubles ladder opens on, and the one every other chapter measures itself against.

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

```
src/domain/posts/
├── ranking.ts
├── ranking.test.ts          # the module's spec — the `.test.ts` suffix IS the kind
└── ranking.fixtures.ts      # the payloads it feeds itself, if any
```

The suffix decides which project collects the file and therefore which rules judge it. `unit()` takes `**/*.test.ts` outside `specs/` and excludes `**/*.test.tsx`; a `.test.ts` UNDER `specs/<facet>/` is rule C12's error, with the fix "rename it `.spec.ts`", and a rendered thing in a `.test.ts` is rule G4's, with the fix "rename it `.test.tsx`" ([07 — Component specs](07-component.md)).

Nothing in this kind is slow, so the `unit` project is the one every developer runs on every save: this package gates its own at twelve seconds ([03 — Testing](03-testing.md#the-seven-projects)).

## The constructor: there is none

Every facet below this chapter starts something — a server, a database, a binary, a browser, a simulator — so every one of them has a `*.specification.ts` holding what was started. A module starts nothing. This kind has no folder under `specs/` at all — no specification file, and no project helper to configure beyond `unit()`.

That is the fork's whole criterion, and it runs both ways: the moment a test needs a real service, a real binary or a real screen, it is no longer this kind, and the chapter that owns it says which one it became ([18 — Conventions § The fork](18-conventions.md#the-fork--which-kind-of-test-this-is)).

## The chain: there is none either

A module test is plain vitest: `test`, `expect`, the native matchers. What the framework adds are four primitives it may reach for by name — and each of them is a scope that gives back what it took.

```typescript
import { clock } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { twoPosts } from './ranking.fixtures.js';
import { rank } from './ranking.js';

test('ranks a fresher post above an older one of equal score', () => {
    // Given - two posts of equal score, one written this morning
    using _ = clock.at('2026-03-04T09:30:00Z');

    // Then - the fresher one leads
    expect(rank(twoPosts).map((post) => post.id)).toStrictEqual(['fresh', 'stale']);
});
```

## What it may and may not do

The table is the rule set, and every row names the rule that holds it ([19 — Linting](19-linting.md)).

| May                                                                                                                            | May not                                                                                                                                 | Rule         |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| import its module and pure helpers; a sibling `<file>.fixtures.ts`                                                             | import a data asset (`.json` / `.txt` / `.sql` / `.yaml`); keep a `__mocks__/` or `__fixtures__/` directory                             | I4           |
| `mockOf<Port>()` / `mockOf<Port>({ deep: false })` for an injected interface; `vi.fn<Fn>()`; `vi.spyOn` on an object passed in | `vi.mock` / `vi.doMock`, except a specifier on the consumer's `modules` allow-list with the reason written beside it                    | I4           |
| `await using _ = await intercept(http.get(url), http.json(…))`                                                                 | `vi.stubGlobal('fetch')`, `msw/node`, `nock`                                                                                            | M3, F6       |
| `using _ = clock.at('2026-03-04T09:30:00Z')`; `using _ = clock.run()`; `await clock.advance(ms)`                               | `Date.now()`, zero-argument `new Date()`, `Math.random()`, `randomUUID()` reaching an oracle; `vi.useFakeTimers` / `vi.setSystemTime`   | D16/D16w, M3 |
| `vi.stubEnv('X', 'y')` for a module whose contract IS an env read — it restores itself                                         | `process.env.X = …`, a raw assignment nothing gives back                                                                                | E9w          |
| flat `test()`; one level of `describe` for grouping; a `test.each` table (B4 judges the table once, not once per row)          | a nested `describe`; a `beforeEach` / `beforeAll` that builds the Given                                                                 | J10, J6w     |
| `expect(text(value)).toContain(…)`; `toStrictEqual` against a literal                                                          | a golden (`toMatch('<file>')`) — a module with a golden is an integration spec ([06](06-integration.md)); any `toMatchSnapshot` matcher | D20          |
| —                                                                                                                              | `document` / `window` / `navigator`; `@vitest-environment happy-dom`; `react-dom/server`                                                | G4, E5, F6   |

A module that fetches a RELATIVE url is browser code and cannot run under node as it stands: either state where it resolves (`intercept(contracts, { origin })`, below) or specify it where it renders — a component spec.

### Doubles

`mockOf<Port>()` is the fourth rung of the ladder and the only one a module test builds itself. It is deep by default: reading a member nobody stubbed hands back another double, however far the port nests. `{ deep: false }` gives the flat proxy — every member of the port and nothing beneath them, which is what a port with a nested namespace wants when the test only ever touches the first level.

```typescript
const gateway = mockOf<PaymentGateway>();
const settings = mockOf<Settings>({ deep: false });
const onDone = vi.fn<() => void>();
```

Everything else the ladder refuses is refused here by name: `vi.mock` doubles a module for everyone, so it is I4's error unless a native module a consumer cannot inject earns an allow-list entry with its reason; `vi.stubGlobal` is the network replaced by a function the test wrote, so it is M3's ([18 — Conventions § The doubles ladder](18-conventions.md#the-doubles-ladder)).

### `intercept()` — the network, declared, with no chain

A module that reaches the network states what it expects to find there, in the same contract vocabulary every facet uses. The scope is asynchronous and disposes asynchronously, so the canonical spelling carries **two** awaits: `await using` does not await its initializer, and the one-await form would race the real network.

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

A subject that calls `fetch('/api/posts')` has no origin to resolve against under node, and msw refuses the relative url. State the base the page would have given it:

```typescript
await using _ = await intercept(contracts, { origin: 'http://console.test' });
```

`origin` rewrites every RELATIVE request against that base for the life of the scope, and restores `fetch` when the scope ends. It must be an absolute url; anything else is refused at the call with a message saying so. An absolute request in the subject is untouched.

An empty contract list is refused by design: "this subject makes no network call" is said with `http.unreachable()` on every feed it could have reached, not with an intercept that guards nothing. Everything about the contracts themselves — selection, `times`, `required`, the facades, the streams — is [16 — Contracts](16-contracts.md)'s.

### Time

`clock.at(iso)` pins `Date` and nothing else, so a subject that awaits, polls or renders keeps running. `clock.run(iso?)` takes the scheduler too — `setTimeout` and friends queue instead of firing — and `await clock.advance(ms)` is what makes them due; that is the one primitive for a subject whose behaviour IS elapsed time (a debounce, a retry backoff), where waiting for real would be the arbitrary sleep J2 forbids. One clock per test: a second scope taken inside the first is refused rather than nested, because ending the inner one would silently end the outer one too.

### Fixtures

A payload a module test feeds itself lives in a sibling `<file>.fixtures.ts` — TypeScript, type-checked with the test, reviewed in the same diff. A `.json` beside a module test is I4's error: an asset the compiler never reads is a second source of truth, and the kind that legitimately owns assets is the one that has a folder for them.

### Tables

`test.each` is the form for a rule with many cases, and B4 judges the table ONCE — the Given/Then narration is written on the table, not repeated in every row.

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

There is no result object here, because there is no chain to hand one back. The subject is the module's own return value, its thrown error, or a call recorded on a port double — and those are vitest's native matchers' to judge ([14 — Assertions](14-assertions.md#scalars--native-expect)). `text(value)` is the one helper that borrows the framework's stream vocabulary for a plain string.

## Unique here

- **It is the only kind with no folder.** Every other kind is collected by a path (`specs/<facet>/`); this one is collected by a suffix, beside what it specifies. Moving a module test away from its module is C18's error in one direction and C12's in the other.
- **It is the only kind that may build its own double.** Below this chapter a double is DECLARED — a contract, a service, a seeded row — because the subject is an assembled product and the test does not hold its wiring. A module test is handed the wiring, so `mockOf` is in its hands.
- **It is the only kind with no golden.** A golden is a file, and a file beside a module test is an asset; a module whose answer deserves a golden is describing something assembled, and the integration facet is where that goes ([06](06-integration.md#the-golden-half--a-pure-module-no-services-at-all)).
- **It is the kind the budget is written for.** The `unit` project is the fast one, and this package gates its own at twelve seconds so the loop stays a loop.

## Pitfalls

- **Reaching for `vi.mock` to avoid injecting a port.** The mock outlives the test's intent: every importer of that specifier gets the double, and the design pressure the injection would have applied is gone. Double the port.
- **A single `await` on `intercept()`.** `await using _ = intercept(…)` does not await the initializer, so the subject races the real network and the failure is a flake, not a diff. Write both awaits.
- **`vi.setSystemTime` instead of `clock`.** A fake timer taken without `using` outlasts the test that took it, and the next test in the file inherits a clock nobody declared. M3 refuses it and names the primitive.
- **Importing a `.json` payload.** I4 refuses it. Put the payload in `<file>.fixtures.ts`, where the compiler reads it.
- **Nesting `describe`.** One level groups; two describe a structure the test file does not have. J10 refuses the second.
- **Asserting on a DOM.** There is no document here, and there will not be one: G4 refuses the globals, E5 refuses the `@vitest-environment` comment that would conjure them, and the route is a `.test.tsx` in a real browser.
- **Letting the Given drift into `beforeEach`.** A Given nobody can read in the test is a Given nobody maintains. J6w says so.

## Related

[02 — Developing](02-developing.md) · [03 — Testing](03-testing.md) · [06 — Integration specs](06-integration.md) · [07 — Component specs](07-component.md) · [14 — Assertions](14-assertions.md) · [15 — Tokens](15-tokens.md) · [16 — Contracts](16-contracts.md) · [18 — Conventions](18-conventions.md) · [19 — Linting](19-linting.md)
