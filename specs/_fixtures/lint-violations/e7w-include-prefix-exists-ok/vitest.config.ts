import { defineSpecConfig } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [{ include: ['specs/api/**/*.spec.ts'], name: 'api' }],
    },
});
