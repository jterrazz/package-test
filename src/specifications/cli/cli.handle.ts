import { resolveRoot } from '../../../lint/kit/project/resolve.js';
import type { Started } from '../../chain/config.js';
import { getCallerDir } from '../../chain/paths/caller.js';
import type { DockerSpecConfig } from '../../expectations/command/cli.result.js';
import { createDockerReader } from '../../expectations/command/cli.result.js';
import type { ContainerAccessor } from '../../expectations/command/container.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { ResultConfig } from '../../expectations/result.js';
import { requireDockerDaemon } from '../../services/containers/docker-cli.js';
import { declaredDatabaseKeys, declaredServices } from '../../services/services.js';
import type { DatabaseKeys, ServiceRecord, ServicesConfig } from '../../services/services.js';
import type { Orchestrator } from '../../services/startup/orchestrator.js';
import { startServices } from '../../services/startup/start-services.js';
import type { StartedServices } from '../../services/startup/start-services.js';
import { StubBackend } from '../../stubs/delivery/other-process/stub-backend.js';
import type { CliSpecification } from './cli.composition.js';
import { cliDefinition } from './cli.composition.js';
import type { CliEnv, CliPort } from './process/cli.port.js';
import { resolveCommand } from './process/command.js';
import { ExecAdapter } from './process/exec.adapter.js';

/** A server a document may start by name (`serve: mcp`). */
export type LiterateServeRegistration = {
    /** Shell command that starts the server, run from the project root. */
    command: string;
    /** The variable the resolved URL is bound to in every run's child env. */
    env: string;
    /** The first capture group is the announced port, named or not. */
    ready: RegExp;
    /** Builds the URL bound to `env` from the announced port. */
    url: (port: number) => string;
};

/** The stub backend: started before the first run, its URL handed to the binary under `env`. */
export type CliBackendOptions = {
    /** Env var receiving the stub's URL in the child (e.g. `'INGEST_URL'`). */
    env: string;
    /** Fixed port; pins a stable stub URL across runs. Default: a free OS-assigned port. */
    port?: number;
};

export type CliConfig = Pick<ResultConfig, 'transform'> &
    ServicesConfig & {
        /** The stub backend `.intercept()` declares its stubs on. */
        backend?: StubBackend | undefined;
        command?: CliPort | undefined;
        /** Under a chain's own `.env()` and a document's `env:`, both of which win. */
        defaultEnv?: CliEnv | undefined;
        dockerConfig?: DockerSpecConfig | undefined;
        /** Stable for the runner's lifetime, so a spawn in one run and an inspect in the next share one container scope. */
        dockerTestRunId?: string | undefined;
        envSets?: Record<string, CliEnv> | undefined;
        serveRegistry?: Record<string, LiterateServeRegistration> | undefined;
    };

export type CliSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /** Stub backend, started before the first run; its URL injected under `backend.env`, so a binary that sends its requests to a configurable origin can be served stubs. */
    backend?: CliBackendOptions;
    /** The words the binary's commands are spelled with, read by the checker only (`one-subject-per-spec`, `spec-in-subject-folder`): `exec('db migrate --dry')` is `db migrate`. */
    commands?: readonly string[];
    /** Opt-in Docker awareness; declare results with `await using` so leaked containers are removed (`docker-exec-bound-with-await-using`). */
    docker?: DockerSpecConfig;
    /** Environment applied to every run (`TZ`, `NO_COLOR`, ...); a chain's `.env()` and a document's `env:` win. */
    defaults?: CliEnv;
    /** Named environment sets a document names by bare word (`env: frozen`). */
    env?: Record<string, CliEnv>;
    /** Named servers a document may start (`serve: [mcp]`). */
    serve?: Record<string, LiterateServeRegistration>;
    /** Project-root override (`no-redundant-root`), anchoring the local-bin resolution of the binary; not a fixtures root. */
    root?: string;
    /** Services started via testcontainers; `<KEY>_URL` is injected, plus `DATABASE_URL` / `REDIS_URL` when unambiguous (`service-urls-injected`). */
    services?: Services;
    /** Normaliser applied to stdout/stderr after the ANSI strip; prefer `{{token}}` placeholders. */
    transform?: ((text: string) => string) | undefined;
};

/** What `specification.cli()` returns: `const { cli, cleanup, docker } = ...` (`no-runner-alias`). */
export type CliHandle<DatabaseKey extends string = string> = {
    /** Stop all infrastructure started by this specification. */
    cleanup: () => Promise<void>;
    cli: CliSpecification<DatabaseKey>;
    /** Read a running container by id. */
    docker: (containerId: string) => ContainerAccessor;
    /** The orchestrator managing the test infrastructure lifecycle. */
    orchestrator: null | Orchestrator;
};

// invariant: one per runner, never per spec: a world spawned in one chain is its own in the next.
function dockerTestRunId(): string {
    return `t-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

type StartedBackend = { backend: null | StubBackend; defaults: CliEnv | undefined };

// invariant: a backend that cannot start must not orphan the services started before it; its URL joins the defaults under the env var named, under the defaults the spec states itself.
async function startedBackend(
    declared: CliBackendOptions | undefined,
    defaults: CliEnv | undefined,
    started: null | StartedServices,
): Promise<StartedBackend> {
    if (declared === undefined) {
        return { backend: null, defaults };
    }
    const backend = new StubBackend({ port: declared.port });
    try {
        return { backend, defaults: { [declared.env]: await backend.start(), ...defaults } };
    } catch (error) {
        await started?.stop();
        throw error;
    }
}

export async function startCli<Services extends ServiceRecord>(
    bin: string,
    options: CliSpecificationOptions<Services> = {},
): Promise<CliHandle<DatabaseKeys<Services>>> {
    const callerDir = getCallerDir();
    await registerMatchers();
    const root = resolveRoot(options.root, callerDir);
    const resolvedBin = resolveCommand(bin, root);
    const services = declaredServices(options.services);
    const databaseKeys = declaredDatabaseKeys(services);

    // Stryker disable next-line ConditionalExpression,EqualityOperator: the daemon is asked for only where a Docker option stands, which a run on a machine with one cannot tell from a run with none; specs/cli/docker proves it where one runs
    if (options.docker !== undefined) {
        requireDockerDaemon();
    }
    let started: null | StartedServices = null;
    if (Object.keys(services).length > 0) {
        started = await startServices(services, root, { type: 'none' });
    }
    const { backend, defaults } = await startedBackend(options.backend, options.defaults, started);
    // Stryker disable next-line ConditionalExpression: a run id is read only beside a Docker option
    const dockerTestRunIdOf = options.docker === undefined ? undefined : dockerTestRunId();
    // Stryker disable next-line ConditionalExpression,EqualityOperator: a services record with no entry reads as no services to everything that takes it
    const declaredServicesOf = Object.keys(services).length > 0 ? services : undefined;

    const config: Started<CliConfig, 'command'> = {
        backend: backend ?? undefined,
        command: new ExecAdapter(resolvedBin),
        database: started?.database,
        databaseKeys,
        databases: started?.databases,
        dockerConfig: options.docker,
        dockerTestRunId: dockerTestRunIdOf,
        defaultEnv: defaults,
        envSets: options.env,
        root,
        serveRegistry: options.serve,
        services: declaredServicesOf,
        transform: options.transform,
    };

    return {
        cleanup: async () => {
            await started?.stop();
            await backend?.stop();
        },
        cli: cliDefinition.open(config),
        docker: createDockerReader(callerDir),
        // Stryker disable next-line LogicalOperator: an orchestrator exists only beside services, which are containers
        orchestrator: started?.orchestrator ?? null,
    };
}
