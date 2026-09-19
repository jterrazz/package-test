# Component specs — the `component` chain

Operative reference. Prose + examples: [docs/16-component.md](../../../docs/16-component.md). Elements and verbs: [references/website.md](website.md). Contracts: [references/contracts.md](contracts.md).

Tests a rendered UNIT — a React component, a React hook through a Host written in the test, or a plain DOM function — in a real headless chromium. No constructor, no `*.specification.ts`: nothing is started.

## Where the file goes

Beside its subject, and the suffix is the kind:

```
src/presentation/posts/
├── post-table.tsx            → post-table.test.tsx      # a component
├── use-modal-dialog.ts       → use-modal-dialog.test.tsx # a hook: its Host is in the test
└── post-client.ts            → post-client.test.ts       # a module: no DOM (rule G4)
```

`unit()` collects `**/*.test.ts` and EXCLUDES `**/*.test.tsx`; `component()` collects the `.tsx`. Never `specs/` — that is for a product reached through an entry.

What this facet does NOT cover, and where each of those subjects goes instead: [docs/16-component.md § What it does not do](../../../docs/16-component.md#what-it-does-not-do).

## The project (`vitest.config.ts`)

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

- `wrap` — a module PATH default-exporting `(ui) => ReactNode`: the app's own providers, around every render. A router is NOT this; it is a test's Given, on `.wrap()`.
- `vite` — the app's pipeline (path | object | function | promise). Only `plugins`, `resolve`, `esbuild`/`oxc`, `css`, `define`, `assetsInclude`, `envPrefix`, `json` are adopted; `root`, `build`, `server`, `publicDir` are dropped so the project still collects from where the config sits. Consumer plugins are CONCATENATED after the seam's. The JSX default lands on the key the installed Vite transforms with (`oxc` from 8, `esbuild` before it) and yields to yours.
- A `resolve.alias` is an unlisted dependency to knip, and a bundler-only statement to the compiler: mirror it in the `tsconfig`'s `paths`, or name the package in `knip.ignoreDependencies` with the alias as the reason.
- A relative `vite` or `wrap` is resolved against the directory of the CONFIG that called `component()`, never the cwd — knip and `typescript check` load every config from the repository root. `root` states that anchor when it cannot be read: a call written outside the config it configures, or a runner started in another tree.
- `clock`, `viewport` (default 1280×720 — one test overrides it with `.viewport()`), `timezone` (`'UTC'`), `locale` (`'en-US'`), `include`/`exclude`, `timeout`, `serial` (→ `fileParallelism: false`, for a facet whose files share one server or one database file).
- Beside it: `unit({ roots?, include?, exclude?, timeout?, serial? })` and `website({ include?, exclude?, timeout?, serial? })`. The three carry `sequence.groupOrder` — node 0, website 1, component 2 — so two chromiums never share a slot.
- It is `async`; `projects: [component({ … })]` is fine without `await`.
- Peers it needs: `@vitest/browser-playwright` (peers vitest on an EXACT version — bump both in one change), `vitest-browser-react`, `react`, `react-dom`, `vite`, `playwright` + `npx playwright install chromium`.

## The chain

```tsx
import { button, component, content, defineContract, http } from '@jterrazz/test';

const result = await component
    .intercept(listing) // contracts — D7 is TOTAL here: no contract, no network
    .wrap((ui) => <Stub />) // a router stub, StrictMode, a test-local provider
    .clock('2026-03-04T09:30:00Z') // pins the page's Date
    .viewport({ height: 640, width: 400 }) // this render's page size; restored after
    .render(<PostTable />, async (visitor) => {
        await visitor.click(button('Apply'));
        await visitor.see(content('Showing 2 of 200 posts'));
    });
```

`.render()` also takes a DOM function, whose optional return is its teardown. No React is loaded for it. Brace the body — a concise arrow returns the render function's void, which `typescript/no-confusing-void-expression` refuses:

```tsx
await component.render((container) => {
    renderRows(container, rows);
});
```

## Verbs

The page's — owned by [references/website.md](website.md) — plus the two only a PARENT has: `rerender(ui)` and `unmount()`. No `goto` (a component has no address). The modifiers are the page's too: `see(focused(x))` asks where the keyboard is, `see(disabled(x))` / `see(enabled(x))` whether a control takes input.

## The result

Five accessors — `tree` `content` `html` `console` `errors` — described in [docs/16-component.md § The result](../../../docs/16-component.md#the-result). `content` is `innerText`: what a reader sees, so a `<style>` body and a hidden node are not in it.

`toMatch` is **awaited** on all five (the golden crosses the browser seam) and on a directory subject (it walks a disk); [docs/08-assertions.md](../../../docs/08-assertions.md) owns which matchers are IO.

```typescript
await expect(result.tree).toMatch('two-of-two-hundred.aria.yaml'); // _expected/, TEST_UPDATE=1
await expect(result.errors).toBeEmpty();
expect(result.html).toContain('row row--live');
```

## Checklist

- No `@testing-library/*`, no `happy-dom`, no `jsdom`, no `vitest/browser`, no `vitest-browser-*` in a test file (F6).
- No hand-rolled `browser:` block in a config (E6) — `component()` owns the provider pin, the msw worker, the JSX transform and the cold-cache pre-bundling.
- No DOM global in a `.test.ts` (G4); no `@vitest-environment happy-dom` anywhere (E5/E5b).
- A component that fetches something no contract declared FAILS the render, naming the request — including one given NO contract at all.
- A forgotten `await` on `toMatch` does not skip the assertion: it lands as an `Unhandled Error` blamed on no test, the test reports PASSED, and the run still exits non-zero.
- A name matches as a case-insensitive SUBSTRING: `button('Delete post')` also matches an `aria-label="Delete Post a"`. The W3 refusal names the accessible name each candidate matched on.
- Focus is never a golden — the ARIA tree carries none. Assert it with `see(focused(x))`.
