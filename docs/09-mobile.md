# 09 — Mobile specs (`specification.mobile`)

`specification.mobile()` tests a native app on the iOS simulator — its screens (the accessibility tree a user's assistive tech sees) and its flows (tap, fill, see) — through a real XCUITest session driven by appium. It resolves and boots the simulator itself, and starts the appium server from the caller project.

Use it when the subject under test is an installed native app. For a browser-rendered page use [website](08-website.md); for a JSON/HTTP API surface use [api](10-api.md).

## What it specifies

A mobile spec answers one question: **given this backend and this visitor, what does the native app draw on a simulator, and what does the screen read like to someone who cannot see it?** The subject is the installed app met through a deep link, driven by the accessibility tree the platform publishes. A React Native component rendered off a device is jest's for now, not this facet's ([07](07-component.md) states the boundary and the spike that would move it).

## The constructor

```typescript
// specs/mobile/mobile.specification.ts
import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, mobile } = await specification.mobile({
    app: { bundleId: 'com.jterrazz.fakenews' },
    device: { name: 'iPhone 17', os: '26.5' },
});

afterAll(cleanup);
```

### Options

| Option     | Description                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`      | `{ bundleId }` — the installed app under test. Every `.open()` terminates and relaunches it                                                              |
| `device`   | `{ name, os?, udid? }` — the simulator to run on, resolved through `xcrun simctl` and booted when shut down                                              |
| `backend`  | `{ port? }` — start a declared stub backend; the handle gains `backendUrl` — see [Declared backend](#declared-backend)                                   |
| `root`     | **Project-root override** (rule A9): where the `appium` binary is resolved from (`node_modules/.bin`). Auto-discovered from the calling file when absent |
| `services` | A named record started with the runner and stopped with it — a `process()` for the bundler the app loads from, a database a dev build reads              |
| `timeouts` | `{ action?, launch? }` in ms — how long this runner waits. Each field falls back to the framework's default; see [Declared timeouts](#declared-timeouts) |

`device` itself takes:

| `device` field | Description                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `name`         | Simulator name, matched exactly (`'iPhone 17'`)                                                |
| `os`           | OS narrowing when the name exists on several runtimes — `'26.5'` or `'iOS 26.5'`, case-relaxed |
| `udid`         | Explicit UDID — skips name/os resolution entirely                                              |

Resolution refuses rather than guesses: zero matches and several matches both fail with the full `simctl` device listing, so the fix never needs an Xcode round-trip. A shut-down simulator is booted (`simctl boot` + `bootstatus`); an already-booted one is reused as-is.

**`services` is where Metro goes.** A dev build loads its JavaScript from a bundler, and until now that bundler was a `beforeAll` the repository maintained, with an `afterAll` it sometimes forgot. It is a `process()` like any other external process the framework owns, started before the app is ever launched and stopped with the specification ([17 — Services](17-services.md#process--the-one-shape-an-external-process-takes)):

```typescript
import { process, specification } from '@jterrazz/test';

export const { cleanup, mobile, udid } = await specification.mobile({
    app: { bundleId: 'com.example.app' },
    device: { name: 'iPhone 17' },
    services: {
        metro: process({ command: 'expo start', ready: /Metro waiting on .*:(\d+)/u }),
    },
});
```

The appium server is spawned from the caller project's `node_modules/.bin/appium` on a free port and polled on `/status` until ready. On teardown the driver session ends and the server process group is terminated (SIGTERM, escalating to SIGKILL after a 2 s grace) — the same escalation as the [website](08-website.md) serve adapter.

The handle destructures to `{ mobile, cleanup, udid }` (rule A3) — `udid` is the resolved simulator, handy for shelling out to `simctl` in a debugging session. With the `backend` option it additionally carries `backendUrl`.

### Declared timeouts

Every verb auto-waits — there is no sleep and no conditional helper. `timeouts` states how long, for the two waits a project legitimately needs to move:

| `timeouts` field | The wait it budgets                                                                         | Default   |
| ---------------- | ------------------------------------------------------------------------------------------- | --------- |
| `action`         | one visible match, on every verb — the whole `see`/`tap`/`fill` budget, polled every 500 ms | `30_000`  |
| `launch`         | WebDriverAgent to build and launch, on a run's first session                                | `240_000` |

The defaults suit a **release** bundle: 30 s absorbs a cold app boot, the same figure playwright chose for its actionability timeout. A project driving a **dev** build pays its bundler's cold boot on top — a Metro cold start to first content measures 31–32 s, over the default — and states that wait once, on the runner, rather than sleeping inside its scenarios:

```typescript
// specs/mobile/mobile.specification.ts
export const { cleanup, mobile } = await specification.mobile({
    app: { bundleId: 'com.jterrazz.fakenews' },
    device: { name: 'iPhone 17', os: '26.5' },
    // Dev-mode Metro cold boot measured at 31-32s — over the 30s default.
    // 45s covers the cold path with margin without hiding a real hang.
    timeouts: { action: 45_000 },
});

afterAll(cleanup);
```

Raise it to the slowest **honest** path and no further: the timeout is what turns a hang into a legible refusal naming the element and what was on screen instead.

## The chain

### One terminal action: `.open(deepLink?, scenario?)`

`.open()` is terminal and deterministic: it **terminates and relaunches the app** (fresh state every spec), applies the deep link when given, runs the scenario, then captures the final screen — the projected accessibility tree plus the visible texts:

```typescript
test('shows the events feed behind its deep link', async () => {
    // Given - the events screen
    const result = await mobile.open('news://events');

    // Then - one golden covers the whole screen
    expect(result.screen).toMatch('events.screen.json');
});
```

Without a deep link, the app opens on its launch screen. There is **one driver session per runner**, created lazily on the first `.open()` and reused — the expensive part is WebDriverAgent startup, not the app relaunch.

### Open scenarios — the When

A scenario is the interaction that happens **before** the capture — the open's When. The capture always reflects the **final** screen state, after the scenario ran:

```typescript
test('bookmarks an event from its detail screen', async () => {
    // Given - a visitor on the events feed
    const result = await mobile.open('news://events', async (visitor) => {
        // When - they open the Fauci event and bookmark it
        await visitor.tap(button('Enquête Fauci COVID-19'));
        await visitor.see(content('rapports'));
        await visitor.tap(button('Bookmark'));
    });

    // Then - the capture reflects the screen after the interaction
    expect(result.content).toContain('Bookmarked');
});
```

**No `expect()` inside a scenario (rule W1).** A scenario is pure interaction — assertions live in the Then, on the returned result.

The element vocabulary is [13 — Elements](13-elements.md)'s, the same one the website and component facets name things with — there is no CSS, no XPath and no raw predicate surface. What a device does with it is this chapter's, and it is three things.

**The verbs are three.** `tap(element)` is the device's word for a click, `fill(element, value)` fills a text field, and `see(element)` is the only synchronization primitive. There is no `gone()` here: the adapter cannot answer honestly for absence on an XCUITest tree. Every verb polls until at least one visible match exists (default 30 s, sized for a cold app boot), then enforces the verb's cardinality; there are no sleeps anywhere in the framework. Actionability includes **scroll-into-view**: when a descriptor matches nothing visible but an off-screen element exists, the adapter scrolls it into view once (directly by element id) and keeps polling — elements buried in very heavy screens (a full-page WebView) may still be out of reach, so prefer a deep link then.

**Four descriptors reach a screen** — `button(name)` (accessible label, `XCUIElementTypeButton`), `field(label)` (accessible name or value, text and secure-text fields), `content(text)` (any element whose label or value contains the text) and `testId(id)` (the accessibility identifier, rule W2's escape hatch, with the line saying what the element lacks). The link, heading, dialog, table and option roles, the landmarks and the state modifiers are not part of a device's tree: passing one to a mobile verb refuses at runtime with a message naming the boundary.

**W3 is relaxed for `see()` alone.** A descriptor must match exactly one element when a verb ACTS on it, so `tap` and `fill` refuse an ambiguous one and print the candidates with their accessibility identifiers ([13 — Elements § Designating exactly one element](13-elements.md#designating-exactly-one-element)). `see()` acts on nothing, so any visible match satisfies it — an XCUITest tree legitimately exposes the same label twice, and a synchronization primitive refusing on that would punish honest screens.

A mobile scope is any descriptor, most often a `testId()` on the containing view, because iOS has no landmarks:

```typescript
await visitor.tap(within(testId('event-list'), button('Bookmark')));
```

`see()` resolving through render work is the point: a deep link into a Metro cold bundle, a network round-trip, an animation — the poll absorbs them all without a single sleep.

## The result

| Member           | Type           | Description                                                                  |
| ---------------- | -------------- | ---------------------------------------------------------------------------- |
| `result.screen`  | `JsonAccessor` | The projected accessibility tree — the one-golden-per-screen surface         |
| `result.content` | `TextAccessor` | The visible texts, one per line in reading order — the scalpel for one probe |

### The `screen` golden — one per screen

`result.screen` is the **stable, assertion-friendly projection** of the XCUITest page source. The raw source is deep and noisy — React Native wraps every view in layers of unlabeled `XCUIElementTypeOther` nodes — so the projection collapses it: wrapper nodes with no label, no value and no identifier are dropped (their children hoisted), an element repeated as its own child appears once, type names lose the `XCUIElementType` prefix, and a value or identifier merely echoing the label is omitted:

```json
{
    "type": "Application",
    "label": "SigNews",
    "children": [
        { "type": "StaticText", "label": "Signals" },
        { "type": "Button", "label": "Enquête Fauci COVID-19" },
        { "type": "TextField", "label": "Email", "value": "a@b.test", "identifier": "email-field" }
    ]
}
```

It is the one golden a screen needs:

```typescript
test('renders the events feed', async () => {
    // Given - the events screen
    const result = await mobile.open('news://events');

    // Then - the whole projected tree matches one golden
    expect(result.screen).toMatch('events.screen.json');
});
```

The tree describes the **whole mounted hierarchy**, including rows below the fold; `result.content` carries only what is visible. Volatile parts (dates, counters) are covered by the usual `{{token}}` grammar ([15 — Tokens](15-tokens.md)); generate with `TEST_UPDATE=1`.

## Unique here

### Declared backend

A native app usually talks to an API. The `backend` option starts a small **stub backend** (plain `node:http`, no extra dependency) with the runner; what it serves is declared per chain, as [contracts](16-contracts.md) — the feature's `contracts/` facade, exactly the form `api`/`jobs` use:

```typescript
// specs/mobile/mobile.specification.ts
export const { backendUrl, cleanup, mobile } = await specification.mobile({
    app: { bundleId: 'com.jterrazz.fakenews' },
    backend: { port: 4820 },
    device: { name: 'iPhone 17', os: '26.5' },
});

afterAll(cleanup);
```

```typescript
// specs/mobile/events/feed.spec.ts
import newsroom from './contracts/newsroom.contracts.js';

test('renders the events feed from the declared backend', async () => {
    // Given - the backend under contract for this chain
    const result = await mobile.intercept(newsroom).open('news://events');

    // Then - the screen rendered what the stub declared
    expect(result.screen).toMatch('events.screen.json');
});
```

| `backend` field | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| `port`          | Fixed port — pins a stable stub URL across runs. Default: a free OS-assigned port |

**The ownership boundary.** The framework owns the simulator and the appium server — it does NOT own the JS bundler: Metro belongs to the caller's repo, exactly like `next build` belongs to a website's. So nothing is injected anywhere; the handle exposes `backendUrl` and **the caller wires it into its own bundler env** (e.g. `EXPO_PUBLIC_API_URL=<backendUrl> npx expo start`). This is why `port` exists: Metro inlines `EXPO_PUBLIC_*` values at bundle-serve time, and a stable port lets a warm Metro survive between runs instead of re-bundling against a fresh URL.

The stub behaves exactly as on the website facet ([08 — Website specs](08-website.md#declared-backend)): it **resets between chains** (one chain = one terminal action); selection is the shared queue (first non-exhausted match wins, no `times` = unlimited); a request matching no declared contract is answered **501 and recorded**, and the `.open()` then **throws** an error enumerating every unmatched request (method, path, count) — screenshots and other failure evidence are captured first, as always. A chain with zero contracts leaves the stub unguarded.

### Evidence on failure

When a scenario throws — an element never appears, a `see()` times out — the error carries a screenshot of the state the scenario died in, referenced by its temp path in the error message. A timeout additionally includes a compact excerpt of the labels currently on screen, so the failure reads without relaunching anything. The original error is never masked.

### Requirements — what the machine must have

Provisioning the simulator environment is not this package's job. The framework needs, in this order:

1. **Xcode + an iOS simulator** — `xcrun simctl list devices` must show the device named in `device`.
2. **The app installed on that simulator** — `.open()` launches by bundle id; it does not build or install. Install with your build tooling (`xcrun simctl install <udid> <path>.app`, Expo/EAS, xcodebuild).
3. **appium + webdriverio + the XCUITest driver** in the caller project — both are optional peer dependencies:

```bash
npm install -D appium webdriverio && npx appium driver install xcuitest
```

Calling `specification.mobile()` (or `.open()`) without them throws exactly that guidance — there is nothing else to search for.

### Folder layout

```
specs/mobile/
├── mobile.specification.ts     # runner at the facet ROOT (rule C1)
└── <domain>/
    ├── <aspect>.spec.ts
    ├── _expected/                # ALL expected fixtures, FLAT (*.screen.json, …)
    └── contracts/               # what the declared backend serves — with the `backend` option
        ├── newsroom.contracts.ts
        └── http/…
```

No `_seeds/` or `_requests/` — `specification.mobile()` has no `services` option and no request-file format; `.open()` calls are inline, and the golden is always `_expected/<name>`.

## Pitfalls

- **Using `expect()` inside a scenario callback.** Forbidden (rule W1) — the scenario is the When; assertions belong on the result the `.open()` promise resolves to.
- **The first session builds WebDriverAgent (~40 s, once per simulator).** Subsequent sessions on a warm simulator are seconds. Budget the first run; do not "fix" it with retries.
- **Passing a landmark (`main()`, `navigation()`) to a mobile verb.** They are website concepts — iOS has no ARIA regions; the runtime refusal points at `within(testId('…'), …)` as the scoping tool.
- **Reaching for `testId()` as the default locator.** It exists as an escape hatch (rule W2 warns) — prefer `button`/`field`/`content`, the vocabulary the accessibility tree exposes to a real user.
- **Assuming a name still matches as a substring.** It does not since 16.0: `button('Bookmark')` no longer reaches "Bookmark all". Pass `{ exact: false }` when a part of the label is genuinely outside the test's control.
- **Expecting `.open()` to preserve app state between specs.** It never does — every open terminates and relaunches the app; a flow that spans screens belongs in ONE scenario.
- **Asserting on off-screen content with `result.content`.** `content` carries only _visible_ texts; the mounted-but-offscreen rows live in `result.screen`. Use the golden for the whole list, `content` for what the user currently sees.
- **Calling `specification.mobile()` without appium installed.** The error names the exact fix — `npm install -D appium webdriverio && npx appium driver install xcuitest` — there is no silent fallback.
- **Pointing `device.name` at an ambiguous simulator.** When the same name exists on several OS runtimes the constructor refuses with the listing — narrow with `os:` (or pin `udid:`), do not delete simulators to make it pass.
- **Calling `.intercept()` without the `backend` option.** It throws immediately, naming the fix: add `backend: { … }` to the `specification.mobile()` options — a chain's `.http` exchanges need a stub to serve them.
- **Sleeping around a slow boot instead of declaring it.** A dev bundle that boots past the 30 s default makes every verb refuse; the answer is `timeouts: { action: … }` on the runner, once — an arbitrary wait inside a scenario is untyped, per-spec, and hides the next regression.
- **Expecting the framework to point the app at the stub.** It never touches the bundler — that is the caller's territory. Wire `backendUrl` into your own bundler env (`EXPO_PUBLIC_API_URL`), and pin `port` so a warm Metro keeps its inlined URL.

## Related

[02 — Developing](02-developing.md) · [14 — Assertions](14-assertions.md) · [15 — Tokens](15-tokens.md) · [08 — Website specs](08-website.md)
