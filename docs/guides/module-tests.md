# Module tests (`__tests__/*.test.ts`, in the module's folder)

A module test is plain vitest: one source file, called through its own exports, with nothing started. It needs no constructor, no runner and no folder under `specs/` — it sits in the `__tests__/` of the folder of the module it covers, as `__tests__/<file>.test.ts`.

It is also the exception. A behaviour a user relies on is tested end to end, through the surface the user meets; a module test is kept for a pure algorithm whose edge cases are cheaper at its own level, or for a failure no end-to-end path can provoke ([Conventions § Which test earns its place](../concepts/conventions.md#which-test-earns-its-place)).

## What it specifies

A module test answers one question: **given these inputs and these ports, what does this module return, and what does it ask of its collaborators?** Its subject is a unit of code, so it sits with that code, in the conventional folder of its folder (`test-in-its-tests-folder`):

```text
src/domain/posts/
├── ranking.ts
└── __tests__/
    ├── ranking.test.ts      # the module's spec — the `.test.ts` suffix IS the kind
    └── ranking.fixtures.ts  # the payloads it feeds itself, if any
```

A test in a `__tests__/` names a module of the folder above it, and imports it one folder up (`../ranking.js`); a module test anywhere else is refused, the fix naming the `__tests__/` it moves to. `__tests__/` is the one special folder a code root holds. The ground its tests stand on sits inside it — `__tests__/__expected__/`, `__tests__/__fixtures__/` — and is judged as a specification's: a short golden one test alone reads belongs in that test (`ground-shared-or-inline`), and an entry no test of the folder names is dead (`no-unused-ground`). The suffix decides which project collects the file and therefore which rules judge it. `unit()` takes `**/*.test.ts` outside `specs/` and excludes `**/*.test.tsx`; a `.test.ts` UNDER `specs/<specification>/` is rule `file-suffix-matches-place`'s error, with the fix "rename it `.spec.ts`", and a rendered thing in a `.test.ts` is rule `no-dom-in-module-test`'s, with the fix "rename it `.test.tsx`" ([Component specs](component-specs.md)).

Nothing in this kind is slow, so the `unit` project is the one a developer runs on every save.

## The constructor: there is none

Every other kind starts something — a server, a database, a binary, a browser, a simulator — and keeps it in a `*.specification.ts`. A module starts nothing, so there is no specification file and no project to configure beyond `unit()`.

The moment a test needs a real service, a real binary or a real screen, it is no longer this kind; [the fork](../start/getting-started.md#which-kind-of-test) says which one it became.

## The chain: there is none either

A module test is `test`, `expect` and vitest's own matchers. The framework adds four primitives — `mockOf()`, `intercept()`, `clock` and `text()` — and the two that touch shared state, `intercept()` and `clock`, are scopes that give back what they took.

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

The `describe` is titled `rank` because `rank` is what `ranking.ts` exports: a module test names its subject, the export it is about, where a spec names its aspect. When a module exports several values, which one answers is [`one-describe-per-file`'s row](../reference/linting.md#one-describe-per-file), and `typescript fix` writes the title it reads.

## What it may and may not do

The table is the rule set, and every row names the rule that holds it, where one does ([Linting § The rule catalogue](../reference/linting.md#the-rule-catalogue)).

| May                                                                                                                                                                                                                  | May not                                                                                                                                                                              | Rule                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| import its module and pure helpers; a `<file>.fixtures.ts` beside it                                                                                                                                                 | import a data asset (`.json` / `.txt` / `.sql` / `.yaml`); keep a `__mocks__/` directory                                                                                             | `no-module-mock`                                                                               |
| `mockOf<Port>()` / `mockOf<Port>({ deep: false })` for an injected interface; `vi.fn<Fn>()`; `vi.spyOn` on an object passed in                                                                                       | `vi.mock` / `vi.doMock`, except a specifier on the consumer's `modules` allow-list, written `{ module, reason }`                                                                     | `no-module-mock`                                                                               |
| `await using _ = await intercept(http.get(url), http.json(…))`                                                                                                                                                       | `vi.stubGlobal('fetch')`, `msw/node`, `nock`                                                                                                                                         | `no-vitest-time-or-global-stub`, `no-second-test-runtime`                                      |
| `using _ = clock.at('2026-03-04T09:30:00Z')`; `using _ = clock.run()`; `await clock.advance(ms)`                                                                                                                     | `Date.now()`, zero-argument `new Date()`, `Math.random()`, `randomUUID()` reaching an oracle; `vi.useFakeTimers` / `vi.setSystemTime`                                                | `no-sampled-value-in-expectation`, `no-sampled-value-in-test`, `no-vitest-time-or-global-stub` |
| `vi.stubEnv('X', 'y')` for a module whose stub IS an env read — it restores itself                                                                                                                                   | `process.env.X = …`, a raw assignment nothing gives back                                                                                                                             | `no-raw-env-write`                                                                             |
| one top-level `describe` titled with the subject — the module's export, `describe('rank', …)` — every test inside it; a `test.each` table (`given-and-then-markers-present` judges the table once, not once per row) | a nested `describe`; a second `describe`, or a test beside it; a `beforeEach` / `beforeAll` that builds the Given                                                                    | `one-describe-per-file`, `one-describe-level`, `given-in-the-test`                             |
| `expect(text(value).text).toContain(…)`; `toStrictEqual` against a literal                                                                                                                                           | a golden (`toMatch(file(…))`) — a module with a golden is an integration spec ([Integration specs](integration-specs.md)), a convention no rule holds; any `toMatchSnapshot` matcher | `no-vitest-snapshot`                                                                           |
| —                                                                                                                                                                                                                    | `document` / `window` / `navigator`; `@vitest-environment happy-dom`; `react-dom/server`                                                                                             | `no-dom-in-module-test`, `no-simulated-dom`, `no-second-test-runtime`                          |

A module that fetches a RELATIVE url is browser code and cannot run under node as it stands: either state where it resolves (`intercept(stubs, { origin })`, below) or specify it where it renders — a component spec.

### Doubles

`mockOf<Port>()` doubles an injected interface and `vi.fn<Fn>()` a function; a module test is the only kind that builds its own double. Both, and the ladder that says when a double is the right tool, are [Time and doubles](../reference/time-and-doubles.md#doubles).

### `intercept()` — the network, declared, with no chain

A module that reaches the network states what it expects to find there, in the same stub vocabulary every specification uses — the same double, with no chain to hang it on.

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

The two awaits, `{ origin }` for a subject that calls a RELATIVE url, the refusal of an empty stub list, and everything about the stubs themselves — selection, `times`, `required`, the facades, the streams — are [Stubs § `intercept()`](../reference/stubs.md#intercept--the-same-double-with-no-chain)'s.

### Time

`using _ = clock.at(iso)` pins `Date` for the scope; `clock.run()` and `await clock.advance(ms)` take the timers too, for a subject whose behaviour is elapsed time — [Time and doubles § The clock](../reference/time-and-doubles.md#the-clock).

### Fixtures

A payload a module test feeds itself lives in a `<file>.fixtures.ts` beside it in the `__tests__/` — TypeScript, type-checked with the test, reviewed in the same diff. A `.json` a module test imports is `no-module-mock`'s error: an asset the compiler never reads is a second source of truth, and the kind that legitimately owns assets is the one that has a folder for them.

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

There is no result object here, because there is no chain to hand one back. The subject is the module's own return value, its thrown error, or a call recorded on a port double — and those are vitest's native matchers' to judge ([Assertions](../reference/assertions.md#scalars--native-expect)). `text(value)` is the one helper that borrows the framework's stream vocabulary for a plain string.

## Unique here

- **It is the only kind with no folder.** Every other kind is collected by a path (`specs/<specification>/`); this one is collected by a suffix, in the `__tests__/` of what it specifies. Moving a module test away from its module is `specification-test-uses-its-runner`'s error in one direction and `file-suffix-matches-place`'s in the other.
- **It is the only kind that may build its own double.** In every other kind a double is DECLARED — a stub, a service, a seeded row — because the subject is an assembled product and the test does not hold its wiring. A module test is handed the wiring, so `mockOf` is in its hands.
- **It is the only kind with no golden.** A golden is a file, and a file a module test imports is an asset; a module whose answer deserves a golden is describing something assembled, and the integration specification is where that goes ([Integration specs](integration-specs.md#the-golden-half--a-pure-module-no-services-at-all)).

## Pitfalls

- **Reaching for `vi.mock` to avoid injecting a port.** The mock outlives the test's intent: every importer of that specifier gets the double, and the design pressure the injection would have applied is gone. Double the port.
- **`vi.setSystemTime` instead of `clock`.** `no-vitest-time-or-global-stub` refuses it — [Time and doubles § The clock](../reference/time-and-doubles.md#the-clock).
- **Importing a `.json` payload.** `no-module-mock` refuses it. Put the payload in `<file>.fixtures.ts`, where the compiler reads it.
- **Nesting `describe`.** The one level is THE describe, titled with the subject, holding every test ([Conventions § One file, one subject](../concepts/conventions.md#one-file-one-subject)); a second level describes a structure the test file does not have. `one-describe-per-file` refuses a file with no describe or two, `one-describe-level` the nesting.
- **Asserting on a DOM.** There is no document here, and there will not be one: `no-dom-in-module-test` refuses the globals, `no-simulated-dom` refuses the `@vitest-environment` comment that would conjure them, and the route is a `.test.tsx` in a real browser.
- **Letting the Given drift into `beforeEach`.** A Given nobody can read in the test is a Given nobody maintains. `given-in-the-test` says so.

## Related

[Getting started](../start/getting-started.md) · [Integration specs](integration-specs.md) · [Component specs](component-specs.md) · [Stubs](../reference/stubs.md) · [Time and doubles](../reference/time-and-doubles.md) · [Assertions](../reference/assertions.md) · [Conventions](../concepts/conventions.md)
