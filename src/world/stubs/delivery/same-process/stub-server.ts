import type { StubRegistration } from '../../intercept/intercept.js';
import type { Stub } from '../../stub.js';
import { buildStubHandlers } from '../msw-handlers.js';
import { owningBodies } from './owned-body.js';

/** Zero stubs under node: nothing is guarded, the process has traffic of its own (`network-strict-after-first-stub`, known scope). */
const NO_STUBS: StubRegistration = {
    cleanup: () => {},
    violation: () => null,
};

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

/** The `fetch` msw installed, which the owning wrapper sits on while it listens. */
let installedFetch: null | typeof fetch = null;

/** Once per process; reply bodies are handed over as owned streams, so a cancel settles. */
async function ensureStubServer(): Promise<void> {
    if (serverInstance !== null) {
        return;
    }
    const { node } = await loadMsw();
    serverInstance = node.setupServer();
    serverInstance.listen({ onUnhandledRequest: 'bypass' });
    installedFetch = globalThis.fetch;
    globalThis.fetch = owningBodies(installedFetch);
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
        if (installedFetch !== null) {
            globalThis.fetch = installedFetch;
            installedFetch = null;
        }
        serverInstance.close();
        serverInstance = null;
    }
}
