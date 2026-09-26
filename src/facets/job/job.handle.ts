import { resolveRoot } from '../../../lint/engine/project/resolve.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { declaredDatabaseKeys } from '../../world/services/services.js';
import type { DatabaseKeys, ServiceRecord, ServicesConfig } from '../../world/services/services.js';
import type { Orchestrator } from '../../world/services/startup/orchestrator.js';
import { releaseIsolation, startServices } from '../../world/services/startup/start-services.js';
import type { StartedServices } from '../../world/services/startup/start-services.js';
import type { JobSpecification } from './job.facet.js';
import { jobFacet } from './job.facet.js';

/** A named job that can be triggered via job.trigger(). */
export type Job = {
    name: string;
    execute: () => Promise<void>;
};

export type JobConfig = ServicesConfig & { jobs?: Job[] | undefined };

/** Options for {@link startJob | specification.job}. */
export type JobSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** Named jobs `job.trigger(name)` runs: a factory of the started services, or an array. */
    jobs: ((services: Services) => Job[]) | Job[];
    /** Project root override — see the `root` option of `specification.api()`. */
    root?: string;
    /** Named infrastructure record started via testcontainers. */
    services?: Services;
};

/** What `specification.job()` returns: `const { job, cleanup } = …` (`no-runner-alias`). */
export type JobHandle<DatabaseKey extends string = string> = {
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    job: JobSpecification<DatabaseKey>;
    /** The orchestrator managing the test infrastructure lifecycle. */
    orchestrator: null | Orchestrator;
};

export async function startJob<Services extends ServiceRecord>(
    options: JobSpecificationOptions<Services>,
): Promise<JobHandle<DatabaseKeys<Services>>> {
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

    const config: JobConfig = {
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
