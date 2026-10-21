import type { SetupWorker } from 'msw/browser';

import type { StubRegistration } from '../../intercept/intercept.js';
import type { InterceptPort } from '../../intercept/intercept.port.js';
import type { Stub } from '../../stub.js';
import { buildStubHandlers } from '../msw-handlers.js';

// outside: what the runner itself fetches, everything else being the subject's traffic (`network-strict-after-first-stub`); matched by prefix, never by extension: an extension rule, as msw's `isCommonAssetRequest` is, would let `/api/posts.json` through.
const RUNNER_PREFIXES = ['/.artifacts/', '/@fs/', '/@id/', '/@vite', '/node_modules/', '/__vitest'];

let workerInstance: null | SetupWorker = null;

export function isRunnerRequest(url: string): boolean {
    const { pathname } = new URL(url);
    return RUNNER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** msw's hook for a frame no handler took: the subject's HTTP request prints msw's error; the runner's own request and a WebSocket frame, which carries none, pass. */
export function onUnhandledFrame({
    defaults,
    frame,
}: {
    readonly defaults: { readonly error: () => void };
    readonly frame: { readonly data: unknown };
}): void {
    const { data } = frame;
    if (typeof data !== 'object' || data === null || !('request' in data)) {
        return;
    }
    if (data.request instanceof Request && !isRunnerRequest(data.request.url)) {
        defaults.error();
    }
}

// outside: served at `/mockServiceWorker.js` by the plugin `component()` registers, from the package's own `msw`.
async function ensureStubWorker(): Promise<void> {
    if (workerInstance !== null) {
        return;
    }
    const { setupWorker } = await import('msw/browser');
    const worker = setupWorker();
    workerInstance = worker;
    await worker.start({
        onUnhandledFrame,
        quiet: true,
        serviceWorker: { url: '/mockServiceWorker.js' },
    });
}

/** Starts even for an empty list: `network-strict-after-first-stub` is total here, a component given no stub has no network. */
export async function registerWorkerStubs(stubs: readonly Stub[]): Promise<StubRegistration> {
    await ensureStubWorker();
    const msw = await import('msw');
    const { handlers, violation } = buildStubHandlers(msw, stubs, isRunnerRequest);
    workerInstance?.use(...handlers);
    return {
        cleanup: () => {
            workerInstance?.resetHandlers();
        },
        violation,
    };
}

// invariant: drop every handler the page still carries: the per-test reset.
function resetWorkerStubs(): void {
    if (workerInstance !== null) {
        workerInstance.resetHandlers();
    }
}

/** Dropped at test end, not render end: a mounted component keeps fetching after its render resolves. */
export function mswWorker(atTestEnd: (teardown: () => void) => void): InterceptPort {
    return {
        accepts: () => {
            // invariant: every chain of a page may declare stubs: the worker serves them all.
        },
        arm: async (stubs) => {
            const registration = await registerWorkerStubs(stubs);
            atTestEnd(resetWorkerStubs);
            return { violation: registration.violation };
        },
    };
}
