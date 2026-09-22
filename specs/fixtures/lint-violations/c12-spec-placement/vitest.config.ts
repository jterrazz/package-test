import { defineSpecConfig } from '@jterrazz/test/vitest';

// The include names the suffix the mover retires — what a consumer whose
// Project states its own glob has, and what the rename leaves collecting
// Nothing unless the glob follows it. The `unit` project below names the
// Same suffix over `src/`, where the mover renames nothing and the glob is
// Right as it stands.
export default defineSpecConfig({
    test: {
        projects: [
            {
                include: [
                    // 'specs/api/legacy/**/*.test.ts' — retired, kept for the record
                    'specs/api/**/*.test.ts',
                    'specs/api/users/creation.test.ts',
                ],
                name: 'api',
            },
            { include: ['src/**/*.test.ts', 'specs/build/**/*.test.ts'], name: 'unit' },
        ],
    },
});
