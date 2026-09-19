/**
 * The contract engine INSIDE the page — msw's service worker.
 *
 * Same contracts, same queue, same strictness as the node engine
 * ({@link buildContractHandlers}); what differs is the transport and what is
 * allowed to pass unhandled. A page under Vitest Browser Mode is served by
 * Vite, so the module graph, the dependency cache and the runner's own channel
 * all travel as HTTP requests the spec never declared. They are recognised by
 * PREFIX rather than by extension, because msw bypasses a "common asset" path
 * before `onUnhandledRequest` ever runs — an extension test would let a real
 * `/api/posts.json` through on the same ground.
 */
import type { Contract } from '../../specification/contracts/contract.js';
import { buildContractHandlers, NO_CONTRACTS } from './handlers.js';
import type { ContractRegistration } from './handlers.js';

/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- the msw namespace crosses a lazy import: this module IS the boundary that gives it a shape */

/**
 * What the runner itself fetches. Everything else a page asks for is the
 * subject's own traffic and answers to its contracts (D7).
 */
const RUNNER_PREFIXES = ['/@fs/', '/@id/', '/@vite', '/node_modules/', '/__vitest'];

let workerInstance: any = null;

/** Is this the runner's own traffic rather than the subject's? */
function isRunnerRequest(url: string): boolean {
    const { pathname } = new URL(url);
    return RUNNER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Start the worker once per page. The script is served at `/mockServiceWorker.js`
 * by the plugin `component()` registers, out of the package's OWN `msw`
 * install — so no consumer ever runs `msw init` and no consumer declares `msw`.
 */
export async function ensureContractWorker(): Promise<void> {
    if (workerInstance !== null) {
        return;
    }
    const { setupWorker } = await import('msw/browser');
    workerInstance = setupWorker();
    await workerInstance.start({
        onUnhandledRequest: (request: Request, print: { error: () => void }) => {
            if (!isRunnerRequest(request.url)) {
                print.error();
            }
        },
        quiet: true,
        serviceWorker: { url: '/mockServiceWorker.js' },
    });
}

/** Register one render's contracts on the page's worker. */
export async function registerWorkerContracts(
    contracts: readonly Contract[],
): Promise<ContractRegistration> {
    if (contracts.length === 0) {
        return NO_CONTRACTS;
    }
    await ensureContractWorker();
    const msw = await import('msw');
    const { handlers, violation } = buildContractHandlers(msw, contracts);
    workerInstance.use(...handlers);
    return {
        cleanup: () => {
            workerInstance.resetHandlers();
        },
        violation,
    };
}

/** Drop every handler the page still carries — the per-test reset. */
export function resetWorkerContracts(): void {
    if (workerInstance !== null) {
        workerInstance.resetHandlers();
    }
}
