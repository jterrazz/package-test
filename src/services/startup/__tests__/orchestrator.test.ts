import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { clock } from '../../../clock/clock.js';
import type { DatabasePort } from '../../database.port.js';
import { Orchestrator } from '../orchestrator.js';
import {
    failedStart,
    fakeContainers,
    fakeService,
    mixedServices,
    plain,
} from './orchestrator.fixtures.js';
import type { CallLog } from './orchestrator.fixtures.js';

const database = (name: string): DatabasePort => ({
    columns: async () => await Promise.resolve([name]),
    query: async () => await Promise.resolve([]),
    reset: async () => {
        await Promise.resolve();
    },
    seed: async () => {
        await Promise.resolve();
    },
});

const STARTED = [
    '',
    ' INFRA  Starting infrastructure...',
    '',
    '  ✓ postgres (analytics-db)  fake://host.test:15432  5ms',
    '  ✓ redis (cache)  fake://host.test:16379  5ms',
    '',
].join('\n');

describe('Orchestrator', () => {
    test('the orchestrator measures from the root it is given — requires a root — the caller resolved it, there is no second opinion', () => {
        // Given - a construction that omits the root
        // @ts-expect-error - `root` is required; this line is the guard
        const orchestrator = new Orchestrator({ services: {} });

        // Then - the type refuses it, and the guard fails the typecheck if the option ever becomes optional again
        expect(orchestrator).toBeInstanceOf(Orchestrator);
    });

    test('a start — every container started at once, then each connected in turn — health, then init — an embedded service initialized beside them, and the report printed once', async () => {
        // Given - two contained services, one with options of its own, and an embedded one
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        const log: CallLog = [];
        const requests = fakeContainers(log);
        const root = mkdtempSync(resolve(tmpdir(), 'orchestrator-root-'));
        const printed = vi.spyOn(console, 'log').mockReturnValue();
        const services = mixedServices(log);
        const orchestrator = new Orchestrator({ root, services, subject: { type: 'none' } });

        // When - it starts twice
        await orchestrator.start();
        await orchestrator.start();
        const lines = printed.mock.calls.map(([text]) => plain(text));
        printed.mockRestore();

        // Then - each container built from its service, each call in its order, each service named and connected, one report
        expect([
            requests,
            log,
            Object.values(services).map(({ connectionString, serviceName }) => [
                serviceName,
                connectionString,
            ]),
            lines,
        ]).toStrictEqual([
            [
                {
                    command: ['-c', 'fsync=off'],
                    env: { POSTGRES_DB: 'a' },
                    image: 'postgres:16',
                    port: 5432,
                },
                { env: {}, image: 'redis:7', port: 6379 },
            ],
            [
                'start postgres:16',
                'start redis:7',
                'initialize sqlite /docker',
                'health postgres:16',
                'initialize postgres:16 /docker',
                'health redis:7',
                'initialize redis:7 /docker',
            ],
            [
                ['analytics-db', 'fake://host.test:15432'],
                ['cache', 'fake://host.test:16379'],
                ['files', ''],
            ],
            [STARTED],
        ]);
    });

    test('a stop — stops each container it started, not the embedded services, and a later start starts them afresh', async () => {
        // Given - an orchestrator over a contained and an embedded service, stopped before it ever started, then started
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        const log: CallLog = [];
        const requests = fakeContainers(log);
        const printed = vi.spyOn(console, 'log').mockReturnValue();
        const services = {
            cache: fakeService(log, 'redis:7'),
            files: fakeService(log, 'sqlite', { defaultPort: 0 }),
        };
        const orchestrator = new Orchestrator({ root: tmpdir(), services });
        await orchestrator.stop();
        await orchestrator.start();

        // When - it stops, then starts again, then stops twice
        await orchestrator.stop();
        await orchestrator.start();
        await orchestrator.stop();
        await orchestrator.stop();
        printed.mockRestore();

        // Then - the one container stopped once per start, and built again
        expect([
            requests.length,
            log.filter((line) => !line.startsWith('health') && !line.startsWith('initialize')),
        ]).toStrictEqual([2, ['start redis:7', 'stop redis:7', 'start redis:7', 'stop redis:7']]);
    });

    test('a failed start — the failing container reports its error and the logs it wrote since the start, and is stopped', async () => {
        // Given - a service whose health check fails
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        const failed = await failedStart('cache', 'redis:7', async () => {
            await Promise.reject(new Error('not ready'));
        });

        // Then - the error rethrown, the report whole, the logs read from before the start
        expect(failed).toStrictEqual({
            log: [
                'start redis:7',
                'health redis:7',
                'logs redis:7 since 2026-09-25T09:59:59.500Z',
                'stop redis:7',
            ],
            rejection: new Error('not ready'),
            report: [
                [
                    '',
                    ' INFRA  Starting infrastructure...',
                    '',
                    '  × redis (cache)  not ready  0ms',
                    '    redis:7 booted',
                    '',
                    '  → app: in-process (Hono)',
                    '',
                ].join('\n'),
            ],
        });
    });

    test('a failed start — a bare failure is reported as its text, and a container that refuses its logs or its stop hides nothing', async () => {
        // Given - a health check failing with a bare value, on a container refusing logs and stop
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        const failed = await failedStart(
            'queue',
            'nats:2',
            async () => {
                // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- a bare value is the failure under test
                await Promise.reject('refused');
            },
            {
                logs: async () => {
                    throw new Error('no logs');
                },
                stop: async () => {
                    await Promise.reject(new Error('no stop'));
                },
            },
        );

        // Then - the bare value rethrown, reported with no logs
        expect(failed).toStrictEqual({
            log: [
                'start nats:2',
                'health nats:2',
                'logs nats:2 since 2026-09-25T09:59:59.500Z',
                'stop nats:2',
            ],
            rejection: 'refused',
            report: [
                [
                    '',
                    ' INFRA  Starting infrastructure...',
                    '',
                    '  × nats (queue)  refused  0ms',
                    '',
                    '  → app: in-process (Hono)',
                    '',
                ].join('\n'),
            ],
        });
    });

    test('the databases — the default is the first declared service that is one, and every one is listed by its key', () => {
        // Given - a service that is no database between two that are
        const log: CallLog = [];
        const orchestrator = new Orchestrator({
            root: tmpdir(),
            services: {
                cache: fakeService(log, 'redis:7'),
                main: fakeService(log, 'postgres:16', { database: database('main') }),
                other: fakeService(log, 'mysql:8', { database: database('other') }),
            },
        });
        const none = new Orchestrator({
            root: tmpdir(),
            services: { cache: fakeService(log, 'redis:7') },
        });

        // Then - the first database, the keys of all, and none where none is declared
        expect([
            orchestrator.getDatabase() === orchestrator.getDatabases().get('main'),
            [...orchestrator.getDatabases().keys()],
            none.getDatabase(),
            none.getDatabases().size,
        ]).toStrictEqual([true, ['main', 'other'], null, 0]);
    });
});
