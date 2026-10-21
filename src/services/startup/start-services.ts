import { randomUUID } from 'node:crypto';

import type { DatabasePort } from '../database.port.js';
import { ProcessHandle } from '../process/process.adapter.js';
import type { ServiceRecord } from '../services.js';
import { Orchestrator } from './orchestrator.js';
import type { AppInfo } from './startup-report.js';

function getWorkerId(): string {
    return process.env.VITEST_POOL_ID ?? '0';
}

// invariant: only what was acquired is released: a release reads the namespace its acquire made.
async function acquireIsolation(
    services: ServiceRecord,
    acquired: ServiceRecord[string][],
): Promise<void> {
    const workerId = getWorkerId();
    for (const service of Object.values(services)) {
        await service.isolation().acquire(workerId);
        acquired.push(service);
    }
}

export type StartedServices = {
    database?: DatabasePort | undefined;
    databases?: Map<string, DatabasePort> | undefined;
    orchestrator: Orchestrator;
    runId: string;
    /** The one teardown of a started record: its processes, then this worker's isolation, then the infrastructure. */
    stop: () => Promise<void>;
};

// invariant: the specification starts processes after the rest, so an `env` function reads connection strings that already exist.
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

/** Each carries the run's id, minted here, so a spec never samples `Date.now()` for a label (`no-sampled-value-in-expectation`). */
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
            // hazard: one process that never came up must not orphan the ones before it.
            await stop();
            throw error;
        }
    }
    return stop;
}

export async function startServices(
    services: ServiceRecord,
    root: string,
    subject?: AppInfo,
): Promise<StartedServices> {
    const { infrastructure } = splitProcesses(services);
    const orchestrator = new Orchestrator({
        root,
        services: infrastructure,
        subject,
    });
    await orchestrator.start();
    const acquired: ServiceRecord[string][] = [];
    const stopInfrastructure = async (): Promise<void> => {
        for (const service of acquired.splice(0)) {
            await service.isolation().release();
        }
        await orchestrator.stop();
    };
    const runId = randomUUID();
    let stopProcesses: () => Promise<void>;
    try {
        await acquireIsolation(infrastructure, acquired);
        stopProcesses = await startProcessServices(services, root, runId);
    } catch (error) {
        // hazard: a record that fails halfway must not leave this worker's namespaces nor its containers behind.
        await stopInfrastructure();
        throw error;
    }
    const databases = orchestrator.getDatabases();
    return {
        database: orchestrator.getDatabase() ?? undefined,
        databases: databases.size > 0 ? databases : undefined,
        orchestrator,
        runId,
        stop: async () => {
            await stopProcesses();
            await stopInfrastructure();
        },
    };
}
