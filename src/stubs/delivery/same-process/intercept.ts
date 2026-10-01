import { interceptThrough } from '../../intercept/intercept.js';
import type { Intercept } from '../../intercept/intercept.js';

/** The module-scope network double, on msw's node server. */
export const intercept: Intercept = interceptThrough(async (stubs) => {
    // Lazy, as on the chain: a static import would load msw into every node consumer's graph.
    const { registerStubs } = await import('./stub-server.js');
    return await registerStubs(stubs);
});
