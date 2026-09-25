import type { InterceptPort } from '../intercept/intercept.port.js';

/**
 * The network of THIS process, served by msw's node interceptor. The engine
 * is imported when a chain first declares a stub, so a run that declares
 * none never loads it; a chain with none arms nothing and is unguarded — the
 * process has real traffic of its own (CONVENTIONS D7, known scope).
 */
export const mswNode: InterceptPort = {
    accepts: () => {
        // Every chain of this process may declare stubs: the process has a network.
    },
    arm: async (stubs) => {
        if (stubs.length === 0) {
            return {};
        }
        const { registerStubs } = await import('./server.js');
        const registration = await registerStubs(stubs);
        return { release: registration.cleanup, violation: registration.violation };
    },
};
