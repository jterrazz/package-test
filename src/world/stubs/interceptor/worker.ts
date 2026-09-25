/**
 * The stub engine INSIDE the page — msw's service worker.
 *
 * Same stubs, same queue, same strictness as the node engine
 * ({@link buildStubHandlers}); what differs is the transport and what is
 * allowed to pass unhandled. A page under Vitest Browser Mode is served by
 * Vite, so the module graph, the dependency cache and the runner's own channel
 * all travel as HTTP requests the spec never declared. They are recognised by
 * PREFIX rather than by extension, because msw bypasses a "common asset" path
 * before `onUnhandledRequest` ever runs — an extension test would let a real
 * `/api/posts.json` through on the same ground.
 */
import type { Armed } from '../../../kernel/chain/capability.js';
import type { Stub } from '../stub.js';
import { buildStubHandlers } from './handlers.js';
import type { StubRegistration } from './handlers.js';

/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- the msw namespace crosses a lazy import: this module IS the boundary that gives it a shape */

/**
 * What the runner itself fetches. Everything else a page asks for is the
 * subject's own traffic and answers to its stubs (D7).
 */
const RUNNER_PREFIXES = ['/.artifacts/', '/@fs/', '/@id/', '/@vite', '/node_modules/', '/__vitest'];

let workerInstance: any = null;

/**
 * Is this the runner's own traffic rather than the subject's?
 *
 * In a page EVERY module is an HTTP request: the test file, the seam, the
 * dependency cache Vite optimised, the runner's own channel. None of them is
 * the component's network, and none of them can be declared by a stub, so
 * they are recognised by PREFIX — never by extension, because msw bypasses a
 * "common asset" path before `onUnhandledRequest` ever runs and an extension
 * test would let a real `/api/posts.json` through on the same ground.
 */
export function isRunnerRequest(url: string): boolean {
    const { pathname } = new URL(url);
    return RUNNER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Start the worker once per page. The script is served at `/mockServiceWorker.js`
 * by the plugin `component()` registers, out of the package's OWN `msw`
 * install — so no consumer ever runs `msw init` and no consumer declares `msw`.
 */
export async function ensureStubWorker(): Promise<void> {
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

/**
 * Register one render's stubs on the page's worker.
 *
 * The worker starts even when the list is empty: on this facet D7 is TOTAL —
 * a component that was given no stub has no network, and a fetch it makes
 * anyway is named by {@link StubRegistration.violation} rather than
 * answered by whatever the dev server happens to have at that path.
 */
export async function registerWorkerStubs(stubs: readonly Stub[]): Promise<StubRegistration> {
    await ensureStubWorker();
    const msw = await import('msw');
    const { handlers, violation } = buildStubHandlers(msw, stubs, isRunnerRequest);
    workerInstance.use(...handlers);
    return {
        cleanup: () => {
            workerInstance.resetHandlers();
        },
        violation,
    };
}

/** Drop every handler the page still carries — the per-test reset. */
export function resetWorkerStubs(): void {
    if (workerInstance !== null) {
        workerInstance.resetHandlers();
    }
}

/**
 * The network of the PAGE, as a chain arms it: every render registers its
 * stubs — none at all included, strictness is total here — and the page
 * drops them when the test ends, handed the runner's "after this test"
 * because a mounted component keeps fetching after its render resolves.
 */
export function mswWorker(atTestEnd: (teardown: () => void) => void): {
    readonly accepts: () => void;
    readonly arm: (stubs: readonly Stub[]) => Promise<Armed>;
} {
    return {
        accepts: () => {
            // Every chain of a page may declare stubs: the worker serves them all.
        },
        arm: async (stubs) => {
            const registration = await registerWorkerStubs(stubs);
            atTestEnd(resetWorkerStubs);
            return { violation: registration.violation };
        },
    };
}
