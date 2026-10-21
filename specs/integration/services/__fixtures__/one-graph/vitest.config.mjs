const helpers = await import(/* @vite-ignore */ process.env.RUNNER_ENTRY);

const helper = process.env.HELPER ?? 'integration';
const include = process.env.OTHER === undefined ? ['first.spec.mjs', 'second.spec.mjs'] : ['first.spec.mjs', 'other.spec.mjs'];
const files = { include, ...(helper === 'cli' ? { literate: false } : {}) };

export default {
    test: {
        maxWorkers: 1,
        projects: [
            helpers[helper](
                process.env.RUNNER === undefined
                    ? files
                    : { ...files, runner: process.env.RUNNER.includes(',') ? process.env.RUNNER.split(',') : process.env.RUNNER },
            ),
        ],
    },
};
