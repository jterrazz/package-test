import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts', 'src/services.ts', 'src/mock.ts', 'src/intercept.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    hash: false,
    outExtensions: ({ format }) => ({
        js: format === 'cjs' ? '.cjs' : '.js',
    }),
});
