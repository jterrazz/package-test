import { defineSpecConfig, literate } from '@jterrazz/test/vitest';

// A published subpath: the runner-config surface F1 exempts because the
// package's own `exports` map declares it.
export default defineSpecConfig({
    plugins: [literate({ specification: './specs/app/app.specification.ts' })],
});
