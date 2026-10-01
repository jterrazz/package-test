import type { InterceptPort } from '../../intercept/intercept.port.js';

/** msw's server is loaded when a chain first declares a stub; a chain with none arms nothing (`network-strict-after-first-stub`, known scope). */
export const mswNode: InterceptPort = {
    accepts: () => {
        // Every chain of this process may declare stubs: the process has a network.
    },
    arm: async (stubs) => {
        if (stubs.length === 0) {
            return {};
        }
        const { registerStubs } = await import('./stub-server.js');
        const registration = await registerStubs(stubs);
        return { release: registration.cleanup, violation: registration.violation };
    },
};
