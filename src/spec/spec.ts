import type { DatabasePort } from '../adapters/ports/database.port.js';
import { ExecAdapter } from '../builder/cli/adapters/exec.adapter.js';
import { FetchAdapter } from '../builder/http/adapters/fetch.adapter.js';
import { HonoAdapter } from '../builder/http/adapters/hono.adapter.js';
import {
    createSpecificationRunner,
    type SpecificationBuilder,
} from '../builder/specification-builder.js';
import { dockerContainer } from '../docker/docker-adapter.js';
import { DockerAssertion } from '../docker/docker-assertion.js';
import { Orchestrator } from '../infra/orchestrator.js';
import type { ServiceHandle } from '../infra/ports/service.port.js';
import { resolveCommand, resolveProjectRoot } from './resolve.js';
import type { AppTarget, CommandTarget, SpecTarget, StackTarget } from './targets.js';

/** Shared options for all spec targets. */
export interface SpecOptions {
    /** Project root for fixture lookup and compose detection (relative paths supported). */
    root?: string;
    /** Infrastructure services to start via testcontainers. */
    services?: ServiceHandle[];
}

/** A specification runner with teardown support and orchestrator access. */
export interface SpecRunner {
    /** The function to create individual specs: `runner('label').get('/path').run()`. */
    (label: string): SpecificationBuilder;
    /** Stop all infrastructure started by this runner. */
    cleanup: () => Promise<void>;
    /**
     * Get a Docker assertion builder for a running container.
     *
     * @example
     *   await runner.docker('my-container').toBeRunning();
     */
    docker: (containerId: string) => DockerAssertion;
    /** The orchestrator managing the test infrastructure lifecycle. */
    orchestrator: Orchestrator;
}

/**
 * Create a specification runner for the given target.
 *
 * @param target - What to test against: {@link app}, {@link stack}, or {@link command}.
 * @param options - Shared options: root directory, infrastructure services.
 *
 * @example
 *   // HTTP — in-process app with testcontainers
 *   const s = await spec(app(() => createApp(db)), { services: [db] });
 *
 *   // HTTP — full docker compose stack
 *   const s = await spec(stack('../../'));
 *
 *   // CLI — command binary
 *   const s = await spec(command('my-cli'), { root: '../fixtures' });
 */
export async function spec(target: SpecTarget, options: SpecOptions = {}): Promise<SpecRunner> {
    switch (target.kind) {
        case 'app': {
            return startApp(target, options);
        }
        case 'stack': {
            return startStack(target, options);
        }
        case 'command': {
            return startCommand(target, options);
        }
    }
}

// ── Isolation helpers ──

function getWorkerId(): string {
    return process.env.VITEST_POOL_ID ?? '0';
}

async function acquireIsolation(services: ServiceHandle[]): Promise<void> {
    const workerId = getWorkerId();
    for (const service of services) {
        await service.isolation().acquire(workerId);
    }
}

async function releaseIsolation(services: ServiceHandle[]): Promise<void> {
    for (const service of services) {
        await service.isolation().release();
    }
}

// ── Internal dispatchers ──

async function startApp(target: AppTarget, options: SpecOptions): Promise<SpecRunner> {
    const services = options.services ?? [];
    const orchestrator = new Orchestrator({
        mode: 'integration',
        root: resolveProjectRoot(options.root),
        services,
    });

    await orchestrator.start();
    await acquireIsolation(services);

    // Build services map keyed by composeName or type
    const servicesMap: Record<string, ServiceHandle> = {};
    for (const svc of services) {
        const key = svc.composeName ?? svc.type;
        servicesMap[key] = svc;
    }

    const honoApp = target.factory(servicesMap);
    const database = orchestrator.getDatabase() ?? undefined;
    const databases = orchestrator.getDatabases();

    const runner = createSpecificationRunner({
        database,
        databases: databases.size > 0 ? databases : undefined,
        server: new HonoAdapter(honoApp),
    }) as SpecRunner;

    runner.cleanup = async () => {
        await releaseIsolation(services);
        await orchestrator.stop();
    };
    runner.docker = (id: string) => new DockerAssertion(dockerContainer(id));
    runner.orchestrator = orchestrator;

    return runner;
}

async function startStack(target: StackTarget, options: SpecOptions): Promise<SpecRunner> {
    const root = resolveProjectRoot(target.root ?? options.root);
    const workerId = getWorkerId();
    const projectName = `test-worker-${workerId}`;

    const orchestrator = new Orchestrator({
        mode: 'e2e',
        root,
        services: options.services ?? [],
        projectName,
    });

    await orchestrator.startCompose();

    const appUrl = orchestrator.getAppUrl();
    if (!appUrl) {
        throw new Error(
            'stack(): could not detect app URL from compose. Ensure an app service with ports is defined.',
        );
    }

    const database = orchestrator.getDatabase() ?? undefined;
    const databases = orchestrator.getDatabases();

    const runner = createSpecificationRunner({
        database,
        databases: databases.size > 0 ? databases : undefined,
        server: new FetchAdapter(appUrl),
    }) as SpecRunner;

    runner.cleanup = () => orchestrator.stopCompose();
    runner.docker = (id: string) => new DockerAssertion(dockerContainer(id));
    runner.orchestrator = orchestrator;

    return runner;
}

async function startCommand(target: CommandTarget, options: SpecOptions): Promise<SpecRunner> {
    const root = resolveProjectRoot(options.root);
    const bin = resolveCommand(target.bin, root);
    const services = options.services ?? [];

    let orchestrator: null | Orchestrator = null;
    let database: DatabasePort | undefined;
    let databases: Map<string, DatabasePort> | undefined;

    if (services.length) {
        orchestrator = new Orchestrator({
            mode: 'integration',
            root,
            services,
        });
        await orchestrator.start();
        await acquireIsolation(services);
        database = orchestrator.getDatabase() ?? undefined;
        const dbMap = orchestrator.getDatabases();
        databases = dbMap.size > 0 ? dbMap : undefined;
    }

    const runner = createSpecificationRunner({
        command: new ExecAdapter(bin),
        database,
        databases,
        fixturesRoot: root,
    }) as SpecRunner;

    runner.cleanup = async () => {
        await releaseIsolation(services);
        if (orchestrator) {
            await orchestrator.stop();
        }
    };
    runner.docker = (id: string) => new DockerAssertion(dockerContainer(id));
    runner.orchestrator = orchestrator!;

    return runner;
}
