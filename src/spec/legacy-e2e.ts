import { Orchestrator } from '../infra/orchestrator.js';
import { createSpecificationRunner } from '../spec/builder.js';
import { FetchAdapter } from '../spec/http/adapters/fetch.adapter.js';
import type { SpecificationRunnerWithCleanup } from './legacy-integration.js';
import { resolveProjectRoot } from './resolve.js';

export interface E2eOptions {
    /** Project root — must contain docker/compose.test.yaml. */
    root?: string;
}

/**
 * Create an E2E specification runner.
 * Starts full docker compose stack. App URL and database auto-detected.
 */
export async function e2e(options: E2eOptions = {}): Promise<SpecificationRunnerWithCleanup> {
    const orchestrator = new Orchestrator({
        mode: 'e2e',
        root: resolveProjectRoot(options.root),
        services: [],
    });

    await orchestrator.startCompose();

    const appUrl = orchestrator.getAppUrl();
    if (!appUrl) {
        throw new Error(
            'E2E: could not detect app URL from compose. Ensure an app service with ports is defined.',
        );
    }

    const database = orchestrator.getDatabase() ?? undefined;
    const databases = orchestrator.getDatabases();

    const runner = createSpecificationRunner({
        database,
        databases: databases.size > 0 ? databases : undefined,
        server: new FetchAdapter(appUrl),
    }) as SpecificationRunnerWithCleanup;

    runner.cleanup = () => orchestrator.stopCompose();
    runner.orchestrator = orchestrator;

    return runner;
}
