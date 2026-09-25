import type { Stub } from '../stub.js';
import { buildStubHandlers, NO_STUBS } from './handlers.js';
import type { StubRegistration } from './handlers.js';
import { owningBodies } from './owned-body.js';

/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- the msw namespace crosses a lazy import */

let mswModule: any = null;
let mswHttp: any = null;

async function loadMsw(): Promise<{ msw: any; node: any }> {
    if (mswModule === null) {
        mswModule = await import('msw/node');
        mswHttp = await import('msw');
    }
    return { msw: mswHttp, node: mswModule };
}

let serverInstance: any = null;

/** The `fetch` the engine installed, which the owning wrapper sits on while it listens. */
let engineFetch: null | typeof fetch = null;

/** Once per process; reply bodies are handed over as owned streams, so a cancel settles. */
export async function ensureStubServer(): Promise<void> {
    if (serverInstance !== null) {
        return;
    }
    const { node } = await loadMsw();
    serverInstance = node.setupServer();
    serverInstance.listen({ onUnhandledRequest: 'bypass' });
    engineFetch = globalThis.fetch;
    globalThis.fetch = owningBodies(engineFetch);
}

/** The trailing catch-all records any request no stub accepted; the chain's pipeline rethrows it. */
export async function registerStubs(stubs: readonly Stub[]): Promise<StubRegistration> {
    if (stubs.length === 0) {
        return NO_STUBS;
    }

    await ensureStubServer();
    const { msw } = await loadMsw();
    const { handlers, violation } = buildStubHandlers(msw, stubs);
    serverInstance.use(...handlers);

    return {
        cleanup: () => {
            serverInstance.resetHandlers();
        },
        violation,
    };
}

export async function stopStubServer(): Promise<void> {
    if (serverInstance !== null) {
        if (engineFetch !== null) {
            globalThis.fetch = engineFetch;
            engineFetch = null;
        }
        serverInstance.close();
        serverInstance = null;
    }
}
