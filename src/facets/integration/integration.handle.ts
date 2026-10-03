import { resolveRoot } from '../../../lint/kit/project/resolve.js';
import type { Started } from '../../chain/config.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import { declaredDatabaseKeys, declaredServices } from '../../services/services.js';
import type { DatabaseKeys, ServiceRecord, ServicesConfig } from '../../services/services.js';
import { releaseIsolation, startServices } from '../../services/startup/start-services.js';
import type { StartedServices } from '../../services/startup/start-services.js';
import type { IntegrationSpecification } from './integration.facet.js';
import { integrationFacet } from './integration.facet.js';

/** Options for {@link startIntegration | specification.integration}. */
export type IntegrationSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** Project-root override — see the `root` option of `specification.api()`. */
    root?: string;
    /** Services the module is specified against; omit for a pure module whose oracle is a golden. */
    services?: Services;
};

/** What `specification.integration()` returns: `const { integration, cleanup } = …` (`no-runner-alias`). */
export type IntegrationHandle<
    Services extends ServiceRecord = ServiceRecord,
    DatabaseKey extends string = string,
> = {
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    integration: IntegrationSpecification<Services, DatabaseKey>;
};

export async function startIntegration<Services extends ServiceRecord>(
    options: IntegrationSpecificationOptions<Services> = {},
): Promise<IntegrationHandle<Services, DatabaseKeys<Services>>> {
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    const services = declaredServices(options.services);
    const databaseKeys = declaredDatabaseKeys(services);

    let started: null | StartedServices = null;
    if (Object.keys(services).length > 0) {
        started = await startServices(services, root, { type: 'none' });
    }

    const config: Started<ServicesConfig, 'services'> = {
        database: started?.database,
        databaseKeys,
        databases: started?.databases,
        root,
        services,
    };

    return {
        cleanup: async () => {
            await started?.stopProcesses();
            await releaseIsolation(services);
            if (started) {
                await started.orchestrator.stop();
            }
        },
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- one composition opens the chain for every record; `Services` is this constructor's type parameter, which the chain hands `.call()` as it was started
        integration: integrationFacet.open(config) as IntegrationSpecification<
            Services,
            DatabaseKeys<Services>
        >,
    };
}
