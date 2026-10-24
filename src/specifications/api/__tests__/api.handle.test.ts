import { Hono } from 'hono';
import { describe, expect, test, vi } from 'vitest';

import { clock } from '../../../clock/clock.js';
import { fakeService } from '../../../services/startup/__tests__/orchestrator.fixtures.js';
import type { CallLog } from '../../../services/startup/__tests__/orchestrator.fixtures.js';
import { refuseOptions, startApi } from '../api.handle.js';

describe('api.handle', () => {
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

    test('api.handle — the target of a specification — a url beside root, a blank url, a url that does not open on its scheme, and a deadline that is no positive number are refused', () => {
        // Given - each option a deployed target refuses
        const firstLines = [
            { root: '.', url: 'https://site.test' },
            { url: '   ' },
            { url: 'see https://site.test' },
            { timeout: Number.NaN, url: 'https://site.test' },
            { timeout: Number.POSITIVE_INFINITY, url: 'https://site.test' },
            { timeout: -1, url: 'https://site.test' },
            { timeout: '10', url: 'https://site.test' },
            { timeout: 1, url: 'https://site.test' },
        ].map((options) => {
            try {
                refuseOptions(options);
                return '';
            } catch (error) {
                return error instanceof Error ? (error.message.split('\n')[0] ?? '') : '';
            }
        });

        // Then - each named as written, the last accepted
        expect(firstLines).toStrictEqual([
            'found: specification.api({ url, services }), services beside a deployed url',
            'found: specification.api({ url: "   " }), no app to specify',
            'found: specification.api({ url: "see https://site.test" }), no http(s) URL',
            'found: specification.api({ url, timeout: NaN }), no deadline',
            'found: specification.api({ url, timeout: Infinity }), no deadline',
            'found: specification.api({ url, timeout: -1 }), no deadline',
            'found: specification.api({ url, timeout: "10" }), no deadline',
            '',
        ]);
    });
});
