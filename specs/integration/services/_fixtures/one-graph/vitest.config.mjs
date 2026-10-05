const { integration } = await import(/* @vite-ignore */ process.env.RUNNER_ENTRY);

const files = { include: ['*.spec.mjs'] };

export default {
    test: {
        maxWorkers: 1,
        projects: [
            integration(
                process.env.RUNNER === undefined
                    ? files
                    : { ...files, runner: process.env.RUNNER },
            ),
        ],
    },
};
