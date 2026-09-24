import { mergeConfig } from 'vitest/config';

const { mobile } = await import(/* @vite-ignore */ process.env.RUNNER_ENTRY);

// The simulator tools are the stub beside this config: the run boots nothing real.
process.env.PATH = `${import.meta.dirname}/bin:${process.env.PATH}`;

export default {
    test: {
        projects: [
            mergeConfig(
                { test: { globalSetup: [process.env.DOUBLE_SETUP] } },
                mobile({ device: { name: 'iPhone 17' }, include: ['*.spec.mjs'], root: 'app' }),
            ),
        ],
    },
};
