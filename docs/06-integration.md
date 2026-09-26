# 06 — Integration specs: a module against the real thing

`specification.integration()` specifies a MODULE — not an entry. No HTTP, no binary, no page: the subject is a function, and it is called. What makes it a spec rather than a module test beside its code is what it stands on — a real database, a declared stub, a golden — and that is exactly the fork this facet closes.

```typescript
// specs/integration/integration.specification.ts
import { postgres, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, integration } = await specification.integration({
    services: { db: postgres() },
});

afterAll(cleanup);
```

```typescript
// specs/integration/orders/orders.spec.ts
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { listOrders } from '../../../src/orders/orders.js';
import { integration } from '../integration.specification.js';

describe('orders', () => {
    test('reads the orders the day left behind', async () => {
        // Given - two orders in the real database, from the seed beside the test
        const result = await integration
            .seed(file('./seeds/two-orders.sql'))
            .call(async ({ db }) => await listOrders(db.connectionString));

        // Then - the module answered with both, compared whole
        expect(result.value).toMatch([
            { id: 1, reference: 'ORD-1', total: 42 },
            { id: 2, reference: 'ORD-2', total: 108 },
        ]);
    });
});
```

## What it specifies

Three questions decide, in order ([18 — Conventions](18-conventions.md)):

1. Does the subject answer HTTP, run as a binary, render a page or a screen? Then it is that facet's, not this one.
2. Does it need a real service — a database, a cache, a process — or is its oracle a GOLDEN file? Then it is an integration spec.
3. Otherwise it is a module test, `<file>.test.ts` beside `<file>.ts`, with no runner at all.

The second question has two halves and both land here: a module on a real service, and a module whose oracle is a golden. Why a facet, and what was weighed: [ADR-004](decisions/004-a-module-against-real-services-or-a-golden-is-the-integration-facet.md).

## The constructor

| Option     | Means                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `services` | the named record the module is specified against — `postgres()`, `redis()`, `sqlite()`, `process()`. Omit it for the golden-only half |
| `root`     | project-root override (rule `no-redundant-root`), auto-discovered from the calling file                                               |

The handle is `{ integration, cleanup }`, destructured with those names (rule `no-runner-alias`) and cleaned up with `afterAll(cleanup)` (rule `cleanup-passed-to-after-all`).

## The chain

Setups: `.seed()`, `.intercept()`, `.clock()`, and `integration.with({ clock })` — a view whose every chain starts at the instant the whole file shares ([18](18-conventions.md#what-a-file-shares)). Terminal action: `.call(subject)` (rule `disk-named-by-relative-path`).

| Setup                             | Means                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.seed(file('./seeds/rows.sql'))` | run that `.sql` file, named from the spec file, before the call; `{ database }` targets one of several |
| `.intercept(stubs)`               | declare what the outside world replies ([16](16-stubs.md))                                             |
| `.clock('2026-03-04T09:30:00Z')`  | pin the module's `Date` for this chain ([18](18-conventions.md#time--one-primitive-two-depths))        |

`.call(subject)` hands the STARTED services record to the subject, so the module is built with the real connection strings rather than with a double:

```typescript
const result = await integration.call(async ({ db }) => await listOrders(db.connectionString));
```

Databases reset at the start of every chain, exactly as on api and job (rules `one-terminal-action-per-chain`, `sequence-expressed-by-seeding`): one spec is one call, and no spec depends on a previous one.

## The result

Two readings, never both.

| Accessor         | Is                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `result.value`   | what the call RETURNED — a `TextAccessor` for a string, a `JsonAccessor<T>` for anything else, the union of both for a `T` that may be either |
| `result.error`   | what it THREW, as text: an `Error`'s message, or the value itself. Empty when it returned                                                     |
| `result.table()` | a table of a declared database, for row-level assertions                                                                                      |

A refusal is a reading, never a `try`/`catch`:

```typescript
test('refuses an order that is not one', async () => {
    // Given - the module asked to record an order worth nothing
    const result = await integration.call(
        async ({ db }) => await placeOrder(db.connectionString, { reference: 'ORD-4', total: 0 }),
    );

    // Then - what it threw is the reading, and nothing was written
    expect(result.error).toMatch('an order of 0 is not an order — reference ORD-4');
    await expect(result.table('orders')).toBeEmpty();
});
```

That is what keeps a spec of a refusal the same size as a spec of a success, and what stops an "it should throw" spec from passing when nothing throws at all — `expect(result.error.text).toBe('')` is how a chain says "and it did not refuse": `result.error` is empty rather than absent when the call returned, so the empty text is the whole answer.

`.call<T>()` carries `T` through to the result, so one field can be read where one field is what the spec means — `expect(result.value.value.ok).toBe(true)` for JSON, `result.value.text` for a string — beside the comparison of the whole value, never instead of it (rule `result-compared-whole`).

**The accessor follows the value, and the type says so.** A subject typed exactly `string` reads as a `TextAccessor`; one that can never be a string reads as a `JsonAccessor<T>`; one that MAY be a string (`string | undefined`, `string | number`) is typed as the union of the two, and the spec narrows it — because only the value in hand decides, and a type that guessed handed back a `JsonAccessor` whose `.value` was silently `undefined` while the runtime had built a `TextAccessor`.

**What crosses is JSON, not the object.** A non-string value is serialised, so a `Map`, a `Set`, a `Date` or a class instance arrives as the plain JSON it serialises to — `{}`, `{}`, an ISO string, an object of its own fields — while `T` still claims the original type. A call whose answer is one of those projects it to plain data INSIDE the call, where the projection is visible:

```typescript
// the Map is projected where the spec can see it, not silently at the seam
const result = await integration.call(async () => Object.fromEntries(await loadIndex()));
```

Both accessors are the package's ordinary subjects, compared whole: to the value written in place — `toMatch({ … })` for a json, `toMatch('…')` for a text — or to `file('./expected/<name>.json')` when several tests share it; the `{{token}}` grammar for what moves, `{ frozen }`, and `TEST_UPDATE=1`, which writes the value into the test ([15](15-tokens.md), [14](14-assertions.md)).

A call that a declared stub never accepted fails the CHAIN rather than becoming `result.error`: a refusal the module chose is the subject's behaviour, an undeclared outgoing call is the spec's own mistake (rule `network-strict-after-first-stub`).

## Unique here

### The golden half — a pure module, no services at all

`specification.integration()` with no options is the pure-module runner: nothing starts, and what earns the folder is the golden.

```typescript
export const { cleanup, integration } = await specification.integration();
```

A table of cases is one `.call()` inside `test.each`, which is what turns fifty-three hand-paired fixture files into one spec:

```typescript
test.each(CASES)('renders $name', async ({ name, input }) => {
    // Given - one case of the table
    const result = await integration.call(() => render(input));

    // Then - the golden for that case
    expect(result.value).toMatch(file(`./expected/${name}.json`));
    expect(result.error.text).toBe('');
});
```

The golden is named by a template literal, and the checker's `no-unused-ground` dead-fixture pass reads that form: a golden whose name matches the literal's static ends is one the table could have asked for, so a wall of `expected/` files stays alive without a hand-written literal each.

### The `integration()` project

`integration()` from `@jterrazz/test/vitest` is the canonical project: it collects `specs/integration/**/*.spec.ts`, carries the preset's budgets and artefact directory, and runs in group 0 with the other node facets.

```typescript
import { defineSpecConfig, integration, unit } from '@jterrazz/test/vitest';

export default defineSpecConfig({ test: { projects: [unit(), integration()] } });
```

An env-gated sub-suite is an option, not a second project — the whole point of `{ include, exclude, timeout }`:

```typescript
integration({
    exclude: process.env.E2E_NETWORK ? [] : ['specs/integration/network/**'],
});
```

### Folder layout

```
specs/integration/
├── integration.specification.ts   # the runner, at the facet root
├── pure.specification.ts          # a second runner: no services, goldens only
└── orders/                        # a domain
    ├── orders.spec.ts             # under specs/, the suffix is .spec.ts (rule `file-suffix-matches-place`)
    ├── seeds/two-orders.sql       # ground: database state — beside its one test, or the tests of the leaf that share it
    └── expected/                  # ground: a golden several tests share — one test's is written in place (`ground-shared-or-inline`)
```

**`required` is verified per `.call()`.** A chain's scope is ONE terminal action: the stubs it declared are checked when that call ends, and a stub declared `required` that was never requested fails there. A second `.call()` is a second chain with a second verification — it does not inherit the first's obligations.

## Pitfalls

- **Reaching for `try`/`catch`.** A thrown error is `result.error`. A `try` around `.call()` brings back the shape where a spec passes because nothing threw.
- **Writing a module test here.** A module alone, with no service and no golden, belongs beside its code as `<file>.test.ts` (rule `test-beside-its-module`). The folder is not a home for tests that were hard to place.
- **Goldening a volatile value.** An id, a timestamp or a duration inside `result.value` is tokened (`{{int}}`, `{{iso8601}}`), or pinned with `.clock()`. A literal that moves is a test that fails tomorrow (rule `no-sampled-value-in-expectation`).
- **Asserting on a double.** The facet exists so the subject meets the real thing. A `mockOf<T>()` inside `.call()` is a module test that started a container for nothing.

## Related

[10 — API specs](10-api.md) · [14 — Assertions](14-assertions.md) · [16 — Stubs](16-stubs.md) · [17 — Services](17-services.md) · [18 — Conventions](18-conventions.md)
