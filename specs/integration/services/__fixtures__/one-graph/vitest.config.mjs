const helpers = await import(/* @vite-ignore */ process.env.RUNNER_ENTRY);

const helper = process.env.HELPER ?? 'integration';
const files = { include: ['*.spec.mjs'], ...(helper === 'cli' ? { literate: false } : {}) };

export default {
    test: {
        maxWorkers: 1,
        projects: [
            helpers[helper](
                process.env.RUNNER === undefined
                    ? files
                    : { ...files, runner: process.env.RUNNER },
            ),
        ],
    },
};
