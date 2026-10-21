import { mergeConfig } from 'vitest/config';

const { mobile } = await import(/* @vite-ignore */ process.env.RUNNER_ENTRY);

const parallel = process.env.MOBILE_PARALLEL === '1';

export default {
    test: {
        ...(parallel ? { maxWorkers: 2 } : {}),
        projects: [
            mergeConfig(
                { test: { globalSetup: [process.env.DOUBLE_SETUP] } },
                mobile({ include: ['*.spec.mjs'], ...(parallel ? { serial: false } : {}) }),
            ),
        ],
    },
};
