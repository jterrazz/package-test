import { ExecAdapter } from '../adapters/exec.adapter.js';
import { FetchAdapter } from '../adapters/fetch.adapter.js';
import { HonoAdapter } from '../adapters/hono.adapter.js';
import {
    createSpecificationRunner,
    type SpecificationBuilder,
} from '../builder/specification-builder.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import type { DatabasePort } from '../ports/database.port.js';
import type { ServiceHandle } from '../ports/service.port.js';
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

// ── Internal dispatchers ──

async function startApp(target: AppTarget, options: SpecOptions): Promise<SpecRunner> {
    const orchestrator = new Orchestrator({
        mode: 'integration',
        root: resolveProjectRoot(options.root),
        services: options.services ?? [],
    });

    await orchestrator.start();

    const honoApp = target.factory();
    const database = orchestrator.getDatabase() ?? undefined;
    const databases = orchestrator.getDatabases();

    const runner = createSpecificationRunner({
        database,
        databases: databases.size > 0 ? databases : undefined,
        server: new HonoAdapter(honoApp),
    }) as SpecRunner;

    runner.cleanup = () => orchestrator.stop();
    runner.orchestrator = orchestrator;

    return runner;
}

async function startStack(target: StackTarget, options: SpecOptions): Promise<SpecRunner> {
    const root = resolveProjectRoot(target.root ?? options.root);
    const orchestrator = new Orchestrator({
        mode: 'e2e',
        root,
        services: options.services ?? [],
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
    runner.orchestrator = orchestrator;

    return runner;
}

async function startCommand(target: CommandTarget, options: SpecOptions): Promise<SpecRunner> {
    const root = resolveProjectRoot(options.root);
    const bin = resolveCommand(target.bin, root);

    let orchestrator: null | Orchestrator = null;
    let database: DatabasePort | undefined;
    let databases: Map<string, DatabasePort> | undefined;

    if (options.services?.length) {
        orchestrator = new Orchestrator({
            mode: 'integration',
            root,
            services: options.services,
        });
        await orchestrator.start();
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
        if (orchestrator) {
            await orchestrator.stop();
        }
    };
    runner.orchestrator = orchestrator!;

    return runner;
}
