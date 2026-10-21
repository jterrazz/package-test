import { api, cli, unit, website } from '@jterrazz/test/vitest';

export default {
    test: {
        projects: [
            unit({ roots: ['packages', 'apps/'] }),
            api({ exclude: ['specs/api/slow/**'], include: ['suites/api/**/*.test.ts', 'specs/api/**/*.spec.ts'] }),
            cli({ literate: false }),
            website({ include: ['e2e/**/*.test.ts'] }),
        ],
    },
};
