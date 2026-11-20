# Component specs (`component`)

`component` tests one thing that draws itself (a React component, a React hook through a small host component written in the test, or a plain DOM function), rendered in a real headless Chromium through Vitest Browser Mode. It lives beside its code as `<file>.test.tsx`, starts nothing, and so has no constructor: the test calls the exported `component` chain directly.

For a whole served page, use [Website specs](website-specs.md); for a module that draws nothing, a [module test](module-tests.md). Why a real browser rather than a simulated DOM: [ADR-003](https://github.com/jterrazz/package-test/blob/main/docs/decisions/003-a-rendered-component-is-a-specification-on-vitest-browser-mode.md).

## What it specifies

A component test answers one question: **given this network and this parent, what does the component put on the screen, and what does it report back?** Everything it reads is what a user or a parent can see (the accessibility tree, the rendered text, the markup, the console), and everything it does is what a user or a parent can do: click, fill, press, change the props, take it off the screen.

It is a UNIT, so it lives with its subject, in the `__tests__/` of the subject's folder (`test-in-its-tests-folder`):

```text
src/presentation/posts/
├── post-table.tsx
├── use-modal-dialog.ts
└── __tests__/
    ├── post-table.test.tsx        # the component's spec; the `.tsx` suffix IS the kind
    └── use-modal-dialog.test.tsx  # a hook's spec: its Host is written in the test file
```

The suffix decides which project collects the file and therefore which rules judge it: `unit()` takes `**/*.test.ts` and excludes `**/*.test.tsx`; `component()` takes the `.tsx`. A rendered thing in a `.test.ts` is rule `no-dom-in-module-test`'s error, and it names the move.

## What it does not do

The subject is a unit that draws itself IN A BROWSER, which leaves four neighbours outside the specification, each with a route, so none of them is a hole.

| Not this                               | Because                                                                             | Route                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A React Native screen                  | The renderer is a real Chromium, and a native view never reaches one                | jest stays, until an experiment rendering it through `react-native-web` shows it can move |
| An `.astro` page                       | A page is the assembled product, met through an address                             | a website spec: [Website specs](website-specs.md)                                         |
| A React island inside an `.astro` page | The island is a rendered unit; only the file around it is not                       | a `.test.tsx` in the `__tests__/` of the island's folder, here                            |
| A Next.js server component             | It renders on the server and reads what the server reads; there is no tree to mount | a website spec, through the served page                                                   |

**What runs under node stays there.** In a page, each node-only name the entry publishes (the seven constructors, the services, the docker accessors, the results that walk a disk) refuses where it is called: a page has no filesystem, no child process and no socket.

## The constructor: there is none

Every other specification starts something (a server, a database, a binary, a simulator), so every other specification has a `*.specification.ts` holding what was started. A component has nothing to start. What a specification file WOULD have held splits by owner:

| What                                               | Whose      | Where                                                           |
| -------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| The providers every render is dressed in           | the app's  | the `component` project's `wrap`, in `studio.config.ts`         |
| The Vite pipeline the app builds with              | the app's  | its `vite`                                                      |
| The viewport, the timezone, the locale             | the app's  | its `viewport`, `timezone`, `locale`                            |
| The stubs, the wrapper, the instant, the page size | one test's | the chain: `.intercept()`, `.wrap()`, `.clock()`, `.viewport()` |

```typescript
// apps/web/studio.config.ts: its test section
const projects = {
    component: {
        reason: 'the app renders through its Vite pipeline, inside its providers',
        vite: './web/vite.config.ts',
        wrap: './web/src/providers.tsx',
    },
};
```

**A relative `vite` or `wrap` is the project's path.** Both are resolved against the component project's `root`, which is the directory holding `studio.config.ts` unless the project states one, so the two paths above mean `apps/web/web/<path>`. A `root` the project states is read from that same directory.

`wrap` is a MODULE PATH whose default export is `(ui) => ReactNode`: a page imports a URL, not a function, so the providers cross as a setup file the project generates under `.artifacts/`. Nothing imports the module itself, so `test()` names it to knip as an entry: the project declares none. A router does not belong here: which routes exist is a test's Given, and it goes on the chain.

| Option                | Description                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `wrap`                | Module path, default-exporting `(ui) => ReactNode`: the app's own providers, around every render of the project           |
| `vite`                | The app's pipeline: a config path, the object, or the function a framework exports. Only the PIPELINE is adopted (below)  |
| `clock`               | An ISO instant pinned for every render, for a project whose components stamp the time                                     |
| `viewport`            | `{ width, height }` of the page. Default `1280 × 720`                                                                     |
| `timezone` / `locale` | The browser context's. Defaults `'UTC'` and `'en-US'`                                                                     |
| `root`                | The directory `vite` and `wrap` are resolved against. Default: the directory holding `studio.config.ts`                   |
| `include` / `exclude` | The globs. Derived: `specs/component/**/*.test.tsx`, and each root holding a `*.test.tsx`; state your own to replace them |
| `timeout`             | Raise (or lower) the preset's 30 s for this project alone                                                                 |
| `serial`              | `fileParallelism: false`: the project's renders run one file at a time                                                    |

**Only the pipeline of `vite` is adopted.** An app's config says where the app LIVES (its `root`, its `build`, its `server.port`, its `publicDir`), and adopting those re-roots the run so the project collects nothing. The kept keys are an allow-list (`plugins`, `resolve`, `esbuild`/`oxc`, `css`, `define`, `assetsInclude`, `envPrefix`, `json`, `optimizeDeps`), and the consumer's `plugins` are concatenated after `component()`'s own, never assigned over them. So is its `optimizeDeps.include`, joined to the project's own: every dependency a component imports belongs there, since one Vite first finds when a test imports it is optimised mid-run, and the reload fails the tests already loading.

**One transformer key, chosen from the installed Vite.** Vite 8 compiles with oxc and warns for every `esbuild` option handed to it beside an `oxc` one; Vite 6 and 7 compile with esbuild and have no `oxc` key at all. `component()` reads the installed major, states the JSX default on the key that Vite actually reads, and drops the other from the adopted pipeline, and the one it states yields to yours: a `jsxImportSource` or a classic runtime is the app's statement, not the project's to overwrite.

**A framework's config function is called as a dev server under test.** `component()` calls it with `{ command: 'serve', mode: 'test', isSsrBuild: false }` and adopts what it returns through the same allow-list, so an Astro app hands over its whole pipeline: its integrations' plugins, React's and Tailwind's among them, its `import.meta.env` defines, its `tsconfig` paths:

```typescript
// studio.config.ts of an Astro app: its component project
import { getViteConfig } from 'astro/config';

const component = {
    reason: 'the app builds with Astro, whose config function hands over its pipeline',
    vite: getViteConfig({}, { root: import.meta.dirname }),
};
```

Both arguments are Astro's. The first is required: Astro reads the app's `root` off it. The second's `root` is the one the project's `root` cannot give: Astro looks for `astro.config.*` in the CWD, not beside the config that calls it, so a config loaded from elsewhere (knip or `typescript check` at a repository root, an app nested in a workspace) finds none, warns `Missing pages directory`, and hands back a pipeline without the app's integrations, its defines or its plugins. Nothing fails then; a component that needed them renders wrong.

**A `resolve.alias` is an unlisted dependency.** An alias tells the bundler where a specifier resolves; it tells knip nothing, so a package reached only through an alias reads as undeclared, and a `paths`-less `tsconfig` makes the compiler disagree with the bundler besides. Mirror the alias in the `tsconfig`'s `paths` (the compiler and the bundler then answer alike), or name the package in `knip.ignoreDependencies` with the alias as the reason.

## The chain

```tsx
import { button, component, content, file } from '@jterrazz/test';
import { defineStub, http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { PostTable } from './post-table.js';

const listing = defineStub({
    request: http.get('/api/posts'),
    response: http.json({ posts: [{ id: 1, title: 'A first post' }], total: 200 }),
});

describe('PostTable', () => {
    test('says how much of the collection the table is showing', async () => {
        // Given - a page of one row answering for a collection of two hundred
        const result = await component.intercept(listing).render(<PostTable />, async (visitor) => {
            await visitor.see(content('Showing 1 of 200 posts'));
        });

        // Then - the table is qualified by what it is not showing
        await expect(result.tree).toMatch(file('./__expected__/one-of-two-hundred.aria.yaml'));
        expect(result.console.text).toBe('');
    });
});
```

Every setup returns a NEW chain, so the handle a spec imports never carries the previous test's state.

| Setup             | Does                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.intercept(...)` | Declares what the network replies: the same stubs and the same queue as every other specification                                                        |
| `.wrap(fn)`       | Wraps every render of this chain: a router stub, a `<StrictMode>`, a provider one test needs                                                             |
| `.clock(iso)`     | Pins the page's `Date` for this render                                                                                                                   |
| `.viewport(size)` | The page size THIS render gets: the Given of a component that reads `matchMedia` or a container query. The project's size is restored when the test ends |

| Terminal action               | Mounts                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `.render(<X />, scenario?)`   | A React tree                                                                  |
| `.render((container) => ...)` | A DOM function, handed a fresh container; its optional return is the teardown |

The scenario is the When, and assertions stay in the Then (rule `no-expect-in-scenario`). Its verbs are the page's (`click` `fill` `check` `select` `hover` `drag` `press` `see` `gone`, each owned and described by [The visitor § Verbs](../reference/visitor.md#verbs)), plus the two only a parent has:

| Verb           | Description                                               |
| -------------- | --------------------------------------------------------- |
| `rerender(ui)` | What a PARENT does: new props, same mount                 |
| `unmount()`    | What a parent does when it takes the thing off the screen |

`goto()` does not exist here, because a component has no address. The visitor's vocabulary is the page's too, modifiers included: [The visitor § Modifiers](../reference/visitor.md#modifiers) owns them all, with the `target-matches-one-element` refusal and the exact-name rule.

## The result

| Member                  | Type           | Description                                                                                                                                                                               |
| ----------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result.tree`           | `RenderedText` | The ARIA snapshot of the rendered body, the outline a golden pins                                                                                                                         |
| `result.content`        | `RenderedText` | The RENDERED text of the document body (`innerText`): what a reader sees, so a stylesheet's source and a node the page does not display are not in it                                     |
| `result.visibleContent` | `RenderedText` | The same text without the text of an element drawn at `opacity: 0`. `innerText` keeps it, a reader of an animation does not see it, so a golden of a reel frame pins what the frame shows |
| `result.html`           | `RenderedText` | The mounted markup, the escape hatch for a class or an attribute                                                                                                                          |
| `result.console`        | `RenderedText` | Every console message, one `[type] text` line per message, and every uncaught exception as ONE `[error] Uncaught ...` line                                                                |
| `result.errors`         | `RenderedText` | Console errors only, plus any uncaught page error, once (`Uncaught Error: ...`)                                                                                                           |

`toMatch(file(...))` is **awaited** on all five, because each is a `RenderedText`, a `TextAccessor` whose golden lives on the node side: a golden captured inside a page is read back through a server command, so the file crosses from the page to the node side. Which matchers are IO (and therefore awaited) is [Assertions](../reference/assertions.md)'s to state; a directory subject is the other one, and it is awaited for the same kind of reason (it walks a disk).

```typescript
await expect(result.tree).toMatch(file('./__expected__/two-of-two-hundred.aria.yaml'));
expect(result.html.text).toContain('row row--live');
expect(result.errors.text).toBe('');
```

The ARIA tree is the golden this package records of a rendered surface: it is the outline a screen reader walks, it is deterministic where a screenshot is not, and it is the SAME dialect [Website specs](website-specs.md) produces for a whole page. Goldens live in `__expected__/` beside the test and are written by `TEST_UPDATE=1`, exactly as everywhere else ([Tokens](../reference/tokens.md)).

### The view golden: the outline with its geometry and its paint

A rendered view is asserted by a text golden first, and that golden is the **view golden**: `<subject>[.<variant>].view.yaml` in `__expected__/` beside its test, the ARIA outline with each line's frame, type role, paint and states. It is the estate's standard for every renderer, recorded by the renderer's own kit: this package specifies the format and judges the pixels that remain ([ADR-024](../decisions/024-a-rendered-view-is-a-text-golden-and-pixels-are-a-curated-exact-set.md)), and records no view golden yet. A component's or a page's result offers `result.tree` alone today; a recorder written here would offer it as `result.view`, with `result.tree` being `result.view` with the bracketed geometry and paint dropped.

The grammar is a strict superset of the `.aria.yaml` dialect, so one reader reads both:

```text
file      := header? tokens? (tree | base changes added)
header    := canvas: { scheme, scale, unit: pt, still, ground, contrast?, transparency? }
tokens    := every token the drawing READ, by its source name, resolved once
node      := - <role> ["<name>"] [attr]* [":" children]
role      := an ARIA role (heading, text, button, listitem, region, dialog, menu,
             menuitem, separator, img, group ...), the visitor's word where it has one

attr      := at=x,y          frame origin in pt, relative to the parent, on a 0.5 pt grid
           | size=WxH        frame size in pt
           | font=<token>    the type role (family, size, weight resolve in tokens:)
           | ink= / fill= / stroke= / corner= / shadow= / rim=   a paint TOKEN name, never a value
           | kit=<Component> a container with no ARIA role, named by the kit
           | lines=N pitch=P | width=W     how a text wrapped, never the glyphs
           | state=lit|expanded|selected|disabled|checked|focused
           | visible=H | under=fade | hidden=scrolled | clipped=edge N
```

Seven rules make it exact and near-total:

1. **Every drawn element is a line.** The recorder sits on the kit's primitives, the only way the kit may draw, so a view reached only through the kit is recorded whole; a primitive drawing outside the recorder is refused.
2. **Paint is named, never sampled.** A colour is its token (`color.t2`), whose value `tokens:` prints once, so a token edit is one line of diff.
3. **Frames are local.** A padding change moves its own subtree and its later siblings, never the whole file.
4. **Text is its words and how they wrapped** (`lines`, `width`), never glyph positions: wrapping is layout, glyph shapes are pixels.
5. **States are explicit.** What pixels show as absence (a row scrolled away, a dimmed button) is a word.
6. **It is compared whole, by exact string equality**, written by `TEST_UPDATE=1` and merged like any golden.
7. **An overlay names its base** (`base:`, then `changes:` and `added:`): the runner composes the base and the delta into the whole expected tree and compares that, and the file holds only what the overlay owns.

A context menu over a page, recorded as an overlay of the page's own golden:

```yaml
# view golden · story menu.context.stopped · light · standard contrast · glass
story: menu.context.stopped
canvas: { scheme: light, scale: 2, unit: pt, still: true, ground: FlatDesk }
base: ./mac.this.overview.light.view.yaml
tokens:
    Metric.Menu.padding: 5
    Metric.Menu.radius: 11
    color.menu: '#F1F1F3'
    color.t1: rgba(0 0 0 / 0.85)
    color.down: '#EC3B30'

changes:
    - group [kit=Panel] › region "VMs" › listitem "api" [state=lit]
added:
    - menu "api on This Mac" [at=44.5,332] [size=199x123.5] [fill=color.menu] [corner=Metric.Menu.radius] [shadow=Menu.shade]:
          - menuitem "Open" [at=5,24.5] [size=189x24] [ink=color.t1]
          - separator [at=5,48.5] [size=189x11]
          - menuitem "Delete…" [at=5,94.5] [size=189x24] [ink=color.down]
```

A `Metric.Menu.padding` of 6 fails it on the token line and on every frame the padding moved, each by one point, and on nothing else.

### Pixel goldens: a curated, exact set

A view golden cannot see compositing and blending, shadows, blur and rims, glyph rasters and antialiasing, symbols, the curves of a chart, gradients and fades. Those are proved by a **pixel golden**, and **an image earns its place by proving one paint recipe that no view golden can state and no other kept pixel golden proves**. A state of the product never earns one for being a state: its view golden proves it. The test names the recipe it keeps the image for (`pixels: "<recipe>"`).

| Rule       | Value                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compare    | byte-exact on the decoded 8-bit RGBA, no tolerance and no share of pixels                                                                                                    |
| Renderer   | the pinned reference renderer, a still frame at a fixed clock with the image's own fonts; the golden names it in a sidecar line, `renderer: <image>@sha256:...`              |
| Scale      | 2x, the renderer's real output                                                                                                                                               |
| Crop       | the subject's own frame plus its shadow's reach, never a margin of desk; a ground drawn only where the recipe needs one                                                      |
| Format     | PNG, written by ONE pinned lossless encoder at a fixed level, every metadata chunk stripped, so the same pixels are the same bytes                                           |
| Write rule | `TEST_UPDATE=1` writes a pixel golden only when its decoded pixels differ, and lists what it rewrote                                                                         |
| Naming     | `<subject>.<scheme>[.<contrast>\|.<transparency>].png`, beside its `.view.yaml` in `__expected__/`                                                                           |
| Storage    | plain git: no LFS, no external baseline service                                                                                                                              |
| Weight     | 192000 bytes per image and 3000000 per repository, a total held down by the ratchet: rule [`pixel-golden-within-budget`](../reference/linting.md#pixel-golden-within-budget) |

The weight is the one row the package enforces; the others are what a recorder and its comparer owe, and the renderer's kit implements them.

## Unique here

- **The hook recipe.** A hook has no surface, so its Given is a **Host component written in the test file**, carrying the states the test needs: an opener, a fallback target, a handler that can be swapped. The visitor drives the Host; `rerender` swaps the handler; `unmount` is the parent walking away. There is no hook-specific runner and there is no need for one.

```tsx
import { button, component, dialog, focused } from '@jterrazz/test';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';

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

describe('focus', () => {
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
});
```

- **A DOM function is still a component.** `renderSessionRows(container, rows)` renders; it just does not use React. `.render((container) => ...)` mounts it in the same Chromium under the same visitor, and `result.html` reads what it drew. No React is loaded. Write the body BRACED: a concise arrow hands back the void the render function returns, and `typescript/no-confusing-void-expression` refuses that.

```tsx
const result = await component.render((container) => {
    renderSessionRows(container, rows);
});
```

- **A router is a test's Given.** A screen that renders `<Link>` or reads `useParams()` throws without a router. `createRoutesStub([...])` on `.wrap()` is that Given: React Router's own guidance, and the fork's: a route module is a website spec, a presentation component is a component spec, a loader is a module test.
- **Strictness is total.** A component that fetches something no stub declared fails the render, naming the request, including a component given NO stub at all, which is how "this subject has no network" is said. The request is the failure the render reports even when the scenario then failed for want of what it asked for: the cause, not the symptom. There is no bypass and no default handler. The api specification's `network-strict-after-first-stub` stops at a known scope because it shares a process with everything else the test does; a page does not, so here it is total. It follows that a module-scope `intercept()` opened around a `.render()` is shadowed: the render's own registration is installed last and answers everything. Declare a render's network on the chain; `intercept()` in a `.test.tsx` is for code the test calls itself ([Stubs](../reference/stubs.md#intercept-the-same-double-with-no-chain)).
- **The clock is the page's.** `.clock(iso)` pins `Date` and nothing else: faking the page's timers would stop React's scheduler and nothing would ever render.

## Pitfalls

- **Reaching for `@testing-library/react` or `happy-dom`.** Rule `no-second-test-runtime` refuses both, and the second is the reason the specification exists: a simulated DOM behaves almost like a browser, and what ships is judged by a real one.
- **Writing a `*.specification.ts` for it.** There is nothing to start. The project holds what every render shares; the chain holds what one test needs.
- **Hand-rolling `browser:` in a config.** A derived config has no place for it: the provider is pinned to the runner's EXACT version, the service worker is served from the framework's own install, the JSX transform follows the Vite in use, and a cold dependency cache must be pre-bundled or the first run reloads the tester under the test. `component()` owns all four.
- **Putting a rendered test in a `.test.ts`.** Rule `no-dom-in-module-test` refuses the DOM globals it would need. Rename it `.test.tsx`, in the `__tests__/` of its component's folder; the project that collects it opens a browser.
- **Asserting focus with a golden.** The tree carries no focus; [The visitor § Modifiers](../reference/visitor.md#modifiers) says what asserts it.
- **Expecting `toMatch(file(...))` to be synchronous here.** It is not: `await expect(result.tree).toMatch(file('./__expected__/<name>.aria.yaml'))`. A bare call still runs the assertion, but off the test's lifetime: a failure surfaces as an `Unhandled Errors` entry attributed to no test, the test itself is reported PASSED, and the run exits non-zero anyway. Under `TEST_UPDATE=1` the write happens outside the test too.
- **Reading the `target-matches-one-element` refusal as a suggestion.** When two elements carry the SAME whole name, the refusal names the accessible name each candidate matched on and offers a landmark; read that before scoping, because the landmark it offers is the one that narrows, not necessarily the one you meant. Exact-by-default and its `{ exact: false }` escape are [The visitor § A name designates the accessible name WHOLE](../reference/visitor.md#a-name-designates-the-accessible-name-whole)'s.
- **Pointing `wrap` at a router.** `wrap` is the app's frame, around every render of the project. Which routes exist changes per test, so it belongs on the chain.
- **Giving the project the app's whole Vite config and expecting the app's root.** Only the pipeline is adopted; the project's root stays the directory of `vitest.config.ts`, which is what makes its `include` globs mean what they say.

## Related

[Set up a project](../start/set-up-a-project.md) · [Website specs](website-specs.md) · [Stubs](../reference/stubs.md) · [The visitor](../reference/visitor.md) · [Assertions](../reference/assertions.md)
