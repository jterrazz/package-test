# 03 — Jobs specs (`specification.jobs`)

`specification.jobs()` tests background pipelines — cron jobs, queue consumers, nightly reports — by triggering them in-process against real databases and contracted external providers. No HTTP server is involved: the subject under test is _what a job writes_, not what an endpoint returns.

Use it when the behaviour you care about starts with "when the job runs…". If the behaviour starts with an HTTP request, use [api](02-api.md).

## Creating the runner

```typescript
// specs/jobs/jobs.specification.ts
import { afterAll } from 'vitest';
import { specification, postgres } from '@jterrazz/test';
import { nightlyReport, supportDrafts } from '../../src/jobs.js';

export const { jobs, cleanup } = await specification.jobs({
    services: {
        db: postgres(),
        analyticsDb: postgres(), // → kebab-derived compose service "analytics-db"
    },
    jobs: ({ db, analyticsDb }) => [nightlyReport(db, analyticsDb), supportDrafts(db)],
});

afterAll(cleanup);
```

### Options

| Option     | Required                     | Description                                                                                            |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `services` | yes (if the jobs need infra) | Named record of service factories — same semantics as [api](02-api.md), see [services](08-services.md) |
| `jobs`     | yes                          | `(services) => JobHandle[]`, or a static array. Each handle is a named, triggerable job (rule A8)      |
| `root`     | no                           | Root-resolution override, same walk-up rule as everywhere (rule A9)                                    |

There is **no `server`** and **no `mode`** option: jobs run in-process by definition (rule A5). A `JobHandle` carries the name you pass to `.trigger()` — the handles above respond to `'nightly-report'` and `'support-drafts'`.

## Why node-only

A job spec exercises your job function directly, wired to real containers. There is nothing meaningful to run "in compose" — the pipeline has no network surface of its own, and testing the scheduler that invokes it is out of scope. This is why `mode` does not exist on `specification.jobs()`: adding it would only create a switch with one valid position. End-to-end coverage of the deployed artifact belongs to `specification.api()` in compose mode.

## The chain

Setups: `.seed()`, `.intercept()`. Terminal action: `.trigger(name)` (rule B2). No `.headers()` — there is no request.

```typescript
// specs/jobs/reports/reports.test.ts
import { expect, test } from 'vitest';
import classifyProduct from './contracts/classify-product.openai.js';
import draftSupportReply from './contracts/draft-support-reply.anthropic.js';
import exchangeRates from './contracts/exchange-rates.http.js';
import { jobs } from '../jobs.specification.js';

test('nightly report classifies, prices and drafts', async () => {
    // Given - pending articles + the three external dependencies under contract
    const result = await jobs
        .seed('pending-articles.sql', { database: 'db' })
        .intercept([classifyProduct, exchangeRates, draftSupportReply])
        .trigger('nightly-report');

    // Then - the pipeline produced a classified, priced report
    await expect(result.table('reports', { database: 'analyticsDb' })).toMatchRows({
        columns: ['category', 'usd_price'],
        rows: [['ELECTRONICS', 109]],
    });
});
```

Everything a pipeline reads from the outside world is declared: seeds set the database state, contracts pin the external providers (OpenAI, Anthropic, arbitrary HTTP — see [contracts](07-contracts.md)). Databases reset at the start of every chain, exactly as for API specs (rules B1, B7).

Because jobs run in-process by definition, `.intercept()` is always available (there is no compose mode to disable it). It is **strict** (rule D7): once a chain declares one intercept, any outgoing request that matches nothing — including a trigger whose queue is exhausted — fails the spec with an explicit "Unmatched outgoing HTTP request" error naming the method, URL, and every registered trigger's consumption state (see [contracts](07-contracts.md#strict-intercepts-rule-d7)). A chain with no intercepts is not network-guarded.

## Seeding and intercepts for pipelines

A pipeline test typically stacks several intercepts. They queue **FIFO per trigger**: two intercepts with the same trigger fire in registration order, first match consumed first. That is how you script multi-call scenarios:

```typescript
test('retries then recovers from provider rate-limit', async () => {
    // Given - 1st call 429, 2nd call OK (FIFO queue: same trigger, registration order)
    const result = await jobs
        .seed('pending-articles.sql', { database: 'db' })
        .intercept(openai.chat(), openai.error(429))
        .intercept(openai.chat(), openai.reply({ category: 'BOOKS' }))
        .trigger('nightly-report');

    // Then - the retry succeeded
    await expect(result.table('reports', { database: 'analyticsDb' })).toMatchRows({
        columns: ['category'],
        rows: [['BOOKS']],
    });
});
```

## Error-case testing

Provider failure modes are first-class response builders — this is where jobs specs earn their keep, because these paths are nearly impossible to reproduce against live providers:

```typescript
test('handles malformed model output', async () => {
    // Given - the model returns something that is not JSON
    const result = await jobs
        .intercept(openai.chat(), openai.malformed('not json at all'))
        .trigger('nightly-report');

    // Then - nothing half-written
    await expect(result.table('reports', { database: 'analyticsDb' })).toBeEmpty();
});

test('times out gracefully', async () => {
    // Given - a silent provider (delay longer than the job timeout)
    const result = await jobs
        .intercept(anthropic.messages(), anthropic.timeout())
        .trigger('support-drafts');

    // Then
    await expect(result.table('support_drafts', { database: 'db' })).toBeEmpty();
});
```

The three failure families:

| Builder                                                                | Simulates                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `openai.error(429)` / `anthropic.error(status)` / `http.error(status)` | HTTP error status from the provider                    |
| `openai.timeout()` / `anthropic.timeout()`                             | A provider that never answers within the job's timeout |
| `openai.malformed('…')`                                                | A 200 whose body violates the provider schema          |

The full builder catalogue lives in [contracts](07-contracts.md).

## Result surface

`.trigger()` resolves to a result whose primary subjects are the databases:

| Member                      | Description                                                             |
| --------------------------- | ----------------------------------------------------------------------- |
| `result.table(name, opts?)` | Table subject for `toMatchRows` / `toBeEmpty` — async, `await expect()` |

With ≥ 2 databases, `{ database: 'key' }` is mandatory on every `.seed()` and `.table()`; with one, forbidden (rule A7). See the [assertions reference](05-assertions.md).

## Pitfalls

- **Looking for a `mode` or `server` option.** They exist only on `specification.api()` — jobs are in-process by definition (rules A5, A8).
- **Asserting on a job's return value.** The result surface is the observable state (tables); jobs are specified by their effects.
- **Registering intercepts in the wrong order for a retry scenario.** The FIFO queue makes registration order load-bearing: the first `.intercept()` answers the first matching call.
- **One giant spec that triggers two jobs.** A chain has exactly one terminal action (rule B1); sequence scenarios are expressed by seeding the state the second job would have found (rule B7).
- **Forgetting `await` on table expectations.** `expect(result.table(…))` without `await` never runs the SQL — table matchers are IO matchers (rule D2).
- **Leaving a queue one intercept short in a retry test.** After the first `.intercept()`, strict mode (rule D7) fails the spec on the extra call the retry makes — register one intercept per expected call.

## Related

[02 — API specs](02-api.md) · [05 — Assertions](05-assertions.md) · [07 — Contracts](07-contracts.md) · [08 — Services](08-services.md)
