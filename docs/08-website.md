# 08 — Website specs (`specification.website`)

`specification.website()` tests a rendered website — its raw HTTP surface (redirects, robots.txt, headers) and its rendered surface (title, head metadata, JSON-LD, console, and full user scenarios) — through a real chromium instance. It starts the site itself, or targets one already running.

Use it when the subject under test is a browser-rendered page. For a JSON/HTTP API surface use [api](10-api.md); for a binary use [cli](12-cli.md).

## What it specifies

A website spec answers one question: **given this backend and this visitor, what does the served site put on the screen, and what does it report to the console?** The subject is the assembled product met through an address — a running server the runner started, or a deployment already up — and everything it reads is what a visitor can see: the rendered text, the accessibility tree, the document head, the console. A single rendered unit inside that page is a component spec ([07](07-component.md)); a route module or a loader behind it is a module test ([05](05-module-tests.md)).

## The constructor

Exactly one of `server` (start the site locally) or `url` (target a running site) is required — passing both, or neither, throws immediately.

```typescript
// specs/website/website.specification.ts
import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, website } = await specification.website({
    server: { command: 'node specs/_fixtures/website-app/server.mjs', ready: '/' },
});

afterAll(cleanup);
```

```typescript
// targeting a deployed preview instead of starting one
export const { cleanup, website } = await specification.website({
    url: 'https://preview-1234.my-site.pages.dev',
});
```

### Options

| Option     | Description                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server`   | How the site is started locally: a `process()`, the `ProcessOptions` object itself, or `(services) => …` returning either. Exactly one of `server` / `url`                  |
| `url`      | Target an already-running site (deployed, preview, dev server). Exactly one of `server` / `url`                                                                             |
| `services` | A named record started BEFORE the site and stopped with it — a database it reads, a `process()` backend it calls. See [Services beside the site](#services-beside-the-site) |
| `backend`  | `{ env, port? }` — start a declared stub backend and inject its URL into the server child. Requires `server` mode — see [Declared backend](#declared-backend)               |
| `external` | `'allow' \| 'block'` — cross-origin policy for `.visit()`. Default `'block'` with `server`, `'allow'` with `url` — see [Cross-origin policy](#cross-origin-policy-external) |
| `root`     | **Project-root override** (rule A9): the cwd of the `server` command. Auto-discovered from the calling file when absent. Not a fixtures root                                |

`server` is a `ProcessOptions`, whatever of the three forms states it — `command`, `ready`, `port`, `cwd`, `env`, `before`, `timeout`. That shape has one owner, and it is not this chapter: [17 — Services § `process()`](17-services.md#process--the-one-shape-an-external-process-takes) holds every field, because a website's server is an external process like any other the framework owns.

The chosen port is injected as `PORT` — the command reads it the same way it would in production. If the process never answers on `ready` within `timeout`, or exits first, `specification.website()` fails with the command's captured output attached. On teardown the child is terminated by process group (SIGTERM, escalating to SIGKILL after a 2 s grace) — the same escalation as the [cli](12-cli.md) exec adapter, so a framework's own child processes don't outlive the run.

The handle destructures to `{ website, cleanup, url }` (rule A3) — no `docker`: a browser is not a container. `url` is the resolved base URL — the one the server started on, or the `url` option with its trailing slash trimmed.

### Services beside the site

A site under test is rarely alone: it reads a database, or it calls an API that must be up before the first page is requested. `services` is that record — the same one every other facet takes ([17 — Services](17-services.md)) — started before the site, in declaration order, and stopped with the specification.

That is why `server` may be a FUNCTION of the record: the site is handed the URL of the thing it was started beside, resolved once that thing is listening rather than guessed at config time.

```typescript
import { postgres, process, specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, website } = await specification.website({
    server: (services) =>
        process({
            command: 'next dev',
            env: { NEXT_PUBLIC_API_URL: services.api.connectionString },
        }),
    services: {
        api: process({ command: 'bin/server web --port $PORT', ready: '/health' }),
        db: postgres(),
    },
});

afterAll(cleanup);
```

A declared database is not seeded by the chain — a website chain has no `.seed()`. It is seeded by whatever owns it: the service's own `docker/<service>/init.sql`, or a `before:` command on the `process()` that migrates it.

## The chain

### Two terminal actions: `.fetch()` and `.visit()`

#### `.fetch(path)` — one raw HTTP exchange

`.fetch(path)` performs a single request and never follows redirects — the redirect itself is the result, not something to chase:

```typescript
test('surfaces a permanent redirect without following it', async () => {
    // Given - the legacy path
    const result = await website.fetch('/old');

    // Then - the 308 IS the result, with its target readable
    expect(result.status).toBe(308);
    expect(result.location).toBe('/');
});

test('serves robots.txt as plain text', async () => {
    // Given - the robots surface
    const result = await website.fetch('/robots.txt');

    // Then - the whole file matches one golden
    expect(result.headers['content-type']).toBe('text/plain');
    expect(result.body).toMatch('robots.txt');
});
```

`FetchResult` accessors:

| Member            | Type                  | Description                                                |
| ----------------- | --------------------- | ---------------------------------------------------------- |
| `result.status`   | `number`              | HTTP status — 3xx surfaces exactly as sent, never followed |
| `result.location` | `string \| undefined` | The `location` header, or undefined                        |
| `result.headers`  | flat map              | Response headers, lower-cased keys                         |
| `result.body`     | `TextAccessor`        | Raw response body — `toMatch('robots.txt')`, `.grep()`     |
| `result.json`     | `JsonAccessor`        | Response body parsed as JSON                               |

#### `.visit(path, scenario?)` — a rendered page

`.visit()` renders the page in a real chromium and resolves with the captured document. There is **one browser process per runner**, launched lazily on the first `.visit()` — a spec file that only calls `.fetch()` never pays the browser-launch cost. Each visit gets a fresh, isolated browser context.

```typescript
test('captures the full head surface of a rendered page', async () => {
    // Given - the fixture homepage
    const result = await website.visit('/');

    // Then - one golden covers title, canonical, alternates, and metas
    expect(result.status).toBe(200);
    expect(result.head).toMatch('home.head.json');
});
```

### Visit scenarios — the When

A scenario is the interaction that happens **before** the capture — the visit's When. The capture always reflects the **final** page state, after the scenario ran:

```typescript
test('subscribes through the form and captures the final state', async () => {
    // Given - a visitor on the homepage
    const result = await website.visit('/', async (visitor) => {
        // When - they fill the form and subscribe
        await visitor.fill(field('Email'), 'visitor@site.test');
        await visitor.click(button('Subscribe'));
        await visitor.see(content('Thanks for subscribing'));
    });

    // Then - the capture reflects the page after the interaction
    expect(result.content).toContain('Thanks for subscribing');
    await expect(result.errors).toBeEmpty();
});
```

**No `expect()` inside a scenario (rule W1).** A scenario is pure interaction — assertions live in the Then, on the returned result. Splitting interaction from assertion keeps the setup → action → result grammar intact, and keeps scenarios replayable independent of what they're checked against.

The visitor's verbs and the words it names elements with are [13 — Elements](13-elements.md)'s, whole: `click` `fill` `press` `select` `check` `hover` `goto` `see` `gone`, the descriptors and the landmarks, the `focused` / `disabled` / `selected` / `valued` modifiers, `within()`, exact names and `testId()`. One vocabulary, three surfaces — this chapter adds none of its own and redefines none of them. Two things are website-specific and stated there: `goto(path)` navigates within the site under test, and the ARIA landmarks are this facet's and the component facet's, never the device's.

Designating exactly one element is rule W3, and the refusal it prints — the candidates, the accessible name each matched on, and what each suggested fix LEAVES — is [13 — Elements § Designating exactly one element](13-elements.md#designating-exactly-one-element).

Navigating within a scenario changes what the capture describes:

```typescript
test('navigates to another page and captures where it landed', async () => {
    // Given - a visitor on the homepage
    const result = await website.visit('/', async (visitor) => {
        // When - they follow the articles link
        await visitor.click(link('Articles'));
    });

    // Then - the result is the destination page
    expect(result.url).toContain('/articles');
    expect(result.content).toContain('All articles');
});
```

### Setup: `.headers()`

`.headers({...})` sets HTTP headers for both terminal actions — the raw `.fetch()` exchange and the browser context behind `.visit()`. Repeated calls merge. The main use case is a User-Agent override, e.g. asserting on what an AI crawler sees:

```typescript
test('sends chain headers on the raw exchange', async () => {
    // Given - an AI crawler user agent
    const result = await website.headers({ 'User-Agent': 'GPTBot/1.0' }).fetch('/robots.txt');

    // Then - the exchange succeeds like any other client
    expect(result.status).toBe(200);
    expect(result.body).toContain('Allow: /');
});
```

### Setup: `.clock()`

`.clock('2026-03-04T09:30:00Z')` pins the calendar of the PAGE — what the site's own scripts read when they call `new Date()` — before the first byte is parsed, so a stamp rendered on load is the stated instant and not the moment the navigation happened to start. It is released with the visit.

```typescript
test('stamps the moment the page was opened', async () => {
    // Given - the page's calendar pinned for this visit
    const result = await website.clock('2026-03-04T09:30:00Z').visit('/clock');

    // Then - the rendered stamp is the stated instant
    expect(result.content).toContain('2026-03-04T09:30:00.000Z');
});
```

A `.fetch()` opens no page, so it has no clock to pin: the chain refuses the pairing rather than ignoring it. Assert the moment of a raw exchange with a `{{iso8601}}` token in its golden. The primitive behind the setup is [18 — Conventions § Time](18-conventions.md#time--one-primitive-two-depths).

## The result

| Member              | Type                  | Description                                                                     |
| ------------------- | --------------------- | ------------------------------------------------------------------------------- |
| `result.status`     | `number`              | HTTP status of the main document response                                       |
| `result.url`        | `string`              | Final URL — after redirects and any scenario navigation                         |
| `result.title`      | `TextAccessor`        | `document.title`                                                                |
| `result.head`       | `JsonAccessor`        | `{ title, canonical, alternates, metas }` — the one-golden-per-page SEO surface |
| `result.jsonLd`     | `JsonAccessor`        | Every `application/ld+json` block, parsed, as one array                         |
| `result.meta(name)` | `string \| undefined` | Content of a named meta — `.meta('description')`, `.meta('og:image')`           |
| `result.canonical`  | `string \| null`      | The canonical `<link>` href, or null                                            |
| `result.alternates` | flat map              | Hreflang alternates, keyed by language code                                     |
| `result.links`      | array                 | `<link>` elements of the head, in DOM order                                     |
| `result.content`    | `TextAccessor`        | Rendered body text (`document.body.innerText`)                                  |
| `result.html`       | `TextAccessor`        | Full serialized DOM (`document.documentElement.outerHTML`)                      |
| `result.console`    | `TextAccessor`        | Every console message, one `[type] text` line per message                       |
| `result.errors`     | `TextAccessor`        | Console messages of type `error` only                                           |
| `result.tree`       | `TextAccessor`        | The ARIA snapshot of the rendered `<body>` — the page's outline, as a golden    |

### `result.tree` — the outline, as the accessibility tree draws it

```typescript
test('lays the article out as a reader walks it', async () => {
    // Given - the fixture article page
    const result = await website.visit('/articles/hexagonal');

    // Then - the outline is what a screen reader would walk
    expect(result.tree).toMatch('article.aria.yaml');
});
```

It is produced by the same Playwright `ariaSnapshot()` the component facet calls, so a page's outline and a component's outline are the same kind of golden and comparable to each other. Deterministic where a screenshot is not, and it says what the markup MEANS rather than what it is made of.

### The `head` golden — one per page

`result.head` is the **stable, assertion-friendly projection** of the document head — title, canonical, hreflang alternates, and named metas collapsed into one object. It is the one golden a page needs for its SEO surface:

```typescript
test('exposes canonical, alternates, and named metas directly', async () => {
    // Given - the fixture homepage
    const result = await website.visit('/');

    // Then - the accessors read the head without a golden…
    expect(result.canonical).toBe('https://site.test/');
    expect(result.alternates['x-default']).toBe('https://site.test/');
    expect(result.meta('og:title')).toBe('Fixture — Home');

    // …or snapshot the whole surface at once
    expect(result.head).toMatch('home.head.json');
});
```

Structured data gets the same treatment — every `ld+json` block on the page, in one golden:

```typescript
test('parses every json-ld block into one array', async () => {
    const result = await website.visit('/');

    expect(result.jsonLd).toMatch('home.jsonld.json');
});
```

### Console assertions

The console splits into the full stream and the error-only stream — the same shape as `stdout`/`stderr` on a cli result:

```typescript
test('keeps a clean page silent on both streams', async () => {
    // Given - the healthy homepage
    const result = await website.visit('/');

    // Then - no console output at all
    await expect(result.console).toBeEmpty();
    await expect(result.errors).toBeEmpty();
});

test('separates console errors from the full stream', async () => {
    // Given - a page that logs and errors
    const result = await website.visit('/noisy');

    // Then - the full stream carries both, the error stream only the error
    expect(result.console).toMatch('noisy.console.txt');
    expect(result.errors).toContain('boom');
});
```

## Unique here

### Declared backend

A site under test usually talks to an API. The `backend` option starts a small **stub backend** (plain `node:http`, no extra dependency) BEFORE the server command and injects its URL into the server child's environment under `backend.env` — the site reads it the same way it would in production:

```typescript
// specs/website/website.specification.ts
export const { cleanup, website } = await specification.website({
    server: { command: 'npm run start', ready: '/' },
    backend: { env: 'API_URL' },
});

afterAll(cleanup);
```

| `backend` field | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| `env`           | Env var receiving the stub's URL in the server child (e.g. `'API_URL'`)           |
| `port`          | Fixed port — pins a stable stub URL across runs. Default: a free OS-assigned port |

`backend` requires `server` mode — with `url` it refuses (the type already forbids the combination): a deployed site cannot be pointed at a local stub. The **ownership boundary**: the framework owns the server child, so it injects the env var itself — that is the whole wiring.

What the stub serves is declared per chain, as [contracts](16-contracts.md) — the feature's `contracts/` facade, exactly the form `api`/`jobs` use:

```typescript
import newsroom from './contracts/newsroom.contracts.js';

test('renders the events feed from the declared backend', async () => {
    // Given - the backend under contract for this chain
    const result = await website.intercept(newsroom).visit('/events');

    // Then - the page rendered what the stub declared
    expect(result.content).toContain('Enquête Fauci COVID-19');
    await expect(result.errors).toBeEmpty();
});
```

The stub **resets between chains** the way databases do: one chain = one terminal action, and its contracts replace the previous chain's wholesale. Selection is the shared one: the first declared contract that matches and is not exhausted wins, and a contract with no `times` is unlimited — so a page re-fetching the same endpoint (re-render, retry) replays it.

Strictness is the analog of `external: 'block'`: a request matching no declared contract is answered **501** (a JSON body naming the path and listing the declared routes) and **recorded** — when the `.visit()` completes, the action **throws** an error enumerating every unmatched request (method, path, count). The failure evidence (screenshot on a scenario error) is captured first, as always. A chain with **zero** intercepts leaves the stub unguarded — the same boundary as MSW never mounting without an `.intercept()`.

Two pieces of plumbing are handled for you:

- **CORS** — the stub answers the `OPTIONS` preflight and stamps permissive `Access-Control-Allow-*` headers on every response, so client-side fetches from the site's origin just work.
- **`external: 'block'`** — the stub's origin is allow-listed automatically; declared-backend fetches are never aborted as third-party noise.

### Cross-origin policy (`external`)

`external: 'block'` aborts every request leaving the site under test during a `.visit()` — analytics beacons, third-party CDNs, ad scripts never fire, so a visit stays deterministic. `'allow'` lets them through.

The default follows the mode: `'block'` with `server` (you own the deployment, third-party noise is not the point), `'allow'` with `url` (a deployed site legitimately loads third-party assets). Override with the top-level `external` option when a spec needs the opposite of its mode's default.

### Evidence on failure

When a scenario throws — an element never becomes visible, a `see()` times out — the error carries a full-page screenshot of the state the scenario died in, referenced by its temp path in the error message. The original error is never masked; the screenshot is attached evidence, not a replacement.

### Playwright — the optional peer

Playwright is not a hard dependency: `.fetch()`-only spec files never need it. `.visit()` imports it lazily, and needs it installed:

```bash
npm install -D playwright && npx playwright install chromium
```

Calling `.visit()` without playwright installed throws exactly that guidance — there is nothing else to search for.

Provisioning the environment is not this package's job. In CI, the shared validate workflow does it: `browsers: true` (jterrazz-actions) installs cached chromium, versioned from the caller's lockfile, between Build and Test. On a workstation, `j install` provisions `playwright-browsers` once.

### Folder layout

```
specs/website/
├── website.specification.ts    # runner at the facet ROOT (rule C1)
└── <domain>/
    ├── <aspect>.spec.ts
    ├── _expected/                # ALL expected fixtures, FLAT (*.head.json, *.jsonld.json, *.console.txt, …)
    └── contracts/               # what the declared backend serves — with the `backend` option
        ├── newsroom.contracts.ts
        └── http/…
```

No `_seeds/` or `_requests/` — a website chain has no `.seed()` setup and no request-file format, whatever its runner declares under `services`; `.fetch()`/`.visit()` calls are inline, and the golden is always `_expected/<name>`.

## Pitfalls

- **Passing both `server` and `url`, or neither.** The options type makes the invalid combinations inexpressible — the compiler rejects them before anything runs.
- **Using `expect()` inside a scenario callback.** Forbidden (rule W1) — the scenario is the When; assertions belong on the result the `.visit()` promise resolves to.
- **Reaching for `testId()` as the default locator.** It exists as an escape hatch (rule W2 warns) — prefer `button`/`link`/`field`/`heading`/`content`, the same vocabulary a user's accessibility tree exposes.
- **Reaching for `testId()` to escape an ambiguity.** It silences the refusal without answering it: the test stops asserting the role and the accessible name, which is most of what a user-facing element was buying. Scope it with `within()` instead — that is the fix rule W3 is pointing at.
- **Assuming a name still matches as a substring.** It does not since 16.0: `link('Articles')` no longer reaches "Read Articles". Pass `{ exact: false }` when a part of the name is genuinely outside the test's control.
- **Using `see()` to prove something went away.** It cannot: an element that never appeared and one that disappeared read the same to it. `gone(element)` is the absence primitive.
- **Snapshotting the tree to prove focus.** The accessibility tree carries none — `see(focused(x))` is the assertion that does. Enablement and selection it DOES carry (`[disabled]`, `[selected]`), so those a golden may pin; `see(disabled(x))` is for the one control a test is about.
- **Calling `.visit()` without playwright installed.** The error names the exact fix — `npm install -D playwright && npx playwright install chromium` — there is no silent fallback.
- **Expecting `.fetch()` to follow redirects.** It never does — the 3xx status and `location` header ARE the result; chase the target with a second `.fetch()` if the spec needs to.
- **Assuming `external` defaults the same way in both modes.** It flips with the constructor mode: `'block'` with `server`, `'allow'` with `url` — pass it explicitly to override.
- **Reading `result.head` field-by-field instead of snapshotting it.** It is designed as the one golden per page (`toMatch('home.head.json')`) — use the direct accessors (`canonical`, `alternates`, `meta()`) only for a single targeted probe.
- **Calling `.intercept()` without the `backend` option.** It throws immediately, naming the fix: add `backend: { env: '…' }` to the `specification.website()` options — a chain's `.http` exchanges need a stub to serve them.
- **Combining `backend` with `url` mode.** The type forbids it and the runtime refuses: a deployed site reads its API URL at its own deploy time — there is nothing a local stub could inject into.

## Related

[02 — Developing](02-developing.md) · [14 — Assertions](14-assertions.md) · [15 — Tokens](15-tokens.md) · [09 — Mobile specs](09-mobile.md) · [07 — Component specs](07-component.md)
