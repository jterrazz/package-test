# 07 — Contracts: intercepting the outside world

External interactions — LLM providers, third-party APIs — are declared as **contracts**: one TypeScript file per interaction, holding the request trigger and the response together, so the business payload (prompts, JSON replies) is visible at a glance. Underneath, the real outgoing HTTP call is intercepted (MSW — a direct dependency, installed automatically with the framework).

Contracts are consumed by `.intercept()` on both [api](02-api.md) and [jobs](03-jobs.md) chains (rule B2).

## `defineContract` and the file convention

One file per interaction, **flat** under the feature's `contracts/` folder, named `<name>.<provider>.ts` with `provider ∈ { openai, anthropic, http }` (rule C4). The file default-exports `defineContract({ trigger, response })` — no subfolders, no named exports.

```typescript
// contracts/classify-product.openai.ts
import { defineContract, openai } from '@jterrazz/test';

export default defineContract({
    trigger: openai.responses(
        { user: /Product Classification/, tools: ['classify'] },
        'https://gateway.shoply.dev/v1/responses',
    ),
    response: openai.reply({ category: 'ELECTRONICS', confidence: 0.97 }),
});
```

```typescript
// contracts/draft-support-reply.anthropic.ts
import { defineContract, anthropic } from '@jterrazz/test';

export default defineContract({
    trigger: anthropic.messages({ system: /support agent/, model: /claude/ }),
    response: anthropic.reply('Bonjour, votre commande arrive demain.'),
});
```

```typescript
// contracts/exchange-rates.http.ts
import { defineContract, http } from '@jterrazz/test';

export default defineContract({
    trigger: http.get('https://rates.example.com/v1/latest'),
    response: http.json({ base: 'EUR', rates: { USD: 1.09 } }),
});
```

Usage — import the default export, pass it to `.intercept()`. A single contract, or an array of them (registered in order — same-trigger entries queue FIFO), both work:

```typescript
import classifyProduct from './contracts/classify-product.openai.js';
import exchangeRates from './contracts/exchange-rates.http.js';

test('nightly report classifies and prices', async () => {
    // Given - external dependencies under contract (array === chained calls)
    const result = await jobs
        .seed('pending-articles.sql', { database: 'db' })
        .intercept([classifyProduct, exchangeRates])
        .trigger('nightly-report');

    // Then
    await expect(result.table('reports', { database: 'analyticsDb' })).toMatchRows({
        columns: ['category', 'usd_price'],
        rows: [['ELECTRONICS', 109]],
    });
});
```

## Trigger builders

Provider triggers are named after the provider's own official API. Filters accept exact strings or RegExps; an omitted filter matches any request of that provider.

### `openai.*`

| Trigger                           | Targets                                                                        | Filters                                               |
| --------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `openai.chat(filter?)`            | Chat Completions API                                                           | `model`, `system`, `user`, `tools`, `temperature`     |
| `openai.responses(filter?, url?)` | Responses API (AI-SDK style); `url` overrides the endpoint for custom gateways | `model`, `system`, `user`, `tools` (no `temperature`) |

### `anthropic.*`

| Trigger                             | Targets                                                                                               | Filters                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `anthropic.messages(filter?, url?)` | Messages API; `url` overrides the endpoint for custom gateways. Object fixtures pass through verbatim | `model`, `system`, `user`, `tools` |

### `http.*` — any URL

Every `http` trigger takes an optional `HttpInterceptFilter` — `{ body?, headers?, query? }` — narrowing beyond method + URL:

- `body`: an object is a deep **subset** match (toMatchObject-style) whose leaves may be `match.*` matchers; a string is a containment test and a RegExp a `test()` over the raw text body.
- `headers`: subset match, header names case-insensitive; string = exact value, RegExp = `test()`.
- `query`: subset of the URL search params; string = exact value, RegExp = `test()`.

A request that hits the URL/method but fails the filter counts as unmatched (strict intercepts, rule D7).

| Trigger                                                                                                       | Matches                                   |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `http.get(url, filter?)` / `http.post(url, filter?)` / `http.put(url, filter?)` / `http.delete(url, filter?)` | That method on the URL (string or RegExp) |
| `http.any(url, filter?)`                                                                                      | Any method on the URL                     |

```typescript
.intercept(http.any(/analytics\.example/), http.json({ ok: true }))

// Filtered: only a POST whose body carries this subset, header, and query param
.intercept(
    http.post('https://api.shoply.dev/orders', {
        body: { user: { role: 'admin' } },
        headers: { 'x-tenant': 'acme' },
        query: { lang: 'en' },
    }),
    http.json({ accepted: true }),
)
```

## Response builders

### Success

| Response                   | Produces                                                     |
| -------------------------- | ------------------------------------------------------------ |
| `openai.reply(data)`       | `data` wrapped in a valid Chat Completions envelope          |
| `anthropic.reply(data)`    | `data` (object or plain text) wrapped in a Messages envelope |
| `http.json(data, status?)` | Plain JSON response, default status 200                      |

The point: your contract file states the **business payload** (`{ category: 'ELECTRONICS' }`), and the builder produces the provider's full wire format around it.

### Failure

| Response                                   | Simulates                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `openai.error(status)`                     | Provider HTTP error (e.g. `429` rate limit)                                                                                        |
| `anthropic.error(status)`                  | Same, Anthropic envelope                                                                                                           |
| `http.error(status)`                       | Plain HTTP error                                                                                                                   |
| `openai.timeout()` / `anthropic.timeout()` | A provider that never answers within the caller's timeout                                                                          |
| `openai.malformed(text)`                   | HTTP 200: a valid Chat Completions envelope whose assistant message content is `text` (an unparseable payload the app must handle) |

## Dynamic responses

A `response` is usually a fixed value, but it can also be a **function of the incoming request** — `(request: MatchableRequest) => InterceptResponse`. It is evaluated **per consumed request**, at the moment the intercept is taken from the queue, so the reply can echo or derive from the request body, headers, or URL. The function works everywhere a response does: inside `defineContract`, and inline on `.intercept(trigger, fn)`.

The `request` handed to it is the same [`MatchableRequest`](#trigger-builders) the trigger matched on: `{ body, headers, url }`, with `body` already parsed as JSON when the payload is JSON.

```typescript
// In a contract — the reply mirrors the request payload
export default defineContract({
    trigger: http.post('https://gateway.shoply.dev/v1/echo'),
    response: (request) => http.json({ received: request.body }),
});

// Inline — derive status and body from the observed request
const result = await api
    .intercept(http.post(url), (request) => {
        const tenant = request.headers['x-tenant'];
        return http.json({ quote: `hello ${tenant}` }, 201);
    })
    .get('/submit');
```

Prefer a fixed response whenever the reply is known ahead of time — a dynamic response is for the cases where the mock genuinely depends on what was sent (echo endpoints, request-derived ids, per-call variation).

## FIFO queueing

Intercepts **queue per trigger**: several intercepts whose triggers match the same request fire sequentially, in registration order, each consumed once. This is the mechanism for retry and multi-call scenarios. Passing an **array** to `.intercept([a, b])` is identical to two consecutive calls — array order is the queue order:

```typescript
test('retries then recovers from provider rate-limit', async () => {
    // Given - 1st call 429, 2nd call OK (FIFO: same trigger, registration order)
    const result = await jobs
        .seed('pending-articles.sql', { database: 'db' })
        .intercept(openai.chat(), openai.error(429))
        .intercept(openai.chat(), openai.reply({ category: 'BOOKS' }))
        .trigger('nightly-report');

    // Then
    await expect(result.table('reports', { database: 'analyticsDb' })).toMatchRows({
        columns: ['category'],
        rows: [['BOOKS']],
    });
});
```

## Escape hatches

Contracts are the convention; two lighter forms exist for one-off technical cases (rule B2 allows both on `.intercept()`):

**Inline trigger + response** — when the interaction is pure plumbing and a named file would add nothing:

```typescript
.intercept(http.any(/analytics\.example/), http.json({ ok: true }))
.intercept(openai.chat(), openai.malformed('not json at all'))
```

**JSON fixture files** — when the response payload is large or captured from a real exchange. Files live under `intercepts/<provider>/<name>.json` in the feature folder, and are referenced by that relative path:

```typescript
.intercept(openai.responses({ user: /Ingestion/ }), 'openai/ingest-tech.json')
// → resolves intercepts/openai/ingest-tech.json
```

The fixture is the provider-shaped response body, passed through verbatim.

## Strict intercepts (rule D7)

Intercepts are **strict by construction**. The moment a chain declares at least one `.intercept()`, MSW is mounted and every outgoing HTTP request during the action must match a registered, unconsumed intercept. A request that matches nothing — including one whose queue is already **exhausted** (all intercepts for that trigger consumed) — fails the spec with an explicit error that rejects the action promise (never an unhandled rejection):

```
Unmatched outgoing HTTP request during spec: POST https://api.openai.com/v1/chat/completions
Registered intercepts:
  - POST https://api.openai.com/v1/chat/completions (already consumed)
Every outgoing request of a chain that declares intercepts must match one — add an .intercept() for it (or one more if its queue is exhausted).
```

The error names the offending method + URL and lists every registered trigger with its consumption state (`(already consumed)` where applicable). Two scoping notes:

- **A chain with zero intercepts does not mount MSW, so its network is not guarded** (a deliberate, documented boundary). Strictness begins with the first `.intercept()`.
- **`.intercept()` is not available in compose mode.** MSW is in-process; a compose-mode `specification.api()` runner throws immediately: `.intercept(): intercepts are in-process (MSW) and not available in compose mode — keep intercept specs in node-only vitest projects.` The practical pattern: keep intercept specs in a **node-only** vitest project. This repo does exactly that — the `api-stack` (compose) project excludes `specs/api/intercepts/**`.

## Choosing the form

| Situation                                          | Form                                   |
| -------------------------------------------------- | -------------------------------------- |
| A named business interaction, reused or reviewable | `contracts/<name>.<provider>.ts`       |
| Failure-mode plumbing in one test                  | inline `.intercept(trigger, response)` |
| Bulky captured payload                             | `intercepts/<provider>/<name>.json`    |

## Pitfalls

- **Wrong file name shape.** `contracts/openai/classify.ts` (subfolder) or `contracts/classify.ts` (no provider suffix) violate rule C4 — the flat `<name>.<provider>.ts` form with a `defineContract` default export is checked.
- **Relying on trigger specificity instead of order.** When two intercepts match the same request, registration order decides — FIFO, not "most specific wins".
- **Testing prompt internals through over-tight filters.** Filter on the stable business marker (`user: /Product Classification/`), not on the full prompt text — contracts pin interactions, not wording.
- **Letting a pipeline hit the network.** Every outgoing call in a spec should be under contract; an unintercepted call is a test escaping the sandbox, not extra realism. Once a chain declares one intercept, strict mode (rule D7) turns any stray call into a failure — but a chain with **no** intercepts is not guarded at all.
- **Reaching for `.intercept()` in a compose-mode project.** It throws immediately — MSW cannot reach an app running in its own container. Keep intercept specs in a node-only vitest project (rule I3/D7).

## Related

[03 — Jobs specs](03-jobs.md) · [02 — API specs](02-api.md) · [09 — Conventions](09-conventions.md)
