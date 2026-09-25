/**
 * MSW-based stub engine for node. Registers one chain's stubs as MSW
 * handlers — built by {@link buildStubHandlers}, the shape the page's
 * worker uses too — and serves them through the shared {@link StubQueue},
 * the SAME queue the declared stub backend (website/mobile) consumes, so
 * selection semantics never diverge between engines.
 *
 * Strict by construction (CONVENTIONS D7): while a chain that declared at
 * least one stub is running, ANY outgoing HTTP request that matches no
 * stub — including one whose every matching stub is exhausted — fails
 * the spec with an explicit error. Chains with zero stubs never start MSW:
 * their network is not guarded (known scope).
 */
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

/**
 * Start the MSW server (once per process), with the body of every reply to
 * `fetch` handed to the caller as a stream this package owns
 * ({@link owningBodies}), so a subject that cancels a body sees the cancel
 * settle.
 */
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

/**
 * Register a chain's stubs as MSW handlers. A trailing catch-all handler
 * records any request no stub accepted — the chain's pipeline
 * (`model/chain/perform.ts`) rethrows it as the spec failure (rejecting the
 * action promise, never an unhandled rejection).
 */
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

/**
 * Stop the MSW server (call in afterAll).
 */
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
