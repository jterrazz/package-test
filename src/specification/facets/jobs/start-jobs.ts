import { registerMatchers } from '../../../vitest/matchers.js';
import { createJobsFacet } from '../_common/builder.js';
import type { JobHandle, JobsSpecification, SpecificationConfig } from '../_common/builder.js';
import { getCallerDir } from '../_common/caller.js';
import type { Orchestrator } from '../_common/orchestrator.js';
import { resolveRoot } from '../_common/resolve.js';
import { declaredDatabaseKeys, releaseIsolation, startServices } from '../_common/services.js';
import type { DatabaseKeys, ServiceRecord, StartedServices } from '../_common/services.js';

// ── Types ──

/** Options for {@link startJobs | specification.jobs}. */
export type JobsSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /**
     * Named jobs triggerable via `jobs.trigger(name)` — a factory receiving
     * the started services record, or a static array. Jobs run in-process by
     * definition (CONVENTIONS A5/A8) — there is no mode.
     */
    jobs: ((services: Services) => JobHandle[]) | JobHandle[];
    /** Project root override — see the `root` option of `specification.api()`. */
    root?: string;
    /** Named infrastructure record started via testcontainers. */
    services?: Services;
};

/**
 * The record returned by {@link startJobs | specification.jobs}. Destructure
 * with the canonical names (CONVENTIONS A3):
 *
 *     const { jobs, cleanup } = await specification.jobs(…);
 */
export type JobsHandle<DatabaseKey extends string = string> = {
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    jobs: JobsSpecification<DatabaseKey>;
    /** The orchestrator managing the test infrastructure lifecycle. */
    orchestrator: null | Orchestrator;
};

// ── Constructor ──

export async function startJobs<Services extends ServiceRecord>(
    options: JobsSpecificationOptions<Services>,
): Promise<JobsHandle<DatabaseKeys<Services>>> {
    // Caller detection must run before any await — async resumption drops
    // The calling file's frames from the stack.
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    const services = (options.services ?? {}) as Services;
    const databaseKeys = declaredDatabaseKeys(services);

    let started: null | StartedServices = null;
    if (Object.keys(services).length > 0) {
        started = await startServices(services, root);
    }

    const jobHandles = typeof options.jobs === 'function' ? options.jobs(services) : options.jobs;

    const config: SpecificationConfig = {
        database: started?.database,
        databaseKeys,
        databases: started?.databases,
        jobs: jobHandles,
    };

    return {
        cleanup: async () => {
            await releaseIsolation(services);
            if (started) {
                await started.orchestrator.stop();
            }
        },
        jobs: createJobsFacet(config),
        orchestrator: started?.orchestrator ?? null,
    };
}
