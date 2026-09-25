/**
 * MSW-based contract engine for node. Registers one chain's contracts as MSW
 * handlers — built by {@link buildContractHandlers}, the shape the page's
 * worker uses too — and serves them through the shared {@link ContractQueue},
 * the SAME queue the declared stub backend (website/mobile) consumes, so
 * selection semantics never diverge between engines.
 *
 * Strict by construction (CONVENTIONS D7): while a chain that declared at
 * least one contract is running, ANY outgoing HTTP request that matches no
 * contract — including one whose every matching contract is exhausted — fails
 * the spec with an explicit error. Chains with zero contracts never start MSW:
 * their network is not guarded (known scope).
 */
import type { Contract } from '../../stubs/contract.js';
import { buildContractHandlers, NO_CONTRACTS } from './handlers.js';
import type { ContractRegistration } from './handlers.js';
import { owningBodies } from './owned-body.js';

/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- the msw namespace crosses a lazy import */

export type { ContractRegistration } from './handlers.js';

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
export async function ensureContractServer(): Promise<void> {
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
 * Register a chain's contracts as MSW handlers. A trailing catch-all handler
 * records any request no contract accepted — the builder rethrows it as the
 * spec failure (rejecting the action promise, never an unhandled rejection).
 */
export async function registerContracts(
    contracts: readonly Contract[],
): Promise<ContractRegistration> {
    if (contracts.length === 0) {
        return NO_CONTRACTS;
    }

    await ensureContractServer();
    const { msw } = await loadMsw();
    const { handlers, violation } = buildContractHandlers(msw, contracts);
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
export async function stopContractServer(): Promise<void> {
    if (serverInstance !== null) {
        if (engineFetch !== null) {
            globalThis.fetch = engineFetch;
            engineFetch = null;
        }
        serverInstance.close();
        serverInstance = null;
    }
}
