import {
    api,
    cli,
    defineSpecConfig,
    integration,
    job,
    lint,
    mobile,
    unit,
    website,
} from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [unit(), api(), cli(), job(), integration(), website(), mobile(), lint()],
    },
});
