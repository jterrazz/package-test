import { defineSpecConfig } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            {
                include: [
                    'specs/api/**/*.test.ts',
                    'specs/api/users/creation.test.ts',
                ],
                name: 'api',
            },
            { include: ['src/**/*.test.ts', 'specs/build/**/*.test.ts'], name: 'unit' },
        ],
    },
});
