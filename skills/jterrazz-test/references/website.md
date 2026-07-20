# Website specs — `specification.website()`

Operative reference. Prose + examples: [docs/11-website.md](../../docs/11-website.md). Assertions: [docs/05-assertions.md](../../docs/05-assertions.md). Tokens: [references/tokens.md](tokens.md).

Tests a rendered site — raw HTTP surface via `.fetch()`, rendered surface via `.visit()` in a real chromium. No services, no seeding, no `mode` — this facet is about a browser, not a database.

## Runner (in `*.specification.ts`, `afterAll(cleanup)`)

```typescript
export const { website, cleanup } = await specification.website({
    server: { command: 'node server.mjs', ready: '/' }, // XOR `url`
});
afterAll(cleanup);
```

Returns `{ website, cleanup, url }` — no `docker`, no `orchestrator`. Checklist:

- Exactly one of `server` / `url` — both or neither throws immediately.
- `server: { command, ready?, port?, timeout? }` — a free OS port injected as `PORT`, polled on `ready` (default `/`, any HTTP status counts as ready), `timeout` default 30 000 ms. On teardown: SIGTERM, then SIGKILL after a 2 s grace (same escalation as the cli exec adapter).
- `url` — target a running/deployed site instead of starting one.
- `external: 'allow' | 'block'` — cross-origin requests during `.visit()`. Default `'block'` with `server`, `'allow'` with `url`.
- `root` — cwd of the `server` command (A9 override); auto-discovered when absent.

## Two terminal actions

| Method                    | Resolves to   | Notes                                                                                  |
| ------------------------- | ------------- | -------------------------------------------------------------------------------------- |
| `.fetch(path)`            | `FetchResult` | ONE raw HTTP exchange — redirects NEVER followed, the 3xx status IS the result         |
| `.visit(path, scenario?)` | `PageResult`  | Renders in the shared chromium; a scenario is the When, the capture is the FINAL state |

One browser process per runner, launched **lazily** on the first `.visit()` — `.fetch()`-only spec files never pay the browser cost. Each visit gets a fresh, isolated context.

## Setup: `.headers()`

`.headers({...})` sets HTTP headers for both `.fetch()` and the browser context behind `.visit()`; repeated calls merge. Typical use: a User-Agent override for AI-crawler checks (`.headers({ 'User-Agent': 'GPTBot/1.0' })`).

## Scenarios — the When (`VisitScenario`)

```typescript
const result = await website.visit('/', async (visitor) => {
    await visitor.fill(field('Email'), 'visitor@site.test');
    await visitor.click(button('Subscribe'));
    await visitor.see(content('Thanks for subscribing'));
});
```

- **No `expect()` inside a scenario (W1).** The scenario is pure interaction; assertions live in the Then, on the returned result.
- Visitor verbs: `click`, `fill`, `press`, `select`, `check`, `hover`, `goto(path)`, `see(element)`. Every action auto-waits; `see()` is the ONLY synchronization primitive (retries until visible). There are no sleeps anywhere.
- Elements are **user-facing by construction (W2)**: `button(name)`, `link(name)`, `field(label)`, `heading(name)`, `content(text)` — CSS/XPath is not expressible. `testId(id)` is the escape hatch and warns.

## Result surfaces

`FetchResult`: `status`, `location`, `headers` (flat map), `body` (`TextAccessor`), `json` (`JsonAccessor`).

`PageResult`: `status`, `url` (final, after redirects/navigation), `title`, `head` (`JsonAccessor` — `{ title, canonical, alternates, metas }`, the one-golden-per-page SEO surface), `jsonLd` (every `ld+json` block as one array), `meta(name)`, `canonical`, `alternates`, `links`, `content` (rendered body text), `html`, `console` (all messages, `"[type] text"` lines), `errors` (error-type messages only).

```typescript
expect(result.head).toMatch('home.head.json'); // one golden for the whole SEO surface
expect(result.jsonLd).toMatch('home.jsonld.json');
await expect(result.console).toBeEmpty();
expect(result.errors).toContain('boom');
```

On a scenario failure, the error carries a full-page screenshot path — the original error is never masked.

## Playwright — optional peer dependency

```bash
npm install -D playwright && npx playwright install chromium
# CI: `browsers: true` on the shared validate workflow provisions this.
```

`.visit()` without it throws exactly that guidance. `.fetch()` never needs it.

## Folder layout

```
specs/website/
├── website.specification.ts    # runner at the facet ROOT
└── <domain>/
    ├── <aspect>.test.ts
    └── expected/                # *.head.json, *.jsonld.json, *.console.txt, … — FLAT
```

No `seeds/`, `requests/`, or `contracts/` — no services, no request-file format.
