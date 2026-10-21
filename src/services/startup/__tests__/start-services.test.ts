import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { clock } from '../../../clock/clock.js';
import type { DatabasePort } from '../../database.port.js';
import { processService } from '../../process/process.adapter.js';
import { startProcessServices, startServices } from '../start-services.js';
import { fakeContainers, fakeService } from './orchestrator.fixtures.js';
import type { CallLog } from './orchestrator.fixtures.js';

const SERVER = `node -e "const s=require('node:http').createServer((q,r)=>r.end('ok'));s.listen(0,'127.0.0.1',()=>console.log('listening on port '+s.address().port))"`;
const READY = /listening on port (?<port>\d+)/u;

const scratchRoot = (): string => mkdtempSync(join(tmpdir(), 'services-'));

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

describe('startServices', () => {
    test('startServices — starts the infrastructure, then acquires each service for this worker, then the processes, answers the databases declared, and stops in reverse', async () => {
        // Given - two databases, a cache and a server process, on fake containers
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        const log: CallLog = [];
        fakeContainers(log);
        const [orders, users] = [database('orders'), database('users')];
        const api = processService({ command: SERVER, ready: READY });
        const services = {
            api,
            cache: fakeService(log, 'redis:7'),
            orders: fakeService(log, 'postgres:16', { database: orders }),
            users: fakeService(log, 'postgres:17', { database: users }),
        };
        const printed = vi.spyOn(console, 'log').mockReturnValue();

        // When - the record starts, then stops
        const started = await startServices(services, scratchRoot());
        printed.mockRestore();
        const served = api.started;
        await started.stop();

        // Then - this worker's acquires after the starts, the releases before the containers stop, the first database and every one by key, and the process up then down
        const worker = process.env.VITEST_POOL_ID;
        expect([
            log.filter((line) => /^(?:start|acquire|release|stop) /u.test(line)),
            started.database,
            started.databases,
            [served, api.started],
        ]).toStrictEqual([
            [
                'start redis:7',
                'start postgres:16',
                'start postgres:17',
                `acquire redis:7 ${worker}`,
                `acquire postgres:16 ${worker}`,
                `acquire postgres:17 ${worker}`,
                'release redis:7',
                'release postgres:16',
                'release postgres:17',
                'stop redis:7',
                'stop postgres:16',
                'stop postgres:17',
            ],
            orders,
            new Map([
                ['orders', orders],
                ['users', users],
            ]),
            [true, false],
        ]);
    });

    test('startServices — a process that never comes up releases what was acquired and stops the infrastructure', async () => {
        // Given - a cache, and a server process whose build step fails
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        const log: CallLog = [];
        fakeContainers(log);
        const services = {
            broken: processService({
                before: `node -e "console.error('the build failed'); process.exit(1)"`,
                command: SERVER,
                ready: READY,
            }),
            cache: fakeService(log, 'redis:7'),
        };
        const printed = vi.spyOn(console, 'log').mockReturnValue();

        // When - the record starts
        const starting = startServices(services, scratchRoot());

        // Then - the start is refused, after the cache was acquired, released and its container stopped
        await expect(starting).rejects.toThrow('the build failed');
        printed.mockRestore();
        expect(log.filter((line) => /^(?:acquire|release|stop) /u.test(line))).toStrictEqual([
            `acquire redis:7 ${process.env.VITEST_POOL_ID}`,
            'release redis:7',
            'stop redis:7',
        ]);
    });

    test('startServices — a record with no database answers none, rather than an empty map', async () => {
        // Given - a cache alone
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        fakeContainers([]);
        const printed = vi.spyOn(console, 'log').mockReturnValue();

        // When - it starts
        const started = await startServices({ cache: fakeService([], 'redis:7') }, scratchRoot());
        printed.mockRestore();

        // Then - no database, and no map of them
        expect([started.database, started.databases]).toStrictEqual([undefined, undefined]);
    });

    test('startProcessServices — stops the processes already started when a later one never comes up', async () => {
        // Given - a record whose second process fails its build step
        const first = processService({ command: SERVER, ready: READY });
        const broken = processService({
            before: `node -e "console.error('the build failed'); process.exit(1)"`,
            command: SERVER,
            ready: READY,
        });
        const services = { api: first, broken };

        // When - the record is started
        const starting = startProcessServices(services, process.cwd(), 'run-1');

        // Then - the start is refused, and the first server, which did come up, no longer answers
        await expect(starting).rejects.toThrow('the build failed');
        expect(first.connectionString).toMatch(/^http:/u);
        expect(first.started).toBe(false);
        await expect(fetch(first.connectionString)).rejects.toThrow('fetch failed');
    });
});
