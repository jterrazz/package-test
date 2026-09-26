# 11 — Job specs (`specification.job`)

`specification.job()` tests background pipelines — cron jobs, queue consumers, nightly reports — by triggering them in-process against real databases and stubbed external providers. No HTTP server is involved: the subject under test is _what a job writes_, not what an endpoint returns.

Use it when the behaviour you care about starts with "when the job runs…". If the behaviour starts with an HTTP request, use [api](10-api.md).

## What it specifies

A job spec answers one question: **when this name is triggered, what does the pipeline do to the world it was handed?** The subject is the assembled job — its handler, its services, the network it reaches — met through the one door the scheduler would use, `.trigger(name)`. What a single pure function inside that pipeline returns is a module test's ([05](05-module-tests.md)); what the pipeline leaves in a database is this chapter's.

A job spec exercises your job function directly, wired to real containers. The pipeline has no network surface of its own, and testing the scheduler that invokes it is out of scope — the job IS the subject, and the trigger name is how a spec reaches it.

## The constructor

```typescript
// specs/job/job.specification.ts
import { afterAll } from 'vitest';
import { specification, postgres } from '@jterrazz/test';
import { nightlyReport, supportDrafts } from '../../src/jobs.js';

// Hoisted, so a test can read this database after a chain that rejected
export const analyticsDb = postgres(); // → "analytics-db", init from docker/analytics-db/

export const { job, cleanup } = await specification.job({
    services: { db: postgres(), analyticsDb },
    jobs: ({ db, analyticsDb }) => [nightlyReport(db, analyticsDb), supportDrafts(db)],
});

afterAll(cleanup);
```

### Options

| Option     | Required                     | Description                                                                                                       |
| ---------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `services` | yes (if the jobs need infra) | Named record of service factories — same semantics as [api](10-api.md), see [services](17-services.md)            |
| `jobs`     | yes                          | `(services) => Job[]`, or a static array. Each is a named, triggerable job (rule `server-sees-declared-services`) |
| `root`     | no                           | Root-resolution override, same walk-up rule as everywhere (rule `no-redundant-root`)                              |

There is **no `server`** option: jobs run in-process by definition, and the record of services is the only outside world they meet. A `Job` carries the name you pass to `.trigger()` — the handles above respond to `'nightly-report'` and `'support-drafts'`.

## The chain

Setups: `.seed(file('./seeds/<name>.sql'))`, `.intercept()`, `.clock()`, and `job.with({ clock })` — a view whose every chain starts at the instant the whole file shares ([18](18-conventions.md#what-a-file-shares)). Terminal action: `.trigger(name)` (rule `one-terminal-action-per-chain`). No `.headers()` — there is no request.

`.clock('2026-03-04T09:30:00Z')` pins the job's own `Date` for the chain and releases it when the action resolves — a nightly report that stamps a window, an expiry the job computes. The primitive and its second depth are [18 — Conventions § Time](18-conventions.md#time--one-primitive-two-depths).

```typescript
// specs/job/nightly-report/pipeline.spec.ts — the job, and the aspect this file asks of it
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';
import { job } from '../job.specification.js';
import pipeline from './stubs/pipeline.stubs.js';

describe('pipeline', () => {
    test('nightly report classifies, prices and drafts', async () => {
        // Given - one pending article + the world the pipeline reaches out to
        const result = await job
            .seed(file('./seeds/one-pending-article.sql'), { database: 'db' })
            .intercept(pipeline)
            .trigger('nightly-report');

        // Then - the pipeline produced a classified, priced report
        await expect(result.table('reports', { database: 'analyticsDb' })).toMatch([
            [1, 'ELECTRONICS', 109],
        ]);
    });
});
```

Everything a pipeline reads from the outside world is declared: seeds set the database state, stubs pin the external providers (OpenAI, Anthropic, arbitrary HTTP — see [stubs](16-stubs.md)). Databases reset at the start of every chain, exactly as for API specs (rules `one-terminal-action-per-chain`, `sequence-expressed-by-seeding`).

Because jobs run in-process by definition, `.intercept()` is always available. It is **strict** (rule `network-strict-after-first-stub`): once a chain declares one stub, an outgoing request no stub answers fails the spec ([16 § Strict by construction](16-stubs.md#strict-by-construction)). A chain with no stubs is not network-guarded.

### Seeding and sequences for pipelines

Selection is **first non-exhausted match wins**, so a multi-call scenario is a finite stub in front of an unlimited tail — `times` says how many calls the first one answers:

```typescript
test('retries then recovers from provider rate-limit', async () => {
    // Given - the first call is rate-limited, everything after it succeeds
    const result = await job
        .seed(file('./seeds/pending-articles.sql'), { database: 'db' })
        .intercept([
            { request: openai.chat(), response: openai.error(429), times: 1 },
            { request: openai.chat(), response: openai.reply({ category: 'BOOKS' }) },
        ])
        .trigger('nightly-report');

    // Then - the retry succeeded
    await expect(result.table('reports', { database: 'analyticsDb' })).toMatch([
        [1, 'BOOKS', '{{number}}'],
    ]);
});
```

The number in `times` IS the assertion: it says the job retries exactly once. A stub with no `times` is unlimited, which is what you want for a route the pipeline may hit any number of times.

## The result

`.trigger()` resolves to a result whose primary subjects are the databases:

| Member                      | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| `result.table(name, opts?)` | Table subject, compared whole — `toMatch(<rows>)` / `toBeEmpty()`, `await`ed |

Whether `.seed()` and `.table()` name a database is [17 § The `database:` rule](17-services.md#the-database-rule).

## Unique here

### Error-case testing — a provider that fails on purpose

Provider failure modes are first-class response builders — this is where job specs earn their keep, because these paths are nearly impossible to reproduce against live providers:

```typescript
test('handles malformed model output', async () => {
    // Given - the model returns something that is not JSON
    const result = await job
        .intercept(openai.chat(), openai.malformed('not json at all'))
        .trigger('nightly-report');

    // Then - nothing half-written
    await expect(result.table('reports', { database: 'analyticsDb' })).toBeEmpty();
});

test('times out gracefully', async () => {
    // Given - a silent provider (delay longer than the job timeout)
    const result = await job
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

The full builder catalogue lives in [stubs](16-stubs.md).

### A crash is read by its rejection

A job that throws rejects `.trigger()` with its own error, and what it wrote before the throw stays in the database — read it from the service handle, since a rejected chain hands back no result. That is why the constructor above hoists `analyticsDb` out of the record: a handle declared on its own is one a test can import and query.

```typescript
import { expect, test } from 'vitest';

import { analyticsDb, job } from '../job.specification.js';

test('a crashed job leaves what it wrote first', async () => {
    // Given - a job that writes one row, then throws
    const run = job.trigger('crash-after-insert');

    // Then - its error, and the row it wrote before it
    await expect(run).rejects.toThrow('crash-after-insert: boom');
    await expect(analyticsDb.query('events', ['type'])).resolves.toStrictEqual([['pre_crash']]);
});
```

## Pitfalls

- **Looking for a `server` option.** It exists only on `specification.api()` and `specification.website()` — jobs are in-process by definition; what a job reads from the outside is its `services` record (rule `server-sees-declared-services`).
- **Asserting on a job's return value.** The result surface is the observable state (tables); jobs are specified by their effects.
- **Forgetting `times` on the leading stub of a sequence.** With no `times` the first stub is unlimited, so it answers every call and the recovery stub behind it is never reached.
- **One giant spec that triggers two jobs.** A chain has exactly one terminal action (rule `one-terminal-action-per-chain`); sequence scenarios are expressed by seeding the state the second job would have found (rule `sequence-expressed-by-seeding`).
- **Forgetting `await` on table expectations.** `expect(result.table(…))` without `await` never runs the SQL — table matchers are IO matchers (rule `io-matcher-awaited` for `toMatch(<rows>)`, the type-aware `typescript/no-floating-promises` for `toBeEmpty`).
- **Bounding the tail of a sequence.** The last stub of a sequence should stay unlimited; a `times` there turns one extra retry into an "unmatched outgoing request" failure (rule `network-strict-after-first-stub`).

## Related

[10 — API specs](10-api.md) · [14 — Assertions](14-assertions.md) · [16 — Stubs](16-stubs.md) · [17 — Services](17-services.md)
