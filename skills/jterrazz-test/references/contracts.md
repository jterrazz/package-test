# Mocking outgoing calls — intercept contracts

Operative reference. Prose + examples: [docs/07-contracts.md](../../docs/07-contracts.md). Available on `api` and `jobs` (in-process MSW).

Business-meaningful external interactions (LLM providers, third-party APIs) are declared as **contracts**: one file per interaction, FLAT under `contracts/`, with a provider suffix — `contracts/<name>.<provider>.ts`, `provider ∈ { openai, anthropic, http }`.

```typescript
// contracts/classify-product.openai.ts
import { defineContract, openai } from '@jterrazz/test';

export default defineContract({
    trigger: openai.responses({ user: /Product Classification/, tools: ['classify'] }),
    response: openai.reply({ category: 'ELECTRONICS', confidence: 0.97 }),
});
```

```typescript
import classifyProduct from './contracts/classify-product.openai.js';
const result = await jobs.intercept(classifyProduct).trigger('nightly-report');
```

## Registering

| Form                                     | Notes                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `.intercept(contract)`                   | A declared contract                                                                |
| `.intercept([contract, …])`              | Registered in order; same-trigger entries queue FIFO                               |
| `.intercept(trigger, response)`          | Inline; `response` may be an `intercepts/<provider>/<file>.json` fixture path      |
| `.intercept(trigger, (request) => resp)` | Dynamic response — `(request: MatchableRequest) => InterceptResponse`, per request |

## Builders

| Helper                                                                      | Kind     | Notes                                                                         |
| --------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `defineContract({ trigger, response })`                                     | contract | Named interaction artifact                                                    |
| `openai.chat(filter?)`                                                      | trigger  | Chat Completions; filter: `model`, `system`, `user`, `tools`, `temperature`   |
| `openai.responses(filter?, url?)`                                           | trigger  | Responses API; filter: `model`, `system`, `user`, `tools` (NO `temperature`)  |
| `openai.reply(data)` / `.error(status)` / `.timeout()` / `.malformed(text)` | response | Envelope / failures                                                           |
| `anthropic.messages(filter?, url?)`                                         | trigger  | Messages API; gateway support; object fixtures pass through verbatim          |
| `anthropic.reply(data)` / `.error(status)` / `.timeout()`                   | response | Envelope / failures                                                           |
| `http.get/post/put/delete/any(url, filter?)`                                | trigger  | Any URL, string or RegExp; filter: `{ body?, headers?, query? }` subset match |
| `http.json(data, status?)` / `http.error(status, msg?)`                     | response | Plain JSON                                                                    |

No `claude` alias — use `anthropic`. `msw` ships as a direct dependency (no separate install).

## Strict intercepts (D7) — the rule that catches you

Once a chain declares ONE `.intercept()`, every outgoing request must match a registered, unconsumed intercept. An unmatched or queue-exhausted request FAILS the spec:

```
Unmatched outgoing HTTP request during spec: <METHOD> <url>
```

(the error lists every registered trigger and its consumption state). Declare one `.intercept()` per expected call. A chain with **zero** intercepts does not mount MSW — its network is not guarded (assumed perimeter).

## Node-only (I3)

Intercepts are in-process MSW. A compose-mode `specification.api()` runner throws immediately (`intercepts are in-process (MSW) and not available in compose mode`). Keep intercept specs in a node-only vitest project (this repo's `api-stack` project excludes `specs/api/intercepts/**`). `specification.jobs()` is always node, so intercepts always work there.
