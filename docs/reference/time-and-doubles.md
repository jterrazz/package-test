# Time and doubles

Two things around a subject are neither a service nor the network: the time it reads, and a collaborator it is handed. This page covers `clock`, which pins time, and `mockOf()`, which doubles an injected port — and the doubles ladder, which says when a double is the right tool at all.

## The clock

A value a test samples — `Date.now()`, `new Date()`, `Math.random()`, `randomUUID()` — is different on every run, so it never reaches an expectation (rule `no-sampled-value-in-expectation`). Time is the one of those the framework pins for you, and `clock` is the whole vocabulary:

```typescript
import { clock } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

function issueReceipt(total: number): { issuedAt: string; total: number } {
    return { issuedAt: new Date().toISOString(), total };
}

describe('issueReceipt', () => {
    test('stamps the moment the receipt was issued', () => {
        // Given - the calendar pinned for this scope
        using _ = clock.at('2026-03-04T09:30:00Z');

        // Then - the stamp is the stated instant
        expect(issueReceipt(42)).toEqual({ issuedAt: '2026-03-04T09:30:00.000Z', total: 42 });
    });
});
```

The expectation compares what the subject returned, and the instant is a value the test wrote. A test that pins the clock may also read `new Date()` itself, since under the pin that reading is the constant it chose, but such a test checks the clock rather than the subject.

| Form                | Pins                           | For                                                                         |
| ------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| `clock.at(iso)`     | the calendar (`Date`)          | a subject that reads the time — a stamp, an expiry, a greeting              |
| `clock.run(iso?)`   | the calendar and the scheduler | a subject whose behaviour is elapsed time — a debounce, a backoff, a poll   |
| `clock.advance(ms)` | —                              | moving the pinned clock on; under `run()`, firing every timer that came due |

**`at()` leaves timers running.** Promises, renders and the framework's own polling keep working, because only `Date` is pinned. **`run()` queues timers instead**, so `setTimeout` and friends fire only when `await clock.advance(ms)` makes them due. That is how a test proves a five-second backoff without waiting five seconds — and without the arbitrary sleep rule `no-sleep` forbids.

**Both are scopes.** `using _ = clock.at(…)` gives the real clock back when the scope ends, however it ends. `vi.useFakeTimers()` and `vi.setSystemTime()` are what this replaces: each owns a teardown a test will one day forget, and rule `no-vitest-time-or-global-stub` refuses them, naming `clock`.

**One clock per test.** A second scope taken inside the first is refused rather than nested: ending the inner one would end the outer one too, since the only state vitest's timers can give back is the real clock. `clock.advance()` with no clock pinned is refused, and so is an instant `Date` cannot read. An instant is an ISO-8601 string, `'2026-03-04T09:30:00Z'`.

A `beforeEach`/`afterEach` pair can hold the scope by hand while a suite migrates:

```typescript
let pinned: Disposable;
beforeEach(() => {
    pinned = clock.at('2026-03-04T09:30:00Z');
});
afterEach(() => {
    pinned[Symbol.dispose]();
});
```

It works, and it is a stopover: `using _ = clock.at(…)` inside the test puts the instant where the test that needs it is read.

### `.clock()` on a chain

A chain pins the same instant for its own action with `.clock(iso)`, released when the action resolves:

| On                          | Pins                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `api`, `job`, `integration` | the `Date` the app, the job or the module reads — they share the test's process                                                    |
| `component`                 | the page's `Date`, and nothing else: faking a page's timers would stop React's scheduler                                           |
| `website` (`.visit()` only) | the page's calendar, before its first byte is parsed. A `.fetch()` opens no page and refuses the pairing                           |
| `cli`                       | nothing — a binary is another process. Its instant travels through its own env (`TZ`), or the golden absorbs it with `{{iso8601}}` |

A file whose chains all share one instant states it once, on a view: `const morning = api.with({ clock: '2026-03-04T09:30:00Z' })` — [Conventions § What a file shares](../concepts/conventions.md#what-a-file-shares). A chain whose clock is refused leaves nothing armed: the stubs it armed before the clock are released with the refusal.

## Doubles

### The doubles ladder

When a subject needs something it does not own, take the FIRST rung that fits. The list is closed: nothing below the fourth rung is a rung.

1. **The real thing**, in the test's process — a pure module, a Hono app handed to `server`, a component mounted in a real Chromium.
2. **A declared service** — `sqlite()`, `postgres()`, `redis()`, `process()` ([Services](services.md)): real, isolated per worker, reset at the start of every chain.
3. **A stub** — `.intercept()` on a chain, or `intercept()` around module code ([Stubs](stubs.md)). Strict from the first stub: a request no stub answers fails the test.
4. **A typed port double** — `mockOf<Port>()` for an injected interface, `vi.fn<Fn>()` for a function. Asserting a call on one is a boundary observation; asserting only on doubles the test built proves nothing.

**Off the ladder**, each with where to go instead:

| Instead of                                       | Use                                           |
| ------------------------------------------------ | --------------------------------------------- |
| `vi.stubGlobal('fetch')`, `msw`, `nock`, `sinon` | `intercept()` or `.intercept()`, a stub       |
| `vi.useFakeTimers()`, `vi.setSystemTime()`       | `clock`                                       |
| `toMatchSnapshot()`                              | a golden, `toMatch(file('./__expected__/…'))` |
| `vi.mock()` of your own module                   | inject the port, and double it                |

A native module a project genuinely cannot inject is the one exception, allowed per specifier with a reason in the `no-module-mock` options ([Linting § Deviating from a rule](linting.md#deviating-from-a-rule)). Why the ladder is closed: [ADR-005](https://github.com/jterrazz/package-test/blob/main/docs/decisions/005-the-doubles-ladder-is-closed.md).

### `mockOf()`

`mockOf<Port>()` is the one double a test builds itself, and only a module test does — every other kind declares its doubles, because the test does not hold the subject's wiring.

```typescript
import { mockOf } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

type PaymentGateway = { charge(amount: number): Promise<string> };

async function checkout(gateway: PaymentGateway, total: number): Promise<string> {
    return `receipt for ${await gateway.charge(total)}`;
}

describe('checkout', () => {
    test('charges the gateway once for the order total', async () => {
        // Given - a gateway that accepts every charge
        const gateway = mockOf<PaymentGateway>();
        gateway.charge.mockResolvedValue('ch_1');

        // Then - the receipt names the charge, and the gateway was asked for the total
        await expect(checkout(gateway, 42)).resolves.toBe('receipt for ch_1');
        expect(gateway.charge).toHaveBeenCalledWith(42);
    });
});
```

It is deep by default: reading a member nobody stubbed hands back another double, however far the port nests. `mockOf<Port>({ deep: false })` is the flat form — every member of the port and nothing beneath them.

State the port. `T` has no default, so `mockOf()` with no type argument answers for `object` and the error lands where the double is used, not where it was made. A double a runner hands the app — a class implementing the port, swapped in by the specification — is a test adapter, and lives in `__setup__/<port>.adapter.ts` ([Conventions § The naming recap](../concepts/conventions.md#the-naming-recap)).

## Pitfalls

- **`vi.setSystemTime` instead of `clock`.** Taken without a scope, it outlasts the test, and the next test in the file inherits a clock nobody declared.
- **Sleeping to let time pass.** `await new Promise((r) => setTimeout(r, 5000))` waits for real and hides how long the behaviour needs; `clock.run()` and `clock.advance(5000)` state it.
- **`vi.mock()` to avoid injecting a port.** Every importer of that module gets the double, and the design pressure the injection would have applied is gone.
- **A double inside an integration spec.** The integration kind exists so the module meets the real thing; a `mockOf()` there is a module test that started a container for nothing.

## Related

[Module tests](../guides/module-tests.md) · [Stubs](stubs.md) · [Services](services.md) · [Conventions](../concepts/conventions.md)
