import { HonoAdapter } from '../adapters/hono.adapter.js';
import {
    createSpecificationRunner,
    type SpecificationRunner,
} from '../builder/specification-builder.js';
import { Orchestrator } from '../orchestrator/orchestrator.js';
import type { ServiceHandle } from '../ports/service.port.js';
import { resolveProjectRoot } from './resolve.js';

type HonoApp = {
    fetch: (...args: any[]) => any;
    request: (path: string, init?: RequestInit) => Promise<Response> | Response;
};

export interface IntegrationOptions {
    /** Factory that returns a Hono app — called after services start. */
    app: () => HonoApp;
    /** Project root for compose detection (relative paths supported). */
    root?: string;
    /** Declared services — started via testcontainers. */
    services: ServiceHandle[];
}

/** A specification runner that also exposes teardown and the underlying orchestrator. */
export interface SpecificationRunnerWithCleanup extends SpecificationRunner {
    /** Stop all infrastructure containers started by this runner. */
    cleanup: () => Promise<void>;
    /** The orchestrator managing the test infrastructure lifecycle. */
    orchestrator: Orchestrator;
}

/**
 * Create an integration specification runner.
 * Starts infra containers via testcontainers, app runs in-process.
 */
export async function integration(
    options: IntegrationOptions,
): Promise<SpecificationRunnerWithCleanup> {
    const orchestrator = new Orchestrator({
        mode: 'integration',
        root: resolveProjectRoot(options.root),
        services: options.services,
    });

    await orchestrator.start();

    const app = options.app();
    const database = orchestrator.getDatabase() ?? undefined;
    const databases = orchestrator.getDatabases();

    const runner = createSpecificationRunner({
        database,
        databases: databases.size > 0 ? databases : undefined,
        server: new HonoAdapter(app),
    }) as SpecificationRunnerWithCleanup;

    runner.cleanup = () => orchestrator.stop();
    runner.orchestrator = orchestrator;

    return runner;
}
