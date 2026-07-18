import type { DatabasePort } from '../../ports/database.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import { Orchestrator } from './orchestrator.js';

// ── Shared types ──

/**
 * Infrastructure services declared as a named record. Keys become the typed
 * vocabulary of the whole spec: the server factory receives the same record,
 * and `.seed()` / `.table()` target databases by key.
 */
export type ServiceRecord = Record<string, ServiceHandle>;

/** Keys of a services record whose handles are databases. */
export type DatabaseKeys<Services extends ServiceRecord> = {
    [K in keyof Services]: Services[K] extends DatabasePort ? K & string : never;
}[keyof Services];

// ── Isolation helpers ──

export function getWorkerId(): string {
    return process.env.VITEST_POOL_ID ?? '0';
}

export async function acquireIsolation(services: ServiceRecord): Promise<void> {
    const workerId = getWorkerId();
    for (const service of Object.values(services)) {
        await service.isolation().acquire(workerId);
    }
}

export async function releaseIsolation(services: ServiceRecord): Promise<void> {
    for (const service of Object.values(services)) {
        await service.isolation().release();
    }
}

// ── Startup helpers ──

export function declaredDatabaseKeys(services: ServiceRecord): string[] {
    return Object.keys(services).filter((key) => services[key].createDatabaseAdapter() !== null);
}

export interface StartedServices {
    database?: DatabasePort;
    databases?: Map<string, DatabasePort>;
    orchestrator: Orchestrator;
}

/** Start a services record via testcontainers and acquire worker isolation. */
export async function startServices(
    services: ServiceRecord,
    root: string,
): Promise<StartedServices> {
    const orchestrator = new Orchestrator({ mode: 'integration', root, services });
    await orchestrator.start();
    await acquireIsolation(services);
    const databases = orchestrator.getDatabases();
    return {
        database: orchestrator.getDatabase() ?? undefined,
        databases: databases.size > 0 ? databases : undefined,
        orchestrator,
    };
}
