# 16 — Component specs (`component`)

`component` specifies a rendered UNIT — a React component, a React hook through a Host written in the test, or a plain DOM function — in a real headless Chromium, the same browser [14 — Website specs](14-website.md) already drives through the same `playwright` peer.

Use it when the subject is one thing that draws itself. For a whole served page use [website](14-website.md); for a module that draws nothing, a module test beside it needs no runner at all.

| The shape           | Held below                                                             |
| ------------------- | ---------------------------------------------------------------------- |
| What it specifies   | [What it specifies](#what-it-specifies)                                |
| Where it is written | [The constructor: there is none](#the-constructor-there-is-none)       |
| The chain           | [The chain](#the-chain) — `intercept` · `wrap` · `clock` · `render`    |
| The result          | [The result](#the-result) — `tree` `content` `html` `console` `errors` |
| What only it does   | [Unique here](#unique-here)                                            |
| What it will refuse | [Pitfalls](#pitfalls)                                                  |

## What it specifies

A component test answers one question: **given this network and this parent, what does the component put on the screen, and what does it report back?** Everything it reads is what a user or a parent can see — the accessibility tree, the rendered text, the markup, the console — and everything it does is what a user or a parent can do: click, fill, press, change the props, take it off the screen.

It is a UNIT, so it lives beside its subject:

```
src/presentation/posts/
├── post-table.tsx
├── post-table.test.tsx        # the component's spec — the `.tsx` suffix IS the kind
├── use-modal-dialog.ts
└── use-modal-dialog.test.tsx  # a hook's spec: its Host is written in the test file
```

The suffix decides which project collects the file and therefore which rules judge it: `unit()` takes `**/*.test.ts` and excludes `**/*.test.tsx`; `component()` takes the `.tsx`. A rendered thing in a `.test.ts` is rule G4's error, and it names the move.

## The constructor: there is none

Every other facet starts something — a server, a database, a binary, a simulator — so every other facet has a `*.specification.ts` holding what was started. A component has nothing to start. What a specification file WOULD have held splits by owner:

| What                                     | Whose      | Where                                            |
| ---------------------------------------- | ---------- | ------------------------------------------------ |
| The providers every render is dressed in | the app's  | `component({ wrap })` in `vitest.config.ts`      |
| The Vite pipeline the app builds with    | the app's  | `component({ vite })`                            |
| The viewport, the timezone, the locale   | the app's  | `component({ viewport, timezone, locale })`      |
| The contracts, the wrapper, the instant  | one test's | the chain: `.intercept()`, `.wrap()`, `.clock()` |

```typescript
// vitest.config.ts
import { component, defineSpecConfig, unit } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [unit(), component({ vite: './vite.config.ts', wrap: './src/providers.tsx' })],
    },
});
```

`wrap` is a MODULE PATH whose default export is `(ui) => ReactNode` — a page imports a URL, not a function, so the providers cross as a setup file the project generates under `.artifacts/`. A router does not belong here: which routes exist is a test's Given, and it goes on the chain.

| Option                | Description                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `wrap`                | Module path, default-exporting `(ui) => ReactNode` — the app's own providers, around every render of the project         |
| `vite`                | The app's pipeline: a config path, the object, or the function a framework exports. Only the PIPELINE is adopted (below) |
| `clock`               | An ISO instant pinned for every render — a project whose components stamp the time                                       |
| `viewport`            | `{ width, height }` of the page. Default `1280 × 720`                                                                    |
| `timezone` / `locale` | The browser context's. Defaults `'UTC'` and `'en-US'`                                                                    |
| `include` / `exclude` | The globs. Default `['**/*.test.tsx']`, kept out of `specs/` — state your own `include` and the exclusion is yours too   |
| `timeout`             | Raise (or lower) the preset's 30 s for this project alone                                                                |

**Only the pipeline of `vite` is adopted.** An app's config says where the app LIVES — its `root`, its `build`, its `server.port`, its `publicDir` — and adopting those re-roots the run so the project collects nothing. The kept keys are an allow-list (`plugins`, `resolve`, `esbuild`/`oxc`, `css`, `define`, `assetsInclude`, `envPrefix`, `json`), and the consumer's `plugins` are concatenated after the seam's, never assigned over them.

## The chain

```tsx
import { button, component, content, defineContract, http, status } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { PostTable } from './post-table.js';

const listing = defineContract({
    request: http.get('/api/posts'),
    response: http.json({ posts: [{ id: 1, title: 'A first post' }], total: 200 }),
});

test('says how much of the collection the table is showing', async () => {
    // Given - a page of one row answering for a collection of two hundred
    const result = await component.intercept(listing).render(<PostTable />, async (visitor) => {
        await visitor.see(content('Showing 1 of 200 posts'));
    });

    // Then - the table is qualified by what it is not showing
    await expect(result.tree).toMatch('one-of-two-hundred.aria.yaml');
    await expect(result.console).toBeEmpty();
});
```

Every setup returns a NEW chain, so the handle a spec imports never carries the previous test's state.

| Setup           | Does                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `.intercept(…)` | Declares what the network replies — the same contracts and the same queue as every other facet |
| `.wrap(fn)`     | Wraps every render of this chain: a router stub, a `<StrictMode>`, a provider one test needs   |
| `.clock(iso)`   | Pins the page's `Date` for this render                                                         |

| Terminal action             | Mounts                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- |
| `.render(<X />, scenario?)` | A React tree                                                                  |
| `.render((container) => …)` | A DOM function, handed a fresh container; its optional return is the teardown |

The scenario is the When, and assertions stay in the Then (rule W1). Its verbs are the page's, plus the two only a parent has:

| Verb                     | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `click` `fill` `check`   | What a user does to a control                                |
| `select` `hover` `press` | …and to a list, a hover target, the keyboard                 |
| `see(element)`           | Wait until it is visible — the synchronization primitive     |
| `gone(element)`          | Wait until it is gone — hidden, or no longer in the document |
| `rerender(ui)`           | What a PARENT does: new props, same mount                    |
| `unmount()`              | What a parent does when it takes the thing off the screen    |

`see(focused(button('Open')))` asks where the keyboard is; `goto()` does not exist here, because a component has no address.

## The result

| Member           | Type           | Description                                                        |
| ---------------- | -------------- | ------------------------------------------------------------------ |
| `result.tree`    | `TextAccessor` | The ARIA snapshot of the rendered body — the outline a golden pins |
| `result.content` | `TextAccessor` | Rendered text of the document body                                 |
| `result.html`    | `TextAccessor` | The mounted markup — the escape hatch for a class or an attribute  |
| `result.console` | `TextAccessor` | Every console message, one `[type] text` line per message          |
| `result.errors`  | `TextAccessor` | Console errors only, plus any uncaught page error                  |

`toMatch` is **awaited** on these five and on nothing else in the framework: a golden captured inside a page is read back through a server command, so the file crosses the browser seam.

```typescript
await expect(result.tree).toMatch('two-of-two-hundred.aria.yaml');
expect(result.html).toContain('row row--live');
await expect(result.errors).toBeEmpty();
```

The ARIA tree is the golden a rendered surface wants: it is the outline a screen reader walks, it is deterministic where a screenshot is not, and it is the SAME dialect [14 — Website specs](14-website.md) produces for a whole page. Goldens live in `_expected/` beside the test and are written by `TEST_UPDATE=1`, exactly as everywhere else ([09 — Tokens](09-tokens.md)).

## Unique here

- **The hook recipe.** A hook has no surface, so its Given is a **Host component written in the test file**, carrying the states the test needs — an opener, a fallback target, a handler that can be swapped. The visitor drives the Host; `rerender` swaps the handler; `unmount` is the parent walking away. There is no hook-specific runner and there is no need for one.
- **A DOM function is still a component.** `renderSessionRows(container, rows)` renders; it just does not use React. `.render((container) => …)` mounts it in the same Chromium under the same visitor, and `result.html` reads what it drew. No React is loaded.
- **A router is a test's Given.** cap01's and the console's screens render `<Link>` and read `useParams()`; without a router they throw. `createRoutesStub([...])` on `.wrap()` is that Given — React Router's own guidance, and the fork's: a route module is a website spec, a presentation component is a component spec, a loader is a module test.
- **Strictness is total.** A component that fetches something no contract declared fails the render, naming the request. There is no bypass and no default handler — the same D7 the api facet holds, through msw's worker instead of its node interceptor.
- **The clock is the page's.** `.clock(iso)` pins `Date` and nothing else: faking the page's timers would stop React's scheduler and nothing would ever render.

## Pitfalls

- **Reaching for `@testing-library/react` or `happy-dom`.** Rule F6 refuses both, and the second is the reason the facet exists: a simulated DOM behaves almost like a browser, and what ships is judged by a real one.
- **Writing a `*.specification.ts` for it.** There is nothing to start. The project holds what every render shares; the chain holds what one test needs.
- **Hand-rolling `browser:` in a config.** Rule E6 refuses it: the provider is pinned to the runner's EXACT version, the service worker is served from the framework's own install, the JSX transform follows the Vite in use, and a cold dependency cache must be pre-bundled or the first run reloads the tester under the test. `component()` owns all four.
- **Putting a rendered test in a `.test.ts`.** Rule G4 refuses the DOM globals it would need. Rename it `.test.tsx` beside its component; the project that collects it opens a browser.
- **Asserting focus with a golden.** The accessibility tree carries no focus state, so a tree snapshot proves nothing about the keyboard. `see(focused(x))` / `gone(focused(x))` are the verbs that do.
- **Expecting `toMatch` to be synchronous here.** It is not: `await expect(result.tree).toMatch('…')`. A bare call resolves nothing and the assertion never runs.
- **Pointing `wrap` at a router.** `wrap` is the app's frame, around every render of the project. Which routes exist changes per test, so it belongs on the chain.
- **Giving the project the app's whole Vite config and expecting the app's root.** Only the pipeline is adopted; the project's root stays the directory of `vitest.config.ts`, which is what makes its `include` globs mean what they say.

## Related

[02 — Developing](02-developing.md) · [10 — Contracts](10-contracts.md) · [12 — Conventions](12-conventions.md) · [14 — Website specs](14-website.md)
