import type { SpecificationConfig } from '../../core/chain/builder.js';
import { getCallerDir } from '../../core/chain/caller.js';
import { resolveRoot } from '../../core/chain/resolve.js';
import {
    declaredDatabaseKeys,
    releaseIsolation,
    startServices,
} from '../../core/chain/services.js';
import type { DatabaseKeys, ServiceRecord, StartedServices } from '../../core/chain/services.js';
import { registerMatchers } from '../../core/goldens/matchers.js';
import { createIntegrationFacet } from './integration.chain.js';
import type { IntegrationSpecification } from './integration.chain.js';

// ── Types ──

/** Options for {@link startIntegration | specification.integration}. */
export type IntegrationSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** Project-root override — see the `root` option of `specification.api()`. */
    root?: string;
    /**
     * Named infrastructure the module is specified AGAINST — a real database,
     * a real cache, a `process()` it talks to. Omit it for the other half of
     * the facet: a pure module whose oracle is a golden.
     */
    services?: Services;
};

/**
 * The record returned by {@link startIntegration | specification.integration}.
 * Destructure with the canonical names (CONVENTIONS A3):
 *
 *     const { integration, cleanup } = await specification.integration(…);
 */
export type IntegrationHandle<
    Services extends ServiceRecord = ServiceRecord,
    DatabaseKey extends string = string,
> = {
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    integration: IntegrationSpecification<Services, DatabaseKey>;
};

// ── Constructor ──

/**
 * Specify a module the way the assembled product is specified: against real
 * services and declared contracts, with the golden mechanism on what it
 * produces.
 *
 * The fork is the SUBJECT. A module alone is a module test, beside its code,
 * with no runner at all. A module that needs a real database, or whose oracle
 * is a golden file, is this one — which is what spares it the shape it would
 * otherwise take: plain vitest under a `specs/` folder, a hand-built sqlite
 * template, a `beforeAll` starting a container, and a `toMatchSnapshot` beside
 * a framework that owns a golden engine.
 */
export async function startIntegration<Services extends ServiceRecord>(
    options: IntegrationSpecificationOptions<Services> = {},
): Promise<IntegrationHandle<Services, DatabaseKeys<Services>>> {
    // Caller detection must run before any await — async resumption drops
    // The calling file's frames from the stack.
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the empty record stands for an absent one, and every facet states the default the same way
    const services = (options.services ?? {}) as Services;
    const databaseKeys = declaredDatabaseKeys(services);

    let started: null | StartedServices = null;
    if (Object.keys(services).length > 0) {
        started = await startServices(services, root);
    }

    const config: SpecificationConfig = {
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
        integration: createIntegrationFacet<Services, DatabaseKeys<Services>>(config),
    };
}
