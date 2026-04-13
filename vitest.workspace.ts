import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
    {
        test: {
            name: 'fast',
            include: [
                'src/**/*.test.ts',
                'tests/e2e/exec/**/*.test.ts',
                'tests/e2e/assertions/assertions-cli.e2e.test.ts',
                'tests/e2e/assertions/directory.e2e.test.ts',
            ],
        },
    },
    {
        test: {
            name: 'infra',
            fileParallelism: false,
            include: [
                'tests/e2e/assertions/assertions-api.e2e.test.ts',
                'tests/e2e/assertions/assertions-shared.e2e.test.ts',
                'tests/e2e/lifecycle/**/*.test.ts',
                'tests/e2e/requests/**/*.test.ts',
                'tests/e2e/seeding/**/*.test.ts',
                'tests/integration/**/*.test.ts',
            ],
        },
    },
]);
