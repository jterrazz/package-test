import { defineConfig } from 'tsdown';

type Chunk = { moduleIds: string[] };

const ownedBySelf = ({ moduleIds }: Chunk): boolean =>
    moduleIds.length > 0 && moduleIds.every((id) => id.includes('/lint/self/'));

// ESM-only for the node entries and CLIs; the browser build has no `dts`, so there is one type surface; the oxlint plugin ships ESM and CJS, since a consumer's config may be either. `files` leaves the source maps out of the tarball.
export default defineConfig([
    {
        clean: true,
        deps: {
            alwaysBundle: ['@jterrazz/typescript/oxlint-config-names'],
        },
        dts: true,
        entry: {
            catalogue: 'lint/self/catalogue/chapters.cli.ts',
            checker: 'lint/checks/checker.cli.ts',
            coverage: 'lint/self/test-coverage/coverage.cli.ts',
            index: 'src/index.ts',
            'in-place-setup': 'src/expectations/in-place/in-place-setup.ts',
            'mobile-session': 'src/facets/mobile/session/mobile-session.ts',
            'route-coverage': 'src/facets/api/routes/route-coverage.ts',
            'route-split': 'src/facets/api/routes/route-split-cli.ts',
            'self-checker': 'lint/self/checks/checker.cli.ts',
            'self-oxlint': 'lint/self/rules/plugin.ts',
            'services-setup': 'src/world/services/containers/run-setup.ts',
            'temp-root': 'src/kernel/files/temp-root.ts',
            vitest: 'src/vitest/index.ts',
        },
        format: ['esm'],
        hash: false,
        outExtensions: () => ({ js: '.js' }),
        outputOptions: {
            chunkFileNames: (chunk: Chunk) => (ownedBySelf(chunk) ? 'self-[name].js' : '[name].js'),
        },
        sourcemap: true,
    },
    {
        clean: false,
        dts: false,
        entry: {
            'browser/index': 'src/index.browser.ts',
        },
        deps: {
            neverBundle: ['msw/browser', 'react-dom/client', 'vitest', 'vitest-browser-react'],
        },
        format: ['esm'],
        hash: false,
        outExtensions: () => ({ js: '.js' }),
        platform: 'browser',
        sourcemap: true,
    },
    {
        clean: false,
        dts: true,
        entry: {
            oxlint: 'lint/index.ts',
        },
        format: ['esm', 'cjs'],
        hash: false,
        outExtensions: ({ format }) => ({
            js: format === 'cjs' ? '.cjs' : '.js',
        }),
        // A default and named exports together are ambiguous to the bundler unless the interop is stated.
        outputOptions: { exports: 'named' },
        sourcemap: true,
    },
]);
