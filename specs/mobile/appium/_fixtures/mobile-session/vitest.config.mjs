import { mergeConfig } from 'vitest/config';

const { mobile } = await import(/* @vite-ignore */ process.env.RUNNER_ENTRY);

export default {
    test: {
        projects: [
            mergeConfig({ test: { globalSetup: [process.env.DOUBLE_SETUP] } }, mobile({ include: ['*.spec.mjs'] })),
        ],
    },
};
