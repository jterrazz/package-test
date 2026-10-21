import {
    api,
    cli,
    integration,
    job,
    lint,
    mobile,
    unit,
    website,
} from '@jterrazz/test/vitest';

export default {
    test: {
        projects: [unit(), api(), cli(), job(), integration(), website(), mobile(), lint()],
    },
};
