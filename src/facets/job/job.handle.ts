import { getCallerDir } from '../../model/chain/caller.js';
import type { Job, SpecificationConfig } from '../../model/chain/config.js';
import { resolveRoot } from '../../model/chain/resolve.js';
import { registerMatchers } from '../../model/goldens/matchers.js';
import type { Orchestrator } from '../../model/services/orchestrator.js';
import {
    declaredDatabaseKeys,
    releaseIsolation,
    startServices,
} from '../../model/services/services.js';
import type {
    DatabaseKeys,
    ServiceRecord,
    StartedServices,
} from '../../model/services/services.js';
import type { JobSpecification } from './job.facet.js';
import { jobFacet } from './job.facet.js';

// ── Types ──

/** Options for {@link startJob | specification.job}. */
export type JobSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /**
     * Named jobs triggerable via `job.trigger(name)` — a factory receiving
     * the started services record, or a static array. Jobs run in-process by
     * definition (CONVENTIONS A8).
     */
    jobs: ((services: Services) => Job[]) | Job[];
    /** Project root override — see the `root` option of `specification.api()`. */
    root?: string;
    /** Named infrastructure record started via testcontainers. */
    services?: Services;
};

/**
 * The record returned by {@link startJob | specification.job}. Destructure
 * with the canonical names (CONVENTIONS A3):
 *
 *     const { job, cleanup } = await specification.job(…);
 */
export type JobHandle<DatabaseKey extends string = string> = {
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    job: JobSpecification<DatabaseKey>;
    /** The orchestrator managing the test infrastructure lifecycle. */
    orchestrator: null | Orchestrator;
};

// ── Constructor ──

export async function startJob<Services extends ServiceRecord>(
    options: JobSpecificationOptions<Services>,
): Promise<JobHandle<DatabaseKeys<Services>>> {
    // Caller detection must run before any await — async resumption drops
    // The calling file's frames from the stack.
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    const services = (options.services ?? {}) as Services;
    const databaseKeys = declaredDatabaseKeys(services);

    let started: null | StartedServices = null;
    if (Object.keys(services).length > 0) {
        started = await startServices(services, root, { type: 'none' });
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
            await started?.stopProcesses();
            await releaseIsolation(services);
            if (started) {
                await started.orchestrator.stop();
            }
        },
        job: jobFacet.open(config),
        orchestrator: started?.orchestrator ?? null,
    };
}
