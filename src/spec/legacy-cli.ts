import type { DatabasePort } from '../adapters/ports/database.port.js';
import { ExecAdapter } from '../builder/cli/adapters/exec.adapter.js';
import { createSpecificationRunner } from '../builder/specification-builder.js';
import { Orchestrator } from '../infra/orchestrator.js';
import type { ServiceHandle } from '../infra/ports/service.port.js';
import type { SpecificationRunnerWithCleanup } from './legacy-integration.js';
import { resolveCommand, resolveProjectRoot } from './resolve.js';

export interface CliOptions {
    /** CLI command to run (resolved from node_modules/.bin or PATH). */
    command: string;
    /** Project root — base dir for .project() fixture lookup (relative paths supported). */
    root?: string;
    /** Optional infrastructure services (started via testcontainers). */
    services?: ServiceHandle[];
}

/**
 * Create a CLI specification runner.
 * Runs CLI commands against fixture projects. Optionally starts infrastructure.
 */
export async function cli(options: CliOptions): Promise<SpecificationRunnerWithCleanup> {
    const root = resolveProjectRoot(options.root);
    const command = resolveCommand(options.command, root);

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
        command: new ExecAdapter(command),
        database,
        databases,
        fixturesRoot: root,
    }) as SpecificationRunnerWithCleanup;

    runner.cleanup = async () => {
        if (orchestrator) {
            await orchestrator.stop();
        }
    };
    runner.orchestrator = orchestrator!;

    return runner;
}
