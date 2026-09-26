import type { UserConfig } from 'vite';

const config: UserConfig = {
    define: { __NESTED_APP__: 'true' },
    root: '/somewhere/else',
};

export default config;
