/** Runner traffic is recognised by prefix, never by extension: msw bypasses a "common asset" path before `onUnhandledRequest`, which would let `/api/posts.json` through. */
import type { InterceptPort } from '../intercept/intercept.port.js';
import type { Stub } from '../stub.js';
import { buildStubHandlers } from './handlers.js';
import type { StubRegistration } from './handlers.js';

/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- the msw namespace crosses a lazy import: this module IS the boundary that gives it a shape */

/** What the runner itself fetches; everything else is the subject's traffic (`network-strict-after-first-stub`). */
const RUNNER_PREFIXES = ['/.artifacts/', '/@fs/', '/@id/', '/@vite', '/node_modules/', '/__vitest'];

let workerInstance: any = null;

export function isRunnerRequest(url: string): boolean {
    const { pathname } = new URL(url);
    return RUNNER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Served at `/mockServiceWorker.js` by the plugin `component()` registers, from the package's own `msw`. */
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

/** Starts even for an empty list: `network-strict-after-first-stub` is total here, a component given no stub has no network. */
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

/** Dropped at test end, not render end: a mounted component keeps fetching after its render resolves. */
export function mswWorker(atTestEnd: (teardown: () => void) => void): InterceptPort {
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
