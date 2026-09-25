# 09 — Mobile specs (`specification.mobile`)

`specification.mobile()` tests a native app on the iOS simulator — its screens (the accessibility tree a user's assistive tech sees) and its flows (tap, fill, see) — through a real XCUITest session driven by appium. It resolves and boots the simulator itself, and starts the appium server from the caller project — unless it is pointed at an Appium server someone else runs.

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

| Option     | Description                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app`      | `{ bundleId }` — the installed app under test. Every `.open()` terminates and relaunches it                                                                                                                                                                        |
| `appium`   | `{ url }` — an Appium server already running, connected to instead of spawned; see [A declared Appium server](#a-declared-appium-server)                                                                                                                           |
| `device`   | `{ name, os?, udid? }` — the simulator to run on, resolved through `xcrun simctl` and booted when shut down — or, under `appium`, asked of the server. Left out under a [`mobile({ device })` project](#one-session-per-run), which owns it; refused anywhere else |
| `backend`  | `{ port? }` — start a declared stub backend; the handle gains `backendUrl` — see [Declared backend](#declared-backend)                                                                                                                                             |
| `root`     | **Project-root override** (rule A9): where the `appium` binary is resolved from (`node_modules/.bin`). Auto-discovered from the calling file when absent                                                                                                           |
| `services` | A named record started with the runner and stopped with it — a `process()` for the bundler the app loads from, a database a dev build reads                                                                                                                        |
| `timeouts` | `{ action?, launch? }` in ms — how long this runner waits. Each field falls back to the framework's default; see [Declared timeouts](#declared-timeouts)                                                                                                           |

`device` itself takes:

| `device` field | Description                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `name`         | Simulator name, matched exactly (`'iPhone 17'`)                                                |
| `os`           | OS narrowing when the name exists on several runtimes — `'26.5'` or `'iOS 26.5'`, case-relaxed |
| `udid`         | Explicit UDID — skips name/os resolution entirely                                              |

Resolution refuses rather than guesses: zero matches and several matches both fail with the full `simctl` device listing, so the fix never needs an Xcode round-trip. A shut-down simulator is booted (`simctl boot` + `bootstatus`); an already-booted one is reused as-is.

**`services` is where Metro goes.** A dev build loads its JavaScript from a bundler. It is a `process()` like any other external process the framework owns, started before the app is ever launched and stopped with the specification ([17 — Services](17-services.md#process--the-one-shape-an-external-process-takes)):

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

Without a declared `appium`, and unless the run already serves one ([One session per run](#one-session-per-run)), the server is spawned from the caller project's `node_modules/.bin/appium` on a free port and polled on `/status` until ready. On teardown the runner's driver session ends and the server is ended the way every `process()` is ([17 — Services § `process()`](17-services.md#process--the-one-shape-an-external-process-takes)).

The handle destructures to `{ mobile, cleanup, udid }` (rule A3) — `udid` is the resolved simulator, handy for shelling out to `simctl` in a debugging session; under a declared `appium` server it is the `device.udid` you named, or absent. With the `backend` option it additionally carries `backendUrl`.

### A declared Appium server

`appium: { url }` points the runner at a server someone else runs — a device farm, a Mac across the network, the protocol double this package specifies its own mobile facet against. The runner connects to it instead of spawning the project's own, and it hands the server the device by capabilities (`appium:deviceName`, `appium:platformVersion` from `os`, `appium:udid` when declared) instead of resolving and booting it through `simctl`: the machine the server runs on owns its simulators. `cleanup` stops nothing it did not start, and under `mobile()` the run's one session outlives it ([One session per run](#one-session-per-run)).

```typescript
export const { cleanup, mobile } = await specification.mobile({
    app: { bundleId: 'com.jterrazz.fakenews' },
    appium: { url: 'http://mac-mini.local:4723' },
    device: { name: 'iPhone 17', os: '26.5' },
});
```

### One session per run

Under a server that outlives the file — a declared `appium` server, or the run's own — a `mobile()` project opens **one driver session for the whole run**, not one per spec file. The project's global setup hands every file an empty ledger under `.artifacts/vitest/mobile-sessions/`. The first `.open()` of the run creates the session and records it there, and every later file asking the same server for the same capabilities attaches to it instead of creating its own. `cleanup` leaves that session alone; the setup ends it once the last file has run. Global setups tear down in the reverse of their order, so a setup of the project's own that SERVES the declared Appium server — a protocol double, a server started for the run — is listed before `mobile()`'s: the run's session is then ended while its server still answers.

**The run's own server** is the project's to declare: `mobile({ device, root })` names the simulator and where the `appium` binary is resolved from (`<root>/node_modules/.bin/appium`, `root` read against the config's root, `.` when absent). The project's global setup resolves and boots that simulator, spawns the server once for the run, and hands both to the workers. A runner with no `appium` of its own drives that server on the project's device and spawns nothing. The device is the project's to own, so a runner leaves `device` out and drives the project's; one that states it restates the project's, and the booted simulator's UDID stands in when it names none. A `device` that names another simulator, another runtime (`'iOS 26.5'` and `'26.5'` are one, as they are to resolution) or another UDID is refused, naming both devices: the setup booted the project's device alone. The setup stops the server once it has ended the run's sessions.

```typescript
// vitest.config.ts — one simulator, one Appium server, one session for the run
mobile({ device: { name: 'iPhone 17', os: '26.5' }, root: 'apps/mobile' }),
```

The session is keyed on the server's URL and the capabilities asked for, so a second specification naming another app — or, under a declared `appium` server, another device — gets a session of its own, recorded and ended the same way. Files still run one at a time (`fileParallelism: false` is `mobile()`'s default): the app is terminated and relaunched by every `.open()`, and two files driving it at once would fight over it.

Two runs keep a session per runner instead, which `cleanup` ends:

- **A project written by hand**, with no `mobile()`: nothing provides the ledger.
- **A server the runner spawns itself**, under a `mobile()` project that declares no `device`. It stops with the runner that started it, so its session cannot outlive the file.

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
    expect(result.screen).toMatch(file('./expected/events.screen.json'));
});
```

Without a deep link, the app opens on its launch screen. The driver session is opened lazily on the first `.open()` and reused — the expensive part is WebDriverAgent startup, not the app relaunch. How long it lives is [one session per run](#one-session-per-run)'s.

### Open scenarios — the When

A scenario is the interaction that happens **before** the capture — the open's When. The capture always reflects the **final** screen state, after the scenario ran:

```typescript
test('bookmarks an event from its detail screen', async () => {
    // Given - a visitor on the events feed
    const result = await mobile.open('news://events', async (visitor) => {
        // When - they open the Fauci event and bookmark it
        await visitor.tap(button('Enquête Fauci COVID-19'));
        await visitor.see(content('12 rapports publiés'));
        await visitor.tap(button('Bookmark'));
    });

    // Then - the capture reflects the screen after the interaction
    expect(result.content.text).toContain('Bookmarked');
});
```

**No `expect()` inside a scenario (rule W1).** A scenario is pure interaction — assertions live in the Then, on the returned result.

The element vocabulary is [13 — Elements](13-elements.md)'s, the same one the website and component facets name things with — there is no CSS, no XPath and no raw predicate surface. What a device does with it is this chapter's, and it is three things.

**The verbs are three.** `tap(element)` is the device's word for a click, `fill(element, value)` fills a text field, and `see(element)` is the only synchronization primitive. There is no `gone()` here ([13 § Verbs](13-elements.md#verbs) says why). Every verb polls until at least one visible match exists (default 30 s, sized for a cold app boot), then enforces the verb's cardinality. Actionability includes **scroll-into-view**: when a descriptor matches nothing visible but an off-screen element exists, the adapter scrolls it into view once (directly by element id) and keeps polling — elements buried in very heavy screens (a full-page WebView) may still be out of reach, so prefer a deep link then.

**Four descriptors reach a screen** — `button(name)` (accessible label, `XCUIElementTypeButton`), `field(label)` (accessible name or value, text and secure-text fields), `content(text)` (any element whose label or value IS the text — the whole-name default of [13 — Elements](13-elements.md#a-name-designates-the-accessible-name-whole), compiled to `==`; `{ exact: false }` compiles to `CONTAINS`) and `testId(id)` (the accessibility identifier, rule W2's escape hatch, with the line saying what the element lacks). The link, heading, dialog, table and option roles, the landmarks and the state modifiers are not part of a device's tree: passing one to a mobile verb refuses at runtime with a message naming the boundary.

**W3 is relaxed for `see()` alone.** `tap` and `fill` refuse an ambiguous descriptor and print the candidates with their accessibility identifiers; `see()` does not — [13 — Elements § `see()` and `gone()`](13-elements.md#see-and-gone-are-the-synchronization) says why, once.

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
    expect(result.screen).toMatch(file('./expected/events.screen.json'));
});
```

The tree describes the **whole mounted hierarchy**, including rows below the fold; `result.content` carries only what is visible. Volatile parts (dates, counters) are covered by the usual `{{token}}` grammar ([15 — Tokens](15-tokens.md)); generate with `TEST_UPDATE=1`.

## Unique here

### Declared backend

A native app usually talks to an API. The `backend` option starts a small **stub backend** (plain `node:http`, no extra dependency) with the runner; what it serves is declared per chain, as [stubs](16-stubs.md) — the feature's `stubs/` facade, exactly the form `api`/`job` use:

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
import newsroom from './stubs/newsroom.stubs.js';

test('renders the events feed from the declared backend', async () => {
    // Given - the backend under stub for this chain
    const result = await mobile.intercept(newsroom).open('news://events');

    // Then - the screen rendered what the stub declared
    expect(result.screen).toMatch(file('./expected/events.screen.json'));
});
```

| `backend` field | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| `port`          | Fixed port — pins a stable stub URL across runs. Default: a free OS-assigned port |

**The ownership boundary.** The framework owns the simulator and the appium server it started — it does NOT own the JS bundler: Metro belongs to the caller's repo, exactly like `next build` belongs to a website's. So nothing is injected anywhere; the handle exposes `backendUrl` and **the caller wires it into its own bundler env** (e.g. `EXPO_PUBLIC_API_URL=<backendUrl> npx expo start`). This is why `port` exists: Metro inlines `EXPO_PUBLIC_*` values at bundle-serve time, and a stable port lets a warm Metro survive between runs instead of re-bundling against a fresh URL.

The stub backend behaves exactly as on the website facet ([08 — Website specs](08-website.md#declared-backend)): it **resets between chains** (one chain = one terminal action); selection is the shared queue (first non-exhausted match wins, no `times` = unlimited); a request matching no declared stub is answered **501 and recorded**, and the `.open()` then **throws** an error enumerating every unmatched request (method, path, count) — screenshots and other failure evidence are captured first, as always. A chain with zero stubs leaves the stub unguarded.

### Evidence on failure

When a scenario throws — an element never appears, a `see()` times out — the error carries a screenshot of the state the scenario died in, referenced by its path in the error message. It is written under `.artifacts/vitest/evidence/`, so it outlives the run and its temp root. A timeout additionally includes a compact excerpt of the labels currently on screen, so the failure reads without relaunching anything. The original error is never masked.

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
    ├── expected/                # ALL expected fixtures, FLAT (*.screen.json, …)
    └── stubs/               # what the declared backend serves — with the `backend` option
        ├── newsroom.stubs.ts
        └── http/…
```

No `seeds/` or `requests/` — a mobile chain has no `.seed()` and no request-file format; `.open()` calls are inline, and the golden is always `expected/<name>`.

## Pitfalls

- **Using `expect()` inside a scenario callback.** Forbidden (rule W1) — the scenario is the When; assertions belong on the result the `.open()` promise resolves to.
- **The first session builds WebDriverAgent (~40 s, once per simulator).** Subsequent sessions on a warm simulator are seconds. Budget the first run; do not "fix" it with retries.
- **Passing a landmark (`main()`, `navigation()`) to a mobile verb.** They are website concepts — iOS has no ARIA regions; the runtime refusal points at `within(testId('…'), …)` as the scoping tool.
- **Reaching for `testId()` first.** It is the last rung, and W2 refuses it without the line naming what the element lacks — [13 § `testId()`](13-elements.md#testid--the-one-escape-hatch).
- **Expecting `.open()` to preserve app state between specs.** It never does — every open terminates and relaunches the app; a flow that spans screens belongs in ONE scenario.
- **Asserting on off-screen content with `result.content`.** `content` carries only _visible_ texts; the mounted-but-offscreen rows live in `result.screen`. Use the golden for the whole list, `content` for what the user currently sees.
- **Calling `specification.mobile()` without appium installed.** The error names the exact fix — `npm install -D appium webdriverio && npx appium driver install xcuitest` — there is no silent fallback.
- **Pointing `device.name` at an ambiguous simulator.** When the same name exists on several OS runtimes the constructor refuses with the listing — narrow with `os:` (or pin `udid:`), do not delete simulators to make it pass.
- **Calling `.intercept()` without the `backend` option.** It throws immediately, naming the fix: add `backend: { … }` to the `specification.mobile()` options — a chain's `.http` exchanges need a stub to serve them.
- **Sleeping around a slow boot instead of declaring it.** A dev bundle that boots past the 30 s default makes every verb refuse; the answer is `timeouts: { action: … }` on the runner, once — an arbitrary wait inside a scenario is untyped, per-spec, and hides the next regression.
- **Expecting the framework to point the app at the stub.** It never touches the bundler — that is the caller's territory. Wire `backendUrl` into your own bundler env (`EXPO_PUBLIC_API_URL`), and pin `port` so a warm Metro keeps its inlined URL.

## Related

[02 — Developing](02-developing.md) · [14 — Assertions](14-assertions.md) · [15 — Tokens](15-tokens.md) · [08 — Website specs](08-website.md)
