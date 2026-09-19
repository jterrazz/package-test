# 17 — Integration specs: a module against the real thing

`specification.integration()` specifies a MODULE — not an entry. No HTTP, no binary, no page: the subject is a function, and it is called. What makes it a spec rather than a module test beside its code is what it stands on — a real database, a declared contract, a golden file — and that is exactly the fork this facet closes.

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
// specs/integration/orders/orders.test.ts
import { expect, test } from 'vitest';

import { listOrders } from '../../../src/orders/orders.js';
import { integration } from '../integration.specification.js';

test('reads the orders the day left behind', async () => {
    // Given - two orders in the real database
    const result = await integration
        .seed('two-orders.sql')
        .call(async ({ db }) => await listOrders(db.connectionString));

    // Then - the module answered with both
    expect(result.value).toMatch('two-orders.json');
});
```

## Which tests belong here

Three questions decide, in order ([12 — Conventions](12-conventions.md)):

1. Does the subject answer HTTP, run as a binary, render a page or a screen? Then it is that facet's, not this one.
2. Does it need a real service — a database, a cache, a process — or is its oracle a GOLDEN file? Then it is an integration spec.
3. Otherwise it is a module test, `<file>.test.ts` beside `<file>.ts`, with no runner at all.

The second question has two halves and both land here. A module against real infrastructure was, before this facet, a `specs/` folder running plain vitest with a hand-built sqlite template and a `beforeAll` starting a container. A module whose oracle is a golden was a `toMatchSnapshot` — a second golden mechanism beside the one the package owns. Neither needed a new idea; both needed a constructor.

## The constructor

| Option     | Means                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `services` | the named record the module is specified against — `postgres()`, `redis()`, `sqlite()`, `process()`. Omit it for the golden-only half |
| `root`     | project-root override (rule A9), auto-discovered from the calling file                                                                |

The handle is `{ integration, cleanup }`, destructured with those names (rule A3) and cleaned up with `afterAll(cleanup)` (rule A4).

## The chain

Setups: `.seed()`, `.intercept()`, `.clock()`. Terminal action: `.call(subject)` (rule B2).

| Setup                            | Means                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.seed('rows.sql')`              | run `_seeds/rows.sql` before the call; `{ database }` targets one of several                    |
| `.intercept(contracts)`          | declare what the outside world replies ([10](10-contracts.md))                                  |
| `.clock('2026-03-04T09:30:00Z')` | pin the module's `Date` for this chain ([12](12-conventions.md#time--one-primitive-two-depths)) |

`.call(subject)` hands the STARTED services record to the subject, so the module is built with the real connection strings rather than with a double:

```typescript
const result = await integration.call(async ({ db }) => await listOrders(db.connectionString));
```

Databases reset at the start of every chain, exactly as on api and jobs (rules B1, B7): one spec is one call, and no spec depends on a previous one.

## The result — `CallResult`

Two readings, never both.

| Accessor         | Is                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `result.value`   | what the call RETURNED — a `TextAccessor` for a string, a `JsonAccessor<T>` for anything else, where `T` is what `.call<T>()` returned |
| `result.error`   | what it THREW, as text: an `Error`'s message, or the value itself. Empty when it returned                                              |
| `result.table()` | a table of a declared database, for row-level assertions                                                                               |

A refusal is a reading, never a `try`/`catch`:

```typescript
test('refuses an order that is not one', async () => {
    // Given - the module asked to record an order worth nothing
    const result = await integration.call(
        async ({ db }) => await placeOrder(db.connectionString, { reference: 'ORD-4', total: 0 }),
    );

    // Then - what it threw is the reading, and nothing was written
    expect(result.error).toMatch('refused.txt');
    await expect(result.table('orders')).toBeEmpty();
});
```

That is what keeps a spec of a refusal the same size as a spec of a success, and what stops an "it should throw" spec from passing when nothing throws at all — `await expect(result.error).toBeEmpty()` is how a chain says "and it did not refuse". The `await` is not optional: `toBeEmpty` answers a promise on every subject it takes, a dropped one passes the test while the real failure surfaces as an unhandled rejection, and rule D2 refuses the bare form.

`.call<T>()` carries `T` through to the result, so one field is read where one field is what the spec means — `expect(result.value.value.ok).toBe(true)` for JSON, `result.value.text` for a string — and a golden file is kept for what a golden file is for: a shape worth freezing whole.

Both accessors are the package's ordinary subjects, so the golden mechanism reaches them whole: `toMatch('<name>.json'|'<name>.txt')` under `_expected/`, the `{{token}}` grammar for what moves, `{ frozen }`, and `TEST_UPDATE=1` ([09](09-tokens.md), [08](08-assertions.md)).

A call that a declared contract never accepted fails the CHAIN rather than becoming `result.error`: a refusal the module chose is the subject's behaviour, an undeclared outgoing call is the spec's own mistake (rule D7).

## Without services — the golden half

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
    expect(result.value).toMatch(`${name}.json`);
    await expect(result.error).toBeEmpty();
});
```

The golden is named by a template literal, and the checker's C9 dead-fixture pass reads that form: a fixture whose name matches the literal's static ends is one the table could have asked for, so a wall of `_expected/` files stays alive without a hand-written literal each.

## The project

`integration()` from `@jterrazz/test/vitest` is the canonical project: it collects `specs/integration/**/*.test.ts`, carries the preset's budgets and artefact directory, and runs in group 0 with the other node facets.

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

## Folder layout

```
specs/integration/
├── integration.specification.ts   # the runner, at the facet root
├── pure.specification.ts          # a second runner: no services, goldens only
└── orders/                        # a domain
    ├── orders.test.ts
    ├── _seeds/two-orders.sql      # ground: database state
    └── _expected/                 # ground: every expected fixture, flat
```

## Pitfalls

- **Reaching for `try`/`catch`.** A thrown error is `result.error`. A `try` around `.call()` brings back the shape where a spec passes because nothing threw.
- **Writing a module test here.** A module alone, with no service and no golden, belongs beside its code as `<file>.test.ts` (rule I2). The folder is not a home for tests that were hard to place.
- **Goldening a volatile value.** An id, a timestamp or a duration inside `result.value` is tokened (`{{int}}`, `{{iso8601}}`), or pinned with `.clock()`. A literal that moves is a test that fails tomorrow (rule D16).
- **Asserting on a double.** The facet exists so the subject meets the real thing. A `mockOf<T>()` inside `.call()` is a module test that started a container for nothing.

## Related

[05 — API specs](05-api.md) · [08 — Assertions](08-assertions.md) · [10 — Contracts](10-contracts.md) · [11 — Services](11-services.md) · [12 — Conventions](12-conventions.md)
