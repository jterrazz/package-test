import type { ContainerAccessor } from '../../../integrations/docker/container-accessor.js';
import { registerMatchers } from '../../../vitest/matchers.js';
import {
    type CliSpecification,
    createCliFacet,
    type DockerSpecConfig,
    type SpecificationConfig,
} from '../shared/builder.js';
import { getCallerDir } from '../shared/caller.js';
import { createDockerReader } from '../shared/docker-reader.js';
import type { Orchestrator } from '../shared/orchestrator.js';
import { resolveCommand, resolveRoot } from '../shared/resolve.js';
import {
    type DatabaseKeys,
    declaredDatabaseKeys,
    releaseIsolation,
    type ServiceRecord,
    type StartedServices,
    startServices,
} from '../shared/services.js';
import { ExecAdapter } from './exec.adapter.js';

// ── Types ──

/** Options for {@link startCli | specification.cli}. */
export interface CliSpecificationOptions<Services extends ServiceRecord = ServiceRecord> {
    /**
     * Opt-in Docker awareness. When set, every spec generates a unique
     * test-run id, injects it into the child process env under `envVar`,
     * and exposes `.container(name)` accessors on the result that lazily
     * query Docker. Always declare results with `await using` so leaked
     * containers get force-removed at scope exit (CONVENTIONS B5).
     */
    docker?: DockerSpecConfig;
    /**
     * Project-root override (CONVENTIONS A9) — the single meaning of `root`:
     * it anchors compose detection and local-bin resolution for the tested
     * binary. It is NOT a fixtures root; `.fixture()` resolves feature-local
     * or `$FIXTURES/` paths on its own.
     */
    root?: string;
    /**
     * Named infrastructure record started via testcontainers. Connection
     * URLs are injected automatically into the child env: `<KEY>_URL` per
     * service, plus `DATABASE_URL` / `REDIS_URL` when unambiguous
     * (CONVENTIONS B6). `.env()` overrides.
     */
    services?: Services;
    /**
     * Escape hatch: normaliser applied to result.stdout / result.stderr
     * before every comparison, AFTER the default ANSI strip (CONVENTIONS
     * D6). Does NOT mutate the raw `.text` accessor. Prefer `{{token}}`
     * placeholders in fixtures.
     */
    transform?: (text: string) => string;
}

/**
 * The record returned by {@link startCli | specification.cli}. Destructure
 * with the canonical names (CONVENTIONS A3):
 *
 *     const { cli, cleanup, docker } = await specification.cli(…);
 */
export interface CliHandle<DatabaseKey extends string = string> {
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    cli: CliSpecification<DatabaseKey>;
    /**
     * Read a running container by id — returns a {@link ContainerAccessor}
     * usable with `await expect(...).toBeRunning()` and read accessors.
     */
    docker: (containerId: string) => ContainerAccessor;
    /** The orchestrator managing the test infrastructure lifecycle. */
    orchestrator: null | Orchestrator;
}

// ── Constructor ──

export async function startCli<Services extends ServiceRecord>(
    bin: string,
    options: CliSpecificationOptions<Services> = {},
): Promise<CliHandle<DatabaseKeys<Services>>> {
    // Caller detection must run before any await — async resumption drops
    // The calling file's frames from the stack.
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    const resolvedBin = resolveCommand(bin, root);
    const services = (options.services ?? {}) as Services;
    const databaseKeys = declaredDatabaseKeys(services);

    let started: null | StartedServices = null;
    if (Object.keys(services).length > 0) {
        started = await startServices(services, root);
    }

    const config: SpecificationConfig = {
        command: new ExecAdapter(resolvedBin),
        database: started?.database,
        databaseKeys,
        databases: started?.databases,
        dockerConfig: options.docker,
        services: Object.keys(services).length > 0 ? services : undefined,
        transform: options.transform,
    };

    return {
        cleanup: async () => {
            await releaseIsolation(services);
            if (started) {
                await started.orchestrator.stop();
            }
        },
        cli: createCliFacet(config) as CliSpecification<DatabaseKeys<Services>>,
        docker: createDockerReader(callerDir),
        orchestrator: started?.orchestrator ?? null,
    };
}
