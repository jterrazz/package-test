import type { SetupServer } from 'msw/node';

import type { StubRegistration } from '../../intercept/intercept.js';
import type { Stub } from '../../stub.js';
import { buildStubHandlers } from '../msw-handlers.js';
import type { Msw } from '../msw-handlers.js';
import { owningBodies } from './owned-body.js';

async function loadMsw(): Promise<{ msw: Msw; setupServer: () => SetupServer }> {
    const [{ setupServer }, msw] = await Promise.all([import('msw/node'), import('msw')]);
    return { msw, setupServer: () => setupServer() };
}

let serverInstance: null | SetupServer = null;

// outside: the `fetch` msw installed, which the owning wrapper sits on while it listens.
let installedFetch: null | typeof fetch = null;

// invariant: once per process; reply bodies are handed over as owned streams, so a cancel settles.
async function ensureStubServer(): Promise<SetupServer> {
    if (serverInstance !== null) {
        return serverInstance;
    }
    const { setupServer } = await loadMsw();
    const server = setupServer();
    server.listen({ onUnhandledRequest: 'bypass' });
    serverInstance = server;
    installedFetch = globalThis.fetch;
    globalThis.fetch = owningBodies(installedFetch);
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
        if (installedFetch !== null) {
            globalThis.fetch = installedFetch;
            installedFetch = null;
        }
        serverInstance.close();
        serverInstance = null;
    }
}
