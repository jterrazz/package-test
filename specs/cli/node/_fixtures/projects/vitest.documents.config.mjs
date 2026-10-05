import { cli, defineSpecConfig } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            cli({
                literate: {
                    include: ['documents/*.spec.yaml'],
                    runner: './specs/cli/cli.specification.ts',
                },
            }),
        ],
    },
});
