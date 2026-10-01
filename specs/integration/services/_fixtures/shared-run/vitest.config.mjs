const { integration, job } = await import(/* @vite-ignore */ process.env.RUNNER_ENTRY);

export default {
    test: {
        projects: [integration({ include: ['integration.spec.mjs'] }), job({ include: ['job.spec.mjs'] })],
    },
};
