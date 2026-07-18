import { defineConfig } from 'tsdown';

/**
 * Two build groups by consumption model:
 *
 * - **ESM-only** — `index` (imported by vitest, which is ESM-only), plus the
 *   `checker`/`catalog` CLIs (invoked as `node dist/*.js`). None has a CommonJS
 *   consumer, so a `require` build would be dead weight.
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
        },
        format: ['esm'],
        hash: false,
        outExtensions: () => ({ js: '.js' }),
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
