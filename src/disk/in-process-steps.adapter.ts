import type { PreparePort } from './prepare.port.js';

/** A step is the test's own code: it runs in the test's process, one after the other. */
export const inProcessSteps: PreparePort = {
    run: async (steps, workDir) => {
        for (const step of steps) {
            await step(workDir);
        }
    },
};
