# 16 — Component specs (`component`)

`component` specifies a rendered UNIT — a React component, a React hook through a Host written in the test, or a plain DOM function — in a real headless Chromium, the same browser [14 — Website specs](14-website.md) already drives through the same `playwright` peer.

Use it when the subject is one thing that draws itself. For a whole served page use [website](14-website.md); for a module that draws nothing, a module test beside it needs no runner at all.

Why a facet on Vitest Browser Mode, and what was weighed against it: [ADR-003](decisions/003-a-rendered-component-is-a-facet-on-vitest-browser-mode.md).

| The shape           | Held below                                                                       |
| ------------------- | -------------------------------------------------------------------------------- |
| What it specifies   | [What it specifies](#what-it-specifies)                                          |
| What it refuses     | [What it does not do](#what-it-does-not-do)                                      |
| Where it is written | [The constructor: there is none](#the-constructor-there-is-none)                 |
| The chain           | [The chain](#the-chain) — `intercept` · `wrap` · `clock` · `viewport` · `render` |
| The result          | [The result](#the-result) — `tree` `content` `html` `console` `errors`           |
| What only it does   | [Unique here](#unique-here)                                                      |
| What it will refuse | [Pitfalls](#pitfalls)                                                            |

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

## What it does not do

The subject is a unit that draws itself IN A BROWSER, which leaves four neighbours outside the facet — each with a route, so none of them is a hole.

| Not this                               | Because                                                                              | Route                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| A React Native screen                  | The renderer is a real Chromium, and a native view never reaches one                 | jest stays, until the `react-native-web` spike says otherwise |
| An `.astro` page                       | A page is the assembled product, met through an address                              | a website spec — [14 — Website specs](14-website.md)          |
| A React island inside an `.astro` page | The island is a rendered unit; only the file around it is not                        | a `.test.tsx` beside the island, here                         |
| A Next.js server component             | It renders on the server and reads what the server reads — there is no tree to mount | a website spec, through the served page                       |

**`vite` as a framework function is BACKLOG, not a shape to reach for.** `component({ vite })` accepts the function a framework exports, and Astro's `getViteConfig()` is one — but no spike has yet proven that pipeline under this facet: the cross-repo probe that suggested it was confounded by two Vite versions, and the proof owed is an in-repo spike inside a `jterrazz-web` worktree. Until it lands, state the app's own `vite.config.ts` and let the allow-list take the pipeline from it.

## The constructor: there is none

Every other facet starts something — a server, a database, a binary, a simulator — so every other facet has a `*.specification.ts` holding what was started. A component has nothing to start. What a specification file WOULD have held splits by owner:

| What                                                   | Whose      | Where                                                           |
| ------------------------------------------------------ | ---------- | --------------------------------------------------------------- |
| The providers every render is dressed in               | the app's  | `component({ wrap })` in `vitest.config.ts`                     |
| The Vite pipeline the app builds with                  | the app's  | `component({ vite })`                                           |
| The viewport, the timezone, the locale                 | the app's  | `component({ viewport, timezone, locale })`                     |
| The contracts, the wrapper, the instant, the page size | one test's | the chain: `.intercept()`, `.wrap()`, `.clock()`, `.viewport()` |

```typescript
// apps/console/vitest.config.ts
import { component, defineSpecConfig, unit } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            unit({ roots: ['src', 'web'] }),
            component({ vite: './web/vite.config.ts', wrap: './web/src/providers.tsx' }),
        ],
    },
});
```

**A relative `vite` or `wrap` is the CONFIG's path, never the cwd's.** Both are resolved against the directory of the config that called `component()`, so the two paths above mean `apps/console/web/…` whoever loaded the file — the runner from the app, knip and `typescript check` from the repository root, where every config of a repository is read. State `root` when the anchor cannot be read that way: a call written outside the config it configures (a shared config factory), or a runner started in another tree entirely (`vitest --config apps/console/vitest.config.ts` from the root).

`wrap` is a MODULE PATH whose default export is `(ui) => ReactNode` — a page imports a URL, not a function, so the providers cross as a setup file the project generates under `.artifacts/`. A router does not belong here: which routes exist is a test's Given, and it goes on the chain.

| Option                | Description                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `wrap`                | Module path, default-exporting `(ui) => ReactNode` — the app's own providers, around every render of the project         |
| `vite`                | The app's pipeline: a config path, the object, or the function a framework exports. Only the PIPELINE is adopted (below) |
| `clock`               | An ISO instant pinned for every render — a project whose components stamp the time                                       |
| `viewport`            | `{ width, height }` of the page. Default `1280 × 720`                                                                    |
| `timezone` / `locale` | The browser context's. Defaults `'UTC'` and `'en-US'`                                                                    |
| `root`                | The directory `vite` and `wrap` are resolved against. Default: the directory of the config that called `component()`     |
| `include` / `exclude` | The globs. Default `['**/*.test.tsx']`, kept out of `specs/` — state your own `include` and the exclusion is yours too   |
| `timeout`             | Raise (or lower) the preset's 30 s for this project alone                                                                |
| `serial`              | `fileParallelism: false` — the project's renders run one file at a time                                                  |

**Only the pipeline of `vite` is adopted.** An app's config says where the app LIVES — its `root`, its `build`, its `server.port`, its `publicDir` — and adopting those re-roots the run so the project collects nothing. The kept keys are an allow-list (`plugins`, `resolve`, `esbuild`/`oxc`, `css`, `define`, `assetsInclude`, `envPrefix`, `json`), and the consumer's `plugins` are concatenated after the seam's, never assigned over them.

**One transformer key, chosen from the installed Vite.** Vite 8 compiles with oxc and warns for every `esbuild` option handed to it beside an `oxc` one; Vite 6 and 7 compile with esbuild and have no `oxc` key at all. `component()` reads the installed major, states the JSX default on the key that Vite actually reads, and drops the other from the adopted pipeline — and the one it states yields to yours: a `jsxImportSource` or a classic runtime is the app's statement, not the seam's to overwrite.

**A `resolve.alias` is an unlisted dependency.** An alias tells the bundler where a specifier resolves; it tells knip nothing, so a package reached only through an alias reads as undeclared, and a `paths`-less `tsconfig` makes the compiler disagree with the bundler besides. Mirror the alias in the `tsconfig`'s `paths` (the compiler and the bundler then answer alike), or name the package in `knip.ignoreDependencies` with the alias as the reason.

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

| Setup             | Does                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.intercept(…)`   | Declares what the network replies — the same contracts and the same queue as every other facet                                                            |
| `.wrap(fn)`       | Wraps every render of this chain: a router stub, a `<StrictMode>`, a provider one test needs                                                              |
| `.clock(iso)`     | Pins the page's `Date` for this render                                                                                                                    |
| `.viewport(size)` | The page size THIS render gets — the Given of a component that reads `matchMedia` or a container query. The project's size is restored when the test ends |

| Terminal action             | Mounts                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- |
| `.render(<X />, scenario?)` | A React tree                                                                  |
| `.render((container) => …)` | A DOM function, handed a fresh container; its optional return is the teardown |

The scenario is the When, and assertions stay in the Then (rule W1). Its verbs are the page's — `click` `fill` `check` `select` `hover` `press` `see` `gone`, each owned and described by [14 — Website specs § The visitor](14-website.md#the-visitor) — plus the two only a parent has:

| Verb           | Description                                               |
| -------------- | --------------------------------------------------------- |
| `rerender(ui)` | What a PARENT does: new props, same mount                 |
| `unmount()`    | What a parent does when it takes the thing off the screen |

`goto()` does not exist here, because a component has no address. The element modifiers are the page's too: `see(focused(button('Open')))` asks where the keyboard is, `see(disabled(button('Publish')))` whether a control takes input.

## The result

| Member           | Type           | Description                                                                                                                                            |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `result.tree`    | `TextAccessor` | The ARIA snapshot of the rendered body — the outline a golden pins                                                                                     |
| `result.content` | `TextAccessor` | The RENDERED text of the document body (`innerText`) — what a reader sees, so a stylesheet's source and a node the page does not display are not in it |
| `result.html`    | `TextAccessor` | The mounted markup — the escape hatch for a class or an attribute                                                                                      |
| `result.console` | `TextAccessor` | Every console message, one `[type] text` line per message                                                                                              |
| `result.errors`  | `TextAccessor` | Console errors only, plus any uncaught page error                                                                                                      |

`toMatch` is **awaited** on all five: a golden captured inside a page is read back through a server command, so the file crosses the browser seam. Which matchers are IO — and therefore awaited — is [08 — Assertions](08-assertions.md)'s to state; a directory subject is the other one, and it is awaited for the same kind of reason (it walks a disk).

```typescript
await expect(result.tree).toMatch('two-of-two-hundred.aria.yaml');
expect(result.html).toContain('row row--live');
await expect(result.errors).toBeEmpty();
```

The ARIA tree is the golden a rendered surface wants: it is the outline a screen reader walks, it is deterministic where a screenshot is not, and it is the SAME dialect [14 — Website specs](14-website.md) produces for a whole page. Goldens live in `_expected/` beside the test and are written by `TEST_UPDATE=1`, exactly as everywhere else ([09 — Tokens](09-tokens.md)).

## Unique here

- **The hook recipe.** A hook has no surface, so its Given is a **Host component written in the test file**, carrying the states the test needs — an opener, a fallback target, a handler that can be swapped. The visitor drives the Host; `rerender` swaps the handler; `unmount` is the parent walking away. There is no hook-specific runner and there is no need for one.

```tsx
import { button, component, dialog, focused } from '@jterrazz/test';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';

// The Given of a hook spec is a Host, written HERE: the component carrying the
// States the test needs is part of the test, not of the app.
function Host({ onClose }: { onClose: () => void }) {
    const [open, setOpen] = useState(false);

    const show = (): void => {
        setOpen(true);
    };

    const dismiss = (): void => {
        setOpen(false);
        onClose();
    };

    if (!open) {
        return (
            <button onClick={show} type="button">
                Open
            </button>
        );
    }

    return (
        <dialog aria-label="Host" open>
            <button onClick={dismiss} type="button">
                Close
            </button>
        </dialog>
    );
}

test('gives the keyboard back to whatever opened it', async () => {
    // Given - a dialog opened from a button and then dismissed
    const onClose = vi.fn<() => void>();

    await component.render(<Host onClose={onClose} />, async (visitor) => {
        await visitor.click(button('Open'));
        await visitor.see(dialog('Host'));
        await visitor.click(button('Close'));
        await visitor.gone(dialog('Host'));
        await visitor.see(focused(button('Open')));
    });

    // Then - the owner heard the dismissal exactly once
    expect(onClose).toHaveBeenCalledOnce();
});
```

- **A DOM function is still a component.** `renderSessionRows(container, rows)` renders; it just does not use React. `.render((container) => …)` mounts it in the same Chromium under the same visitor, and `result.html` reads what it drew. No React is loaded. Write the body BRACED: a concise arrow hands back the void the render function returns, and `typescript/no-confusing-void-expression` refuses that.

```tsx
const result = await component.render((container) => {
    renderSessionRows(container, rows);
});
```

- **A router is a test's Given.** cap01's and the console's screens render `<Link>` and read `useParams()`; without a router they throw. `createRoutesStub([...])` on `.wrap()` is that Given — React Router's own guidance, and the fork's: a route module is a website spec, a presentation component is a component spec, a loader is a module test.
- **Strictness is total.** A component that fetches something no contract declared fails the render, naming the request — including a component given NO contract at all, which is how "this subject has no network" is said. There is no bypass and no default handler. The api facet's D7 stops at a known scope because it shares a process with everything else the test does; a page does not, so here it is total.
- **The clock is the page's.** `.clock(iso)` pins `Date` and nothing else: faking the page's timers would stop React's scheduler and nothing would ever render.

## Pitfalls

- **Reaching for `@testing-library/react` or `happy-dom`.** Rule F6 refuses both, and the second is the reason the facet exists: a simulated DOM behaves almost like a browser, and what ships is judged by a real one.
- **Writing a `*.specification.ts` for it.** There is nothing to start. The project holds what every render shares; the chain holds what one test needs.
- **Hand-rolling `browser:` in a config.** Rule E6 refuses it: the provider is pinned to the runner's EXACT version, the service worker is served from the framework's own install, the JSX transform follows the Vite in use, and a cold dependency cache must be pre-bundled or the first run reloads the tester under the test. `component()` owns all four.
- **Putting a rendered test in a `.test.ts`.** Rule G4 refuses the DOM globals it would need. Rename it `.test.tsx` beside its component; the project that collects it opens a browser.
- **Asserting focus with a golden.** The accessibility tree carries no focus state, so a tree snapshot proves nothing about the keyboard. `see(focused(x))` / `gone(focused(x))` are the verbs that do.
- **Expecting `toMatch` to be synchronous here.** It is not: `await expect(result.tree).toMatch('…')`. A bare call still runs the assertion, but off the test's lifetime: a failure surfaces as an `Unhandled Errors` entry attributed to no test, the test itself is reported PASSED, and the run exits non-zero anyway. Under `TEST_UPDATE=1` the write happens outside the test too.
- **A name that is a prefix of an accessible name.** Names match as a case-insensitive substring unless you say `{ exact: true }`, so `button('Delete post')` also matches a row's `aria-label="Delete Post a"`. The W3 refusal names the accessible name each candidate matched on; read that before scoping, because the landmark it offers is the one that narrows, not necessarily the one you meant.
- **Pointing `wrap` at a router.** `wrap` is the app's frame, around every render of the project. Which routes exist changes per test, so it belongs on the chain.
- **Giving the project the app's whole Vite config and expecting the app's root.** Only the pipeline is adopted; the project's root stays the directory of `vitest.config.ts`, which is what makes its `include` globs mean what they say.

## Related

[02 — Developing](02-developing.md) · [08 — Assertions](08-assertions.md) · [10 — Contracts](10-contracts.md) · [12 — Conventions](12-conventions.md) · [14 — Website specs](14-website.md) · [ADR-003 — a rendered component is a facet on Vitest Browser Mode](decisions/003-a-rendered-component-is-a-facet-on-vitest-browser-mode.md)
