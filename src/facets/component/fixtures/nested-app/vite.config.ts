import type { UserConfig } from 'vite';

/**
 * The Vite config of an app that lives in a subdirectory — the file
 * `vitest.config.ts` beside it names as `'./vite.config.ts'`.
 */
const config: UserConfig = {
    define: { __NESTED_APP__: 'true' },
    root: '/somewhere/else',
};

export default config;
