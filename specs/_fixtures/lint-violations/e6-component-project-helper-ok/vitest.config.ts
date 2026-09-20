import { component, defineSpecConfig, unit } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [unit(), component({ wrap: './src/providers.tsx' })],
    },
});
