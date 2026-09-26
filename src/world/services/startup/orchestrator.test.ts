import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, describe, expect, test, vi } from 'vitest';

import { clock } from '../../clock/clock.js';
import type { ContainerPort } from '../containers/container.port.js';
import type { ServiceHandle } from '../service.port.js';
import { Orchestrator } from './orchestrator.js';
import { registerContainerIntegrations } from './registry.js';

const elsewhere = mkdtempSync(resolve(tmpdir(), 'orchestrator-root-'));

function slowContainer(asked: (Date | undefined)[]): ContainerPort {
    return {
        getConnectionString: () => '127.0.0.1:1',
        getHost: () => '127.0.0.1',
        getLogs: async (since?: Date) => {
            asked.push(since);
            return await Promise.resolve('boot line');
        },
        getMappedPort: () => 1,
        start: async () => {
            await clock.advance(10_000);
        },
        stop: async () => {
            await Promise.resolve();
        },
    };
}

async function settled(): Promise<void> {
    await Promise.resolve();
}

function unhealthyService(): ServiceHandle {
    return {
        buildConnectionString: () => 'fake://127.0.0.1:1',
        connectionString: '',
        createDatabaseAdapter: () => null,
        defaultImage: 'fake:1',
        defaultPort: 1,
        environment: {},
        healthcheck: async () => {
            await Promise.reject(new Error('not ready'));
        },
        initialize: settled,
        isolation: () => ({ acquire: settled, release: settled, reset: settled }),
        reset: settled,
        serviceName: null,
        started: false,
        type: 'fake',
    };
}

describe('Orchestrator', () => {
    afterAll(() => {
        rmSync(elsewhere, { force: true, recursive: true });
    });

    test('the orchestrator measures from the root it is given — requires a root — the caller resolved it, there is no second opinion', () => {
        // Given - a construction that omits the root (the shape where a fallback to `process.cwd()` would silently disagree with the runner's own `no-redundant-root` walk from the calling specification file)
        // @ts-expect-error - `root` is required; this line is the guard
        const orchestrator = new Orchestrator({ services: {} });

        // Then - the type refuses it, and the guard fails the typecheck if the option ever becomes optional again
        expect(orchestrator).toBeInstanceOf(Orchestrator);
    });

    test('the orchestrator measures from the root it is given — starts nothing when a record declares nothing', async () => {
        // Given - a stack with an empty services record
        const orchestrator = new Orchestrator({ root: elsewhere, services: {} });
        await orchestrator.start();

        try {
            // Then - there is no default database to hand back
            expect(orchestrator.getDatabase()).toBeNull();
            expect(orchestrator.getDatabases().size).toBe(0);
        } finally {
            await orchestrator.stop();
        }
    });

    test('a failed start reports the logs its own container wrote — reads them from before the container started, so a fresh one keeps its boot lines', async () => {
        // Given - a container whose start takes ten seconds, then a healthcheck that fails
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        const asked: (Date | undefined)[] = [];
        const container = slowContainer(asked);
        registerContainerIntegrations({ createContainer: () => container });
        const report = vi.spyOn(console, 'error').mockReturnValue();
        const orchestrator = new Orchestrator({
            root: tmpdir(),
            services: { cache: unhealthyService() },
        });

        // Then - the start fails, and the logs were asked for from before the start, less the clock margin
        await expect(orchestrator.start()).rejects.toThrow('not ready');
        report.mockRestore();
        expect(asked.map((since) => since?.toISOString())).toStrictEqual([
            '2026-09-25T09:59:59.500Z',
        ]);
    });
});
