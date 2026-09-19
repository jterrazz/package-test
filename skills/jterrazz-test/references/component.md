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

## The project (`vitest.config.ts`)

```typescript
import { component, defineSpecConfig, unit } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [unit(), component({ vite: './vite.config.ts', wrap: './src/providers.tsx' })],
    },
});
```

- `wrap` — a module PATH default-exporting `(ui) => ReactNode`: the app's own providers, around every render. A router is NOT this; it is a test's Given, on `.wrap()`.
- `vite` — the app's pipeline (path | object | function | promise). Only `plugins`, `resolve`, `esbuild`/`oxc`, `css`, `define`, `assetsInclude`, `envPrefix`, `json` are adopted; `root`, `build`, `server`, `publicDir` are dropped so the project still collects from where the config sits. Consumer plugins are CONCATENATED after the seam's.
- `clock`, `viewport` (default 1280×720), `timezone` (`'UTC'`), `locale` (`'en-US'`), `include`/`exclude`, `timeout`.
- It is `async`; `projects: [component({ … })]` is fine without `await`.
- Peers it needs: `@vitest/browser-playwright` (peers vitest on an EXACT version — bump both in one change), `vitest-browser-react`, `react`, `react-dom`, `vite`, `playwright` + `npx playwright install chromium`.

## The chain

```tsx
import { button, component, content, defineContract, http } from '@jterrazz/test';

const result = await component
    .intercept(listing) // contracts — strict from the first one (D7)
    .wrap((ui) => <Stub />) // a router stub, StrictMode, a test-local provider
    .clock('2026-03-04T09:30:00Z') // pins the page's Date
    .render(<PostTable />, async (visitor) => {
        await visitor.click(button('Apply'));
        await visitor.see(content('Showing 2 of 200 posts'));
    });
```

`.render()` also takes a DOM function: `.render((container) => renderRows(container, rows))`, whose optional return is its teardown. No React is loaded for it.

## Verbs

The page's — `click fill check select hover press see gone` — plus the two only a PARENT has: `rerender(ui)` and `unmount()`. No `goto` (a component has no address). `see(focused(button('Open')))` asks where the keyboard is; `gone(x)` is the absence primitive (`see` cannot prove something went away).

## The result

| Member    | Is                                                                       |
| --------- | ------------------------------------------------------------------------ |
| `tree`    | ARIA snapshot of the rendered body — the golden a rendered surface wants |
| `content` | rendered text of the document body                                       |
| `html`    | the mounted markup — the escape hatch for a class or an attribute        |
| `console` | every message, one `[type] text` line                                    |
| `errors`  | console errors only, plus any uncaught page error                        |

`toMatch` is **awaited** here and only here: the golden crosses the browser seam.

```typescript
await expect(result.tree).toMatch('two-of-two-hundred.aria.yaml'); // _expected/, TEST_UPDATE=1
await expect(result.errors).toBeEmpty();
expect(result.html).toContain('row row--live');
```

## Checklist

- No `@testing-library/*`, no `happy-dom`, no `jsdom`, no `vitest/browser`, no `vitest-browser-*` in a test file (F6).
- No hand-rolled `browser:` block in a config (E6) — `component()` owns the provider pin, the msw worker, the JSX transform and the cold-cache pre-bundling.
- No DOM global in a `.test.ts` (G4); no `@vitest-environment happy-dom` anywhere (E5/E5b).
- A component that fetches something no contract declared FAILS the render, naming the request.
- Focus is never a golden — the ARIA tree carries none. Assert it with `see(focused(x))`.
