import { interceptThrough } from './module-intercept.js';
import type { Intercept } from './module-intercept.js';

/**
 * The module-scope network double, on msw's node server — what a test with no
 * chain to hang stubs on reaches for (chapter 16).
 */
export const intercept: Intercept = interceptThrough(async (stubs) => {
    // Reached through the same lazy import the chain uses: a static one here
    // Would pull the msw engine into every node consumer's graph at load, and
    // The engine exists to be paid for only by the specs that declare a stub.
    const { registerStubs } = await import('../network/server.js');
    return await registerStubs(stubs);
});
