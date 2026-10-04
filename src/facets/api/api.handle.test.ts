import { Hono } from 'hono';
import { describe, expect, test, vi } from 'vitest';

import { clock } from '../../clock/clock.js';
import { fakeService } from '../../services/startup/orchestrator.fixtures.js';
import type { CallLog } from '../../services/startup/orchestrator.fixtures.js';
import { startApi } from './api.handle.js';

describe('startApi', () => {
    test('api.handle — the app a specification drives — is built from the started services, answers the chain, and lets the services go at cleanup', async () => {
        // Given - an app factory reading the record it is handed, over one embedded service
        using _ = clock.at('2026-09-25T10:00:00.000Z');
        const log: CallLog = [];
        const printed = vi.spyOn(console, 'log').mockReturnValue();
        const files = fakeService(log, 'sqlite', { defaultPort: 0 });
        const { api, cleanup } = await startApi({
            root: import.meta.dirname,
            server: (services) => {
                log.push(`server ${Object.keys(services).join(',')}`);
                const app = new Hono();
                app.get('/ping', (context) => context.json({ pong: true }));
                return app;
            },
            services: { files },
        });
        printed.mockRestore();

        // When - the chain sends a request, and the specification ends
        const result = await api.get('/ping');
        await cleanup();

        // Then - the service started and acquired before the app was built, the app answered, and the service released at the end
        expect([log.filter((line) => !line.startsWith('initialize')), result.status]).toStrictEqual(
            [
                [`acquire sqlite ${process.env.VITEST_POOL_ID}`, 'server files', 'release sqlite'],
                200,
            ],
        );
    });
});
