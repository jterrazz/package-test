# 16 — Stubs: the outside world, declared

Everything the outside world replies is declared as a **stub**: a request to match and a response to serve, together in one named artifact. There is no second form — no mock format, no fixture-path string, no `.http` intercept file. Stubs are the whole vocabulary, on every facet that reaches the network — `api`, `job`, `integration`, `component`, `website` and `mobile`.

A stub states what the provider replies, and nothing runs it against the provider it stands for — so it is named for what it does, never for a verification it does not make.

## The principle

> **TypeScript is behavior. `.json` is data. `.http` is a document at the boundary of YOUR OWN api** (`requests/`, `expected/`) — never a mock format.

A stub is behavior: it decides what matches and what is served, it can count, it can be required, it can compose. That belongs in TypeScript, where the type checker and the app's own builders are reachable. A 200-line payload is not behavior — it is data, and it goes to a sibling `.json` the stub imports. And `.http` keeps the one role it is good at: a complete, readable document of a request your api receives or a response your api returns.

## `defineStub`

```typescript
import { defineStub, http } from '@jterrazz/test';

export default defineStub({
    request: http.get('/articles/{{uuid}}'),
    response: http.json({ id: 'a-1', title: 'Fauci and the lab leak' }),
});
```

| Field       | Meaning                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `request`   | What outgoing call this stub speaks for — a stub builder (`http.*`, `openai.*`, `anthropic.*`)                              |
| `response`  | The reply: a fixed value, or `(request) => StubResponse` evaluated per served request                                       |
| `times?`    | How many times it may serve. **Omitted = unlimited** (a re-render or a retry replays it). `n` = exhausted after `n` serves. |
| `required?` | The chain FAILS unless it was actually requested — at least once, or exactly `times` times when `times` is set.             |

### Selection

One engine-agnostic queue serves every facet. An observed request matches a stub when the method matches (`'*'` accepted), the url matches, the declared query params and headers are a **subset** of the observed ones, and the `match` predicate — if any — passes on the body.

**The first stub in list order that matches AND is not exhausted wins.** That single rule covers the two shapes you need:

```typescript
import { defineStubs, http } from '@jterrazz/test';

// A retry sequence: three failures, then an unlimited tail.
export default defineStubs(
    { request: http.get('/quote'), response: http.error(500), times: 3 },
    { request: http.get('/quote'), response: http.json({ quote: 'recovered' }) },
);
```

If every matching stub is exhausted, or nothing matches at all, the spec fails (strict — see [below](#strict-by-construction-rule-d7)). A chain that declares **no** stub is not guarded at all: strictness begins with the first `.intercept()`.

### `times` and `required` — saying what you mean

`times` is how a spec asserts a **call count** without reaching for a spy: `times: 3` on a failing stub plus an unlimited success tail says "the app retries exactly three times before it succeeds". `required: true` is the other half — it turns a declaration nobody exercised into a failure:

```typescript
import { defineStub, http } from '@jterrazz/test';

// If the screen never asks for the 1M range, the spec fails — instead of
// passing green on a chart that silently rendered the default range.
export default defineStub({
    request: http.get('/indicators', { query: { range: '1M' } }),
    required: true,
    response: http.json({ points: [] }),
});
```

Without `required`, a stub nobody calls is invisible: the test passes, and the assertion it was supposed to protect never ran.

## `defineStubs` — it's stubs all the way down

A test imports **one** artifact: the world its feature lives in. `defineStubs` composes stubs, lists, and other composites into it, recursively, order preserved.

```typescript
import { defineStubs, http } from '@jterrazz/test';

const events = defineStubs({
    request: http.get('/events'),
    response: http.json({ items: [] }),
});

// A composite extends a composite — same function, all the way down.
export default defineStubs(events, {
    request: http.get('/articles/{{uuid}}'),
    response: http.json({ id: 'a-1' }),
});
```

### `.with()` — replacement by route, then prepend

`.with(...)` derives a **variant** without mutating the base. Two steps, in this order:

1. Every base stub whose **route** an override claims is removed. Same route = same `method` + the same declared url pattern (string equality of the declared path, `.source` equality for a RegExp).
2. The overrides are **prepended**, keeping their own order.

The prepend is what makes a _more specific_ override work without deleting the generic route it lives beside: `/articles/gone-1` does not claim the route `/articles/{{uuid}}`, so the generic stub survives — but the override is checked first, so the one article that is gone answers 410 while every other article still answers 200.

```typescript
import { defineStub, defineStubs, http } from '@jterrazz/test';

const newsroom = defineStubs(
    { request: http.get('/events'), response: http.json({ items: [] }) },
    { request: http.get('/articles/{{uuid}}'), response: http.json({ id: 'a-1' }) },
);

export default newsroom;

// A scenario: one article is gone, the rest of the world is unchanged.
export const withArticleGone = (id: string) =>
    newsroom.with(
        defineStub({
            request: http.get(`/articles/${id}`),
            response: http.error(410, { error: 'gone' }),
        }),
    );
```

## The facade pattern

The file layout follows the same split: a **public facade** per feature, **internal units** under it.

```
specs/<facet>/<feature>/
├── <feature>.test.ts
└── stubs/
    ├── newsroom.stubs.ts              PUBLIC — named exports = the world
    │                                      and its scenarios
    ├── http/
    │   ├── events.ts                      a unit stub
    │   ├── events.response.json           the payload it serves
    │   ├── events.fr.response.json        a qualified payload — same owner
    │   └── article-gone.ts                a factory: (id) => Stub
    ├── openai/
    │   ├── classify-article.ts
    │   └── classify-article.request.ts    the exact prompt it matches
    └── anthropic/
        └── draft-reply.ts
```

The rules, enforced by [C4, C10 and C11](19-linting.md):

- The **root** holds only `*.stubs.ts` facades and one folder per stub **kind** — a builder the package exports: `http`, `openai`, `anthropic`, a closed list that grows only with the exports. The folder carries the kind — filenames drop it and go back to being business names.
- A facade **exports its builders and sets by name** — the world (`export const newsroom = defineStubs(…)`) and its **scenario factories** (`withArticleGone(id)`), so every variant of the world is named next to the world; a facade that exports nothing is an error. A default export is not required — a test imports the name it calls, and a default no test reads is dead code the unused-export pass reports. When a facade has one, it is a composition: a `defineStubs(...)`, a scenario of a sibling facade — `export default pipeline({ ingestion: 'ai-facts' })`, `pipeline` imported from `./pipeline.stubs.js` — or a call to a builder it declares to return `Stubs`; C4 judges the default by where its builder comes from, since the linter reads no types.
- A unit stub is `<kind>/<kebab-name>.ts` and default-exports `defineStub(...)` or a factory returning one. It calls its own folder's builder alone — an `openai/` unit that replies with `http.error(…)` is an error, however it is written. A provider's streamed reply is that provider's stub (`openai.stream`, `anthropic.stream`); any other server-sent stream is an `http` stub.
- Data with real mass goes to a sibling `.response.json` (served) or `.request.ts` (matched). The stem before the FIRST dot pairs the data with its stub: `events.fr.response.json` belongs to `events.ts`. An orphan payload is an error.
- **Tests import only `*.stubs.ts`.** Kind folders are internal — reaching into one from a test is an error (C10). A scenario belongs in the facade, not in the test.
- Shared data has ONE owner: a second stub imports `./events.response.json` directly. No copies, no `shared/` folder.

A unit stub may import `@jterrazz/test`, its neighbours inside `stubs/`, **and the app's own source** — importing the app's real prompt builder is preferred over pinning its output, so a domain change surfaces as a type error or a readable diff instead of a silent "unmatched request".

```typescript
// stubs/newsroom.stubs.ts — the facade a test imports
import { defineStubs } from '@jterrazz/test';

import articleGone from './http/article-gone.js';
import events from './http/events.js';

export const newsroom = defineStubs(events);

export const withArticleGone = (id: string) => newsroom.with(articleGone(id));
```

```typescript
// stubs/http/events.ts — a unit, with its payload beside it
import { defineStub, http } from '@jterrazz/test';

import payload from './events.response.json' with { type: 'json' };

export default defineStub({
    request: http.get('/events'),
    response: http.json(payload),
});
```

## Using them: `.intercept()`

Every facet that reaches the network takes the same three forms:

| Form                            | Use                                                        |
| ------------------------------- | ---------------------------------------------------------- |
| `.intercept(stubs)`             | A composite — the normal case, one import per feature      |
| `.intercept(stub)` / `([a, b])` | A single stub or a list                                    |
| `.intercept(request, response)` | An inline pair, for one-off plumbing that deserves no name |

```typescript
import { http } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';
import { newsroom } from './stubs/newsroom.stubs.js';

test('serves the declared world', async () => {
    // Given - a one-off inline pair alongside the feature's world
    const result = await api
        .intercept(newsroom)
        .intercept(http.any(/analytics\.example/), http.json({ ok: true }))
        .get('/report');

    // Then - the report rendered
    expect(result.status).toBe(200);
});
```

Repeated `.intercept()` calls **append**. Composition and override semantics live in `defineStubs` / `.with()`, never in call order.

## `intercept()` — the same double, with no chain

A module test has no runner and therefore no chain to hang stubs on, and its subject can still reach the network. `intercept(...)` is that case, and it takes the same three forms:

```typescript
import { http, intercept } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('reads the rate off the provider', async () => {
    // Given - the one call this module makes, declared for the block
    await using _ = await intercept(http.get('https://rates.test/eur'), http.json({ rate: 1.07 }));

    // Then - the module answers with what the provider replied
    const response = await fetch('https://rates.test/eur');
    await expect(response.json()).resolves.toStrictEqual({ rate: 1.07 });
});
```

The scope is an `AsyncDisposable`: the handlers come off at the end of the block however the block ends, and an outgoing request no stub accepted is thrown THERE — the same strictness a chain gets (rule D7), which is what makes it a guard and not a convenience.

**The refusal lands at DISPOSAL, not at the call.** An undeclared request is not rejected where the subject made it: the `fetch` proceeds and fails on its own, and the violation is raised when the scope closes. That is the right place, because a subject that catches its own network failures — a retry loop, an `onError` callback, a fallback value — would swallow a rejection thrown at the call site and the spec would pass on a call nobody declared. Disposal happens after the subject is done, so nothing can catch it.

`await using _ = await intercept(…)` carries two awaits and both are load-bearing. The inner one waits for the engine to be listening; without it the subject could reach the real network before the first handler is in place. The shape refuses that spelling rather than leaving it to discipline: `intercept()` answers a promise, a promise is not an `AsyncDisposable`, and `await using _ = intercept(…)` does not compile.

A file that declares the same world in several tests factors it into a function, and the two awaits survive the move — the helper is `async`, and it awaits what it hands back:

```typescript
async function rateProvider() {
    return await intercept(http.get('https://rates.test/eur'), http.json({ rate: 1.07 }));
}

// In each test: await using _ = await rateProvider();
```

Both keywords are the rulebook's, not taste: a function returning a promise is `async` (`typescript/promise-function-async`) and a returned promise is awaited (`typescript/return-await`), so the other spellings do not lint.

It is real in both runtimes — msw's server under node, msw's worker in a page — so a module test and a component test declare the outside world the same way. What it replaces is `vi.stubGlobal('fetch')` and a direct `msw/node` import, which rules F6 and F8 refuse a test and a consumer respectively.

**A subject that fetches a PATH states where the path lives.** `fetch('/api/posts')` is browser code: under node the URL has no base, so the request fails before any stub can answer it. `intercept(stubs, { origin: 'http://console.test' })` gives the block that base — the relative call resolves against it, the stubs match as they would any other request (a path-form stub ignores the origin, an absolute one compares it), and `fetch` is put back when the scope ends. It is the seam's own wrapping, so no test has to own one.

```typescript
await using _ = await intercept(posts, { origin: 'http://console.test' });
```

**An empty list is refused.** `intercept(defineStubs())` guards nothing, and a subject with no network needs no intercept at all — the message says so. "This subject makes no network call" is said the other way round: declare the call with `http.unreachable()` on every feed it could reach, and the spec fails if it makes one.

**A body the subject cancels settles.** Under node, every reply to `fetch` reaches the subject with its body as a stream this package owns, so `response.body.cancel()` — what an SDK client does with a body it will not read, before a retry — resolves at once. The status, the headers and the address the reply came from are read as they were served. msw keeps a branch of every body for itself and never cancels it; the owned stream is what stands between that branch and the subject's cancel. A reply no stub answered is owned too, since msw branches the body of a request it passes through to the network as well. `specs/api/intercept/body-cancel.spec.ts` is the proof for a stub's reply: an app that cancels the body of `http.error(503, { … })` answers its request. `specs/integration/intercept/passthrough-cancel.spec.ts` is the proof for a reply passed through to a real server. In a page nothing is wrapped: the worker's reply reaches the subject through the browser's own network stack, and its cancel settles as served — `specs/component/intercept/quote-status.test.tsx` is the proof.

**Around a `.render()` the chain's registration wins.** A rendered unit's network is declared on the chain — `component.intercept(c).render(…)` — because the render registers its stubs last and its strictness is total ([07](07-component.md)). A module-scope `intercept()` opened around a `.render()` is shadowed by it and proves nothing. In a `.test.tsx`, `intercept()` is for code the TEST calls itself, never for what the render fetches.

## Three engines, one queue

| Facets                                                    | Engine                                            | Notes                                                                               |
| --------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `api`, `job`, `integration`, and a module's `intercept()` | **msw server**, in-process                        | The subject runs here, so its outgoing requests pass through this process           |
| `component`                                               | **msw worker**, in the page                       | The component runs in Chromium, so the service worker answers its requests there    |
| `website`, `mobile`                                       | the **declared stub backend** (plain `node:http`) | Started by the runner, its URL injected/exposed; CORS and `OPTIONS` handled for you |

All three consume the **same** selection queue, so a stub behaves identically whichever answers it: first match wins, `times` exhausts, `required` verifies at chain end. The old divergence — consume-once on MSW, sticky-last on the stub backend — is gone; "sticky" is now just the default (`times` omitted), written down.

The stub backend resets between chains, the way databases do: one chain = one terminal action, and its stubs replace the previous chain's wholesale.

## Request builders

### `http.*` — any URL

```typescript
import { http } from '@jterrazz/test';

http.get('https://rates.example.com/v1/latest');
http.get('/articles/{{uuid}}'); // path form: any origin, structural segment
http.post('https://api.shoply.dev/orders', {
    body: { user: { role: 'admin' } },
    headers: { 'x-tenant': 'acme' },
    query: { lang: 'en' },
});
```

`http.get | post | put | patch | delete | any(urlOrPath, filter?)`. A **path-form** url (`'/articles/{{uuid}}'`) matches that path on **any origin** — the app's real host does not matter — and `{{token}}` segments match structurally ([15 — Tokens](15-tokens.md)).

The optional `filter` narrows beyond method + URL, and these are **filters**, so subset is the right default:

- `body`: an object is a deep **subset** match whose leaves may be `match.*` matchers; a string is a containment test; a RegExp is a `test()` over the raw text body.
- `headers` / `query`: subset match (header names case-insensitive); a string value is **exact**, a RegExp is `test()`.

### `openai.*` / `anthropic.*`

| Builder                             | Targets                                                         | Filters                                           |
| ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `openai.chat(filter?)`              | Chat Completions API                                            | `model`, `system`, `user`, `tools`, `temperature` |
| `openai.responses(filter?, url?)`   | Responses API (AI-SDK style); `url` overrides the endpoint      | `model`, `system`, `user`, `tools`                |
| `anthropic.messages(filter?, url?)` | Messages API; `url` overrides the endpoint for a custom gateway | `model`, `system`, `user`, `tools`                |

### Matching: strings are EXACT

A string filter on a provider builder means **exact equality**. Looser matching is explicit — a RegExp, or the code-only matcher `match.includes(...)`:

```typescript
import { defineStub, match, openai } from '@jterrazz/test';

// Exact — the app's own builder produces the prompt, so it cannot drift.
const PROMPT = 'Classify the article into one of: TECH, POLITICS, SPORT.';

export default defineStub({
    request: openai.chat({ user: PROMPT }),
    response: openai.reply({ category: 'TECH' }),
});

// Looser, on purpose: per-run data makes an exact prompt impractical.
export const byPrefix = defineStub({
    request: openai.chat({ user: match.includes('Classify the article') }),
    response: openai.reply({ category: 'TECH' }),
});
```

Exactness is the default because a substring filter silently cross-matches: two prompts sharing a preamble both match the first stub, and the spec goes green on the wrong reply. `match.includes` is a code-only matcher, like `match.regex` — the `{{token}}` file vocabulary does not grow.

## Response builders

| Response                                   | Produces                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `http.json(body, init?)`                   | JSON response — `init: { status?, headers?, delay? }`                               |
| `http.text(body, init?)`                   | `text/plain` response                                                               |
| `http.error(status, body?)`                | HTTP error, optional JSON body                                                      |
| `http.empty(status = 204)`                 | Empty response                                                                      |
| `http.stream(chunks, init?)`               | A body that arrives in PIECES — `init: { contentType?, delay?, status?, headers? }` |
| `http.sse(events, init?)`                  | A server-sent event stream: one chunk per event, `text/event-stream`                |
| `http.unreachable()`                       | No response at all: the request fails in TRANSPORT and the caller's `fetch` rejects |
| `openai.reply(data)`                       | `data` wrapped in a valid Chat Completions envelope                                 |
| `anthropic.reply(data)`                    | `data` (object or text) wrapped in a Messages envelope                              |
| `openai.error(status)` / `anthropic.error` | Provider HTTP error (e.g. `429` rate limit)                                         |
| `openai.timeout()` / `anthropic.timeout()` | A provider that never answers within the caller's timeout                           |
| `openai.malformed(text)`                   | HTTP 200 whose assistant content is `text` — an unparseable payload to handle       |
| `openai.stream(pieces, init?)`             | The assistant's text streamed, one delta per piece — see Streamed replies           |
| `anthropic.stream(pieces, init?)`          | The assistant's text streamed as Messages events, one delta per piece               |

The point: your stub states the **business payload** (`{ category: 'TECH' }`) and the builder produces the provider's full wire format around it.

`http.unreachable()` is the one that is not a reply. A subject usually has two failure branches — "the server said no" and "nothing answered" — and only a status can express the first. The second is what a caller meets when the service is not running, and it is the branch behind a message like _the server did not answer, check that it is running_; `http.error(503)` tests the other one. Both engines honour it: msw's node interceptor and its service worker share the response shape.

### Streamed replies

A subject that reads a reply AS IT LANDS — a token-by-token render, a progress bar, a client that reconnects on a half-read body — is specified by the chunks and their order, which a single serialised body cannot state. `http.stream()` and `http.sse()` say that, and all three engines honour them: msw's server, msw's worker, and the `node:http` stub backend the website and mobile facets serve from.

```typescript
import { http, intercept } from '@jterrazz/test';
import { expect, test } from 'vitest';

test('renders a streamed reply as its pieces land', async () => {
    // Given - a provider answering in three pieces, ten milliseconds apart
    await using _ = await intercept(
        http.get('https://tokens.test/stream'),
        http.stream(['Hel', 'lo, ', 'world'], { contentType: 'text/plain', delay: 10 }),
    );

    // Then - the reader sees them in that order
    const response = await fetch('https://tokens.test/stream');
    await expect(response.text()).resolves.toBe('Hello, world');
});
```

`http.sse(events)` frames each event the way an `EventSource` reads it — `event:`, `id:`, `retry:` and one `data:` line per line of payload, then the blank line that ends the frame — and serves the lot as `text/event-stream`. An object payload is JSON; a string is sent as-is.

| `SseEvent` field | Becomes                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `data`           | the `data:` lines — an object is JSON, a string is sent verbatim  |
| `event`          | the `event:` name; omitted, the client sees the default `message` |
| `id`             | the `id:` the client echoes as `Last-Event-ID` when it reconnects |
| `retry`          | the `retry:` hint, in milliseconds                                |

A provider's streamed reply is its provider's stub, not an `http` one: `openai.stream(pieces)` and `anthropic.stream(pieces)` serve the text as the provider does under `stream: true`, one delta per piece in order, so the unit sits in `stubs/openai/` or `stubs/anthropic/` with the request it answers.

| Builder                                       | Wire                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `openai.stream(pieces)`                       | Chat Completions: unnamed `chat.completion.chunk` events — the role, the deltas, the finish — then `data: [DONE]` |
| `openai.stream(pieces, { api: 'responses' })` | Responses: named, numbered events, one `response.output_text.delta` per piece, `response.completed` last          |
| `anthropic.stream(pieces)`                    | Messages: `message_start`, a text block, a `ping`, one `text_delta` per piece, `message_stop` last                |

Both take `delay`, the milliseconds between two events. Any other server-sent stream is an `http.sse()` stub.

```typescript
// specs/api/assistant/stubs/openai/greeting.ts
import { defineStub, openai } from '@jterrazz/test';

export default defineStub({
    request: openai.chat({ user: 'Say hello' }),
    response: openai.stream(['Hel', 'lo, ', 'world']),
});
```

### Dynamic responses

A `response` may be a function of the incoming request — `(request: MatchableRequest) => StubResponse` — evaluated per served request:

```typescript
import { defineStub, http } from '@jterrazz/test';

export default defineStub({
    request: http.post('https://gateway.shoply.dev/v1/echo'),
    response: (request) => http.json({ received: request.body }),
});
```

The `request` handed to it is the same `MatchableRequest` the match ran on: `{ body, headers, url }`, with `body` already parsed when the payload is JSON. Prefer a fixed response whenever the reply is known ahead of time — a dynamic one is for echo endpoints, request-derived ids, and per-call variation.

## Strict by construction (rule D7)

The moment a chain declares one stub, the network is guarded: every outgoing request during the action must match a declared, non-exhausted stub. Anything else fails the spec with an explicit error that rejects the action promise (never an unhandled rejection):

```
found: an unmatched outgoing request, POST https://api.openai.com/v1/chat/completions; declared:
  - POST https://api.openai.com/v1/chat/completions (exhausted after 1)
why: From its first stub, a chain’s network is strict: every outgoing request matches a declared stub.
fix: declare a stub for POST https://api.openai.com/v1/chat/completions — or raise the `times` of the one it exhausted
read: docs/19-linting.md#d7-strict-intercepts
```

At chain end the same channel verifies `required` stubs: one that was declared and never requested fails the spec, naming its route.

### `required` is verified per terminal action

A chain's scope is ONE terminal action, and a stub's `required` is checked at the end of it — not at the end of the test, and not at the end of the file. A spec that declares a stub and then performs two actions has declared it for the first one: the second starts a fresh registration, and a `required` stub unmet by the action it belongs to fails that action's chain.

This is the same boundary rule B1 already states from the other side — one chain, one action — read from the stub's end. A test that wants a stub to hold across two actions writes two chains, each declaring what it expects to see.

Two scoping notes:

- **A chain with zero stubs does not guard its network** — a deliberate, documented boundary.
- **A rendered component is the exception.** Its network is strict even with no stub declared, because a page shares its process with nothing else the test does — [07 — Component specs](07-component.md#unique-here).

## Pitfalls

- **Reaching into a kind folder from a test.** `import events from './stubs/http/events.js'` is an error (C10). Add a named scenario export to the facade instead — that is what facades are for.
- **Pinning a prompt by copying it.** A 550-line prompt pasted into a stub is a fossil. Import the app's real builder, or match a stable prefix with `match.includes` — the stub pins the _interaction_, not the wording.
- **Expecting a substring to match.** Provider string filters are exact. A prompt that "should obviously match" but does not is almost always a whitespace or a template difference — use `match.includes` if that is genuinely what you mean.
- **Writing a call count as a loop.** `for (…) chain.intercept(garbage)` is `times: 8`. The loop hides the number the spec is actually asserting.
- **Relying on declaration specificity instead of order.** Selection is first-match. `.with()` prepends precisely so an override wins without deleting the generic route — outside `.with()`, order is yours to get right.
- **Letting a pipeline hit the network.** An unintercepted call is a test escaping the sandbox, not extra realism. Once one stub is declared, D7 turns a stray call into a failure.
- **Duplicating a payload.** The 45-line article exists ONCE, as a `.response.json`; the second stub imports it.

## Related

[10 — API specs](10-api.md) · [11 — Job specs](11-job.md) · [08 — Website specs](08-website.md) · [09 — Mobile specs](09-mobile.md) · [18 — Conventions](18-conventions.md)
