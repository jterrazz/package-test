import { component, unit } from '@jterrazz/test/vitest';

export default {
    test: {
        projects: [unit(), component({ wrap: './src/providers.tsx' })],
    },
};
