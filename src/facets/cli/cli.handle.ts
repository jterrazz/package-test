import type { DockerSpecConfig } from '../../expectations/command/cli.result.js';
import { createDockerReader } from '../../expectations/command/container.js';
import type { ContainerAccessor } from '../../expectations/command/container.js';
import { registerMatchers } from '../../expectations/goldens/matchers.js';
import type { ResultConfig } from '../../expectations/result.js';
import type { Started } from '../../kernel/chain/config.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { resolveCommand, resolveRoot } from '../../kernel/files/resolve.js';
import type { DatabaseKeys, ServiceRecord, ServicesConfig } from '../../world/services/services.js';
import type { Orchestrator } from '../../world/services/startup/orchestrator.js';
import {
    declaredDatabaseKeys,
    releaseIsolation,
    startServices,
} from '../../world/services/startup/start-services.js';
import type { StartedServices } from '../../world/services/startup/start-services.js';
import type { CliSpecification } from './cli.facet.js';
import { cliFacet } from './cli.facet.js';
import type { CliEnv, CliPort } from './process/cli.port.js';
import { ExecAdapter } from './process/exec.adapter.js';

// ── Types ──

/**
 * A server a document may start by name (`serve: mcp`), registered once per app
 * in the `serve` option of `specification.cli()`.
 */
export type LiterateServeRegistration = {
    /** Shell command that starts the server, run from the project root. */
    command: string;
    /** The variable the resolved URL is bound to in every run's child env. */
    env: string;
    /**
     * Matched against the server's output; the FIRST capture group is the port
     * it chose — named (`(?<port>\d+)`) or not, it is group 1 either way.
     */
    ready: RegExp;
    /** Builds the URL bound to `env` from the announced port. */
    url: (port: number) => string;
};

/** What `specification.cli()` hands its chain. */
export type CliConfig = {
    command?: CliPort | undefined;
    /**
     * Environment applied to every run of the declared binary
     * (`specification.cli({ defaults })`) — under a chain's own `.env()` and
     * under a document's `env:`, both of which win.
     */
    defaultEnv?: CliEnv | undefined;
    dockerConfig?: DockerSpecConfig | undefined;
    /**
     * Unique id shared by every spec from this runner instance.
     * Stable for the runner's lifetime so multi-step tests (spawn in
     * one run, inspect in another) see the same container scope. The
     * facet factories auto-populate this when `dockerConfig` is present.
     */
    dockerTestRunId?: string | undefined;
    /**
     * Named environment SETS a spec document may name by bare word
     * (`env: frozen`). Declared once per app in `specification.cli()`.
     */
    envSets?: Record<string, CliEnv> | undefined;
    /**
     * Named servers a spec document may start (`serve: [mcp]`). Declared once
     * per app in `specification.cli()`.
     */
    serveRegistry?: Record<string, LiterateServeRegistration> | undefined;
} & Pick<ResultConfig, 'transform'> &
    ServicesConfig;

/** Options for {@link startCli | specification.cli}. */
export type CliSpecificationOptions<Services extends ServiceRecord = ServiceRecord> = {
    /**
     * The words the binary's commands are spelled with (`['db', 'migrate']`),
     * read by the conventions checker alone, never by the run: a spec's
     * subject is the leading words of its command line this list holds —
     * `exec('db migrate --dry')` is `db migrate`, filed under `cli/db/migrate/`
     * (C29, C30). Without it the first word alone is the subject, so a
     * positional argument is never read as a subcommand.
     */
    commands?: readonly string[];
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
     * D6), and read by `.text`; `.raw` keeps the capture. Prefer `{{token}}`
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

/**
 * The id every container a run of this runner starts is labelled with. One
 * per runner, never per spec: a test that spawns a world in one chain and
 * inspects or destroys it in the next sees its own containers, not a ghost;
 * each test file loads its own runner, so two files never share one.
 */
function dockerTestRunId(): string {
    return `t-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

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
        started = await startServices(services, root, { type: 'none' });
    }

    const config: Started<CliConfig, 'command'> = {
        command: new ExecAdapter(resolvedBin),
        database: started?.database,
        databaseKeys,
        databases: started?.databases,
        dockerConfig: options.docker,
        dockerTestRunId: options.docker === undefined ? undefined : dockerTestRunId(),
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
        cli: cliFacet.open(config),
        docker: createDockerReader(callerDir),
        orchestrator: started?.orchestrator ?? null,
    };
}
