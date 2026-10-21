import type { SetupServer } from 'msw/node';

import type { StubRegistration } from '../../intercept/intercept.js';
import type { Stub } from '../../stub.js';
import { buildStubHandlers } from '../msw-handlers.js';
import type { Msw } from '../msw-handlers.js';

async function loadMsw(): Promise<{ msw: Msw; setupServer: () => SetupServer }> {
    const [{ setupServer }, msw] = await Promise.all([import('msw/node'), import('msw')]);
    return { msw, setupServer: () => setupServer() };
}

let serverInstance: null | SetupServer = null;

// invariant: once per process.
async function ensureStubServer(): Promise<SetupServer> {
    if (serverInstance !== null) {
        return serverInstance;
    }
    const { setupServer } = await loadMsw();
    const server = setupServer();
    server.listen({ onUnhandledFrame: 'bypass' });
    serverInstance = server;
    return server;
}

/** The trailing catch-all records any request no stub accepted; the chain's pipeline rethrows it. */
export async function registerStubs(stubs: readonly Stub[]): Promise<StubRegistration> {
    const server = await ensureStubServer();
    const { msw } = await loadMsw();
    const { handlers, violation } = buildStubHandlers(msw, stubs);
    server.use(...handlers);

    return {
        cleanup: () => {
            server.resetHandlers();
        },
        violation,
    };
}

export async function stopStubServer(): Promise<void> {
    if (serverInstance !== null) {
        serverInstance.close();
        serverInstance = null;
    }
}
