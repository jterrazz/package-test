import type { DockerSpecConfig, SpecificationConfig } from '../../core/chain/builder.js';
import { getCallerDir } from '../../core/chain/caller.js';
import { createDockerReader } from '../../core/chain/docker-reader.js';
import type { Orchestrator } from '../../core/chain/orchestrator.js';
import { resolveCommand, resolveRoot } from '../../core/chain/resolve.js';
import {
    declaredDatabaseKeys,
    releaseIsolation,
    startServices,
} from '../../core/chain/services.js';
import type { DatabaseKeys, ServiceRecord, StartedServices } from '../../core/chain/services.js';
import { registerMatchers } from '../../core/goldens/matchers.js';
import type { CliEnv } from '../../core/ports/cli.port.js';
import type { ContainerAccessor } from '../../seams/docker/container-accessor.js';
import { createCliFacet } from './cli.chain.js';
import type { CliSpecification } from './cli.chain.js';
import { ExecAdapter } from './exec.adapter.js';
import type { LiterateServeRegistration } from './literate.js';

// ── Types ──

/** Options for {@link startCli | specification.cli}. */
export type CliSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /**
     * Opt-in Docker awareness. When set, every spec generates a unique
     * test-run id, injects it into the child process env under `envVar`,
     * and exposes `.container(name)` accessors on the result that lazily
     * query Docker. Always declare results with `await using` so leaked
     * containers get force-removed at scope exit (CONVENTIONS B5).
     */
    docker?: DockerSpecConfig;
    /**
     * Environment applied to EVERY run of this binary — the variables the
     * product needs to be deterministic at all (`TZ`, `NO_COLOR`, `LANG`,
     * a config home under the spec's own workdir). Stated once per app
     * instead of repeated on every chain and in every document; a chained
     * `.env()` and a document's `env:` both win over it.
     */
    defaults?: CliEnv;
    /**
     * Named environment SETS for `<case>.spec.yaml` documents. An `env:` entry
     * `frozen` applies the whole `frozen` record; `$WORKDIR` expands and `null`
     * unsets, exactly as in `.env()`. Declared once per app so a document
     * states WHICH ground it stands on, not how to build it.
     */
    env?: Record<string, CliEnv>;
    /**
     * Named servers a `<case>.spec.yaml` document may start (`serve: [mcp]`, or
     * `- mcp: { KEY: value }` to add env to that one). Each entry names the
     * shell `command`, the `ready` regex whose capture group holds the port the
     * server announces, the `url(port)` builder, and the `env` variable that
     * URL is bound to in every run's child.
     */
    serve?: Record<string, LiterateServeRegistration>;
    /**
     * Project-root override (CONVENTIONS A9) — the single meaning of `root`:
     * it anchors the local-bin resolution of the tested binary, in place of
     * the walk to the nearest `package.json`. It is NOT a fixtures root;
     * `.fixture()` resolves feature-local or `$FIXTURES/` paths on its own.
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
    transform?: ((text: string) => string) | undefined;
};

/**
 * The record returned by {@link startCli | specification.cli}. Destructure
 * with the canonical names (CONVENTIONS A3):
 *
 *     const { cli, cleanup, docker } = await specification.cli(…);
 */
export type CliHandle<DatabaseKey extends string = string> = {
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
};

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
        defaultEnv: options.defaults,
        envSets: options.env,
        root,
        serveRegistry: options.serve,
        services: Object.keys(services).length > 0 ? services : undefined,
        transform: options.transform,
    };

    return {
        cleanup: async () => {
            await started?.stopProcesses();
            await releaseIsolation(services);
            if (started) {
                await started.orchestrator.stop();
            }
        },
        cli: createCliFacet(config),
        docker: createDockerReader(callerDir),
        orchestrator: started?.orchestrator ?? null,
    };
}
