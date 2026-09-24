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
