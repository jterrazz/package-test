import { cli } from '@jterrazz/test/vitest';

export default {
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
};
