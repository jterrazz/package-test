import { defineConfig } from 'tsdown';

/**
 * Three build groups by consumption model:
 *
 * - **ESM-only** — `index` (imported by vitest, which is ESM-only), plus the
 *   `checker`/`catalog` CLIs (invoked as `node dist/*.js`). None has a CommonJS
 *   consumer, so a `require` build would be dead weight.
 * - **Browser** — `browser/index`, what the `browser` condition of `exports["."]`
 *   resolves to, plus `browser-setup`, the setup file the `component()` project
 *   loads into the page. Built for a page (`platform: 'browser'`), with the
 *   four seams a page resolves itself left external. No `dts`: the published
 *   `types` entry is the node build's, so there is ONE type surface and a name
 *   cannot exist on one side only.
 * - **Dual** — the `oxlint` plugin config is loaded by oxlint from the
 *   consumer's project, which may itself be ESM or CJS, so it ships both.
 *
 * Sourcemaps are omitted: the published tarball carries runtime + types only.
 */
export default defineConfig([
    {
        clean: true,
        dts: true,
        entry: {
            catalog: 'src/lint/catalog-cli.ts',
            checker: 'src/lint/checker-cli.ts',
            index: 'src/index.ts',
            vitest: 'src/vitest/index.ts',
        },
        format: ['esm'],
        hash: false,
        outExtensions: () => ({ js: '.js' }),
        sourcemap: false,
    },
    {
        clean: false,
        dts: false,
        entry: {
            'browser/index': 'src/browser/index.ts',
        },
        deps: {
            neverBundle: ['msw/browser', 'react-dom/client', 'vitest', 'vitest-browser-react'],
        },
        format: ['esm'],
        hash: false,
        outExtensions: () => ({ js: '.js' }),
        platform: 'browser',
        sourcemap: false,
    },
    {
        clean: false,
        dts: true,
        entry: {
            oxlint: 'src/lint/plugin.ts',
        },
        format: ['esm', 'cjs'],
        hash: false,
        outExtensions: ({ format }) => ({
            js: format === 'cjs' ? '.cjs' : '.js',
        }),
        sourcemap: false,
    },
]);
