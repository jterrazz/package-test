import type { SetupServer } from 'msw/node';

import type { StubRegistration } from '../../intercept/intercept.js';
import type { Stub } from '../../stub.js';
import { buildStubHandlers } from '../msw-handlers.js';
import type { Msw } from '../msw-handlers.js';
import { owningBodies } from './owned-body.js';

let loaded: null | { msw: Msw; setupServer: () => SetupServer } = null;

async function loadMsw(): Promise<{ msw: Msw; setupServer: () => SetupServer }> {
    if (loaded !== null) {
        return loaded;
    }
    const [{ setupServer }, msw] = await Promise.all([import('msw/node'), import('msw')]);
    const modules = { msw, setupServer: () => setupServer() };
    loaded = modules;
    return modules;
}

let serverInstance: null | SetupServer = null;

/** The `fetch` msw installed, which the owning wrapper sits on while it listens. */
let installedFetch: null | typeof fetch = null;

/** Once per process; reply bodies are handed over as owned streams, so a cancel settles. */
async function ensureStubServer(): Promise<void> {
    if (serverInstance !== null) {
        return;
    }
    const { setupServer } = await loadMsw();
    const server = setupServer();
    server.listen({ onUnhandledRequest: 'bypass' });
    serverInstance = server;
    installedFetch = globalThis.fetch;
    globalThis.fetch = owningBodies(installedFetch);
}

/** The trailing catch-all records any request no stub accepted; the chain's pipeline rethrows it. */
export async function registerStubs(stubs: readonly Stub[]): Promise<StubRegistration> {
    await ensureStubServer();
    const { msw } = await loadMsw();
    const { handlers, violation } = buildStubHandlers(msw, stubs);
    serverInstance?.use(...handlers);

    return {
        cleanup: () => {
            serverInstance?.resetHandlers();
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
