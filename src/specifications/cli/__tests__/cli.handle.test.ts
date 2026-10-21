import { once } from 'node:events';
import { createServer } from 'node:net';
import { describe, expect, test, vi } from 'vitest';

import { clock } from '../../../clock/clock.js';
import { findFreePort } from '../../../services/process/listening.js';
import {
    fakeContainers,
    fakeService,
} from '../../../services/startup/__tests__/orchestrator.fixtures.js';
import type { CallLog } from '../../../services/startup/__tests__/orchestrator.fixtures.js';
import { startCli } from '../cli.handle.js';

describe('cli.handle', () => {
    test('startCli — a declared backend listens on the port it pins, and is stopped by the cleanup', async () => {
        // Given - a free port, and a runner declaring a backend on it
        const port = await findFreePort();
        const { cleanup } = await startCli('echo', { backend: { env: 'API_URL', port } });

        // When - the port is asked, then the runner cleaned up
        const answered = await fetch(`http://127.0.0.1:${String(port)}/anything`);
        await cleanup();
        const after = await fetch(`http://127.0.0.1:${String(port)}/anything`).then(
            () => 'answered',
            () => 'refused',
        );

        // Then - the backend answered its unmatched request while it ran, and none after
        expect([answered.status, after]).toStrictEqual([501, 'refused']);
    });

    test('startCli — a runner declaring no backend is cleaned up all the same', async () => {
        // Given - a runner with no backend
        const { cleanup, orchestrator } = await startCli('echo');

        // Then - the cleanup has nothing to stop and says so by ending
        await expect(cleanup()).resolves.toBeUndefined();
        expect(orchestrator).toBeNull();
    });

    test('startCli — a backend that cannot listen releases the services started before it and stops them', async () => {
        // Given - a port another server holds, and a cache on a fake container
        using _ = clock.at('2026-10-21T10:00:00.000Z');
        const holder = createServer().listen(0, '127.0.0.1');
        await once(holder, 'listening');
        const address = holder.address();
        const port = typeof address === 'object' && address !== null ? address.port : 0;
        const log: CallLog = [];
        fakeContainers(log);
        const printed = vi.spyOn(console, 'log').mockReturnValue();

        // When - a runner declares a backend on that port beside the cache
        const starting = startCli('echo', {
            backend: { env: 'API_URL', port },
            services: { cache: fakeService(log, 'redis:7') },
        });

        // Then - the start is refused, after the cache was acquired, released and its container stopped
        await expect(starting).rejects.toThrow('EADDRINUSE');
        printed.mockRestore();
        holder.close();
        expect(log.filter((line) => /^(?:acquire|release|stop) /u.test(line))).toStrictEqual([
            `acquire redis:7 ${process.env.VITEST_POOL_ID}`,
            'release redis:7',
            'stop redis:7',
        ]);
    });
});
