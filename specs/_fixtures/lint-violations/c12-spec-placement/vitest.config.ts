import { defineSpecConfig } from '@jterrazz/test/vitest';

// The include names the suffix the mover retires — what a consumer whose
// Project states its own glob has, and what the rename leaves collecting
// Nothing unless the glob follows it.
export default defineSpecConfig({
    test: {
        projects: [{ include: ['specs/api/**/*.test.ts'], name: 'api' }],
    },
});
