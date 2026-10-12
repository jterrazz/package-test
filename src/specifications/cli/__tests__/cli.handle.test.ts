import { describe, expect, test } from 'vitest';

import { findFreePort } from '../../../services/process/listening.js';
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
});
