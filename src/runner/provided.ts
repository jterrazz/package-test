import type { RunServer } from '../facets/mobile/appium-server.js';

/**
 * What the run's global setups provide to a worker, read on the worker's side.
 * The runner owns the `vitest` edge, so a facet asks here rather than
 * importing the runner itself.
 */

/**
 * Where the run collects route ledgers — what the api project's global setup
 * provides; `undefined` for a run that measures no route coverage.
 */
export async function routesLedger(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('routesLedger');
    } catch {
        return undefined;
    }
}

/**
 * Where the run records its driver sessions — what the mobile project's
 * global setup provides; `undefined` for a run that shares no session, where
 * each runner opens and ends its own.
 */
export async function mobileSessions(): Promise<string | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('mobileSessions');
    } catch {
        return undefined;
    }
}

/**
 * The run's Appium server — what a `mobile({ device })` project's global
 * setup spawned and provides; `undefined` when each runner reaches its own.
 */
export async function mobileServer(): Promise<RunServer | undefined> {
    try {
        const { inject } = await import('vitest');
        return inject('mobileServer');
    } catch {
        return undefined;
    }
}
