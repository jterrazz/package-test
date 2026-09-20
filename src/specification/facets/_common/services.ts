import { randomUUID } from 'node:crypto';

import type { DatabasePort } from '../../ports/database.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import { Orchestrator } from './orchestrator.js';
import { ProcessHandle } from './process.js';

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
    return Object.entries(services)
        .filter(([, service]) => service.createDatabaseAdapter() !== null)
        .map(([key]) => key);
}

export type StartedServices = {
    database?: DatabasePort | undefined;
    databases?: Map<string, DatabasePort> | undefined;
    orchestrator: Orchestrator;
    /** The id every process of this run carries — one per specification. */
    runId: string;
    /** Terminate every process this record declared. */
    stopProcesses: () => Promise<void>;
};

/**
 * A process is not a container: the orchestrator never sees one, and the
 * facet starts it AFTER the rest, so an `env` function reads connection
 * strings that are already there.
 */
function splitProcesses(services: ServiceRecord): {
    infrastructure: ServiceRecord;
    processes: [string, ProcessHandle][];
} {
    const infrastructure: ServiceRecord = {};
    const processes: [string, ProcessHandle][] = [];
    for (const [key, handle] of Object.entries(services)) {
        if (handle instanceof ProcessHandle) {
            processes.push([key, handle]);
        } else {
            infrastructure[key] = handle;
        }
    }
    return { infrastructure, processes };
}

/**
 * Start every declared process, in declaration order, once the infrastructure
 * is up — so `env: ({ db }) => …` reads a connection string that exists. Each
 * carries the run's id, minted here: a label a spec would otherwise sample
 * from `Date.now()` and put under an oracle (CONVENTIONS D16, P7).
 *
 * @internal
 */
export async function startProcessServices(
    services: ServiceRecord,
    root: string,
    runId: string,
): Promise<() => Promise<void>> {
    const { processes } = splitProcesses(services);
    const started: ProcessHandle[] = [];
    const stop = async (): Promise<void> => {
        for (const handle of started.toReversed()) {
            await handle.shutdown();
        }
        started.length = 0;
    };
    for (const [, handle] of processes) {
        try {
            await handle.spawnWith(root, services, runId);
            started.push(handle);
        } catch (error) {
            // One process that never came up must not orphan the ones before it.
            await stop();
            throw error;
        }
    }
    return stop;
}

/** Start a services record via testcontainers and acquire worker isolation. */
export async function startServices(
    services: ServiceRecord,
    root: string,
): Promise<StartedServices> {
    const { infrastructure } = splitProcesses(services);
    const orchestrator = new Orchestrator({
        root,
        services: infrastructure,
    });
    await orchestrator.start();
    await acquireIsolation(infrastructure);
    const runId = randomUUID();
    const stopProcesses = await startProcessServices(services, root, runId);
    const databases = orchestrator.getDatabases();
    return {
        database: orchestrator.getDatabase() ?? undefined,
        databases: databases.size > 0 ? databases : undefined,
        orchestrator,
        runId,
        stopProcesses,
    };
}
