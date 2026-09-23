import { cli, defineSpecConfig } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [cli({ literate: { specification: './specs/cli/cli.specification.ts' } })],
    },
});
