import { specification } from '@jterrazz/test';
/* oxlint-disable jterrazz/runner-in-specification-file -- the ledger is written by cleanup(), which is the behaviour under test: the runner is built and cleaned up inside the test that reads what its cleanup wrote, so it cannot live in a *.specification.ts whose afterAll owns the cleanup. */
import { Hono } from 'hono';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, inject, test } from 'vitest';

function ledgersIn(directory: string): string[] {
    return existsSync(directory)
        ? readdirSync(directory).filter((name) => name.endsWith('.json'))
        : [];
}

describe('ledger', () => {
    test("a specification's cleanup writes its declared routes and the requests it sent into the run's folder", async () => {
        // Given - an app declaring one route behind a middleware, and the folder the run provides
        const app = new Hono();
        app.use(async (_context, proceed) => {
            await proceed();
        });
        app.get('/written', (context) => context.text('pong'));
        const directory = inject('routesLedger') ?? '';
        const before = new Set(ledgersIn(directory));

        // When - one request is sent, and the specification cleans up
        const { api, cleanup } = await specification.api({
            root: '../../__fixtures__/specimen-api',
            server: () => app,
        });
        await api.get('/written');
        await cleanup();

        // Then - its ledger names the route (the middleware left out) and the request that reached it
        const written = ledgersIn(directory)
            .filter((name) => !before.has(name))
            .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown)
            .filter((ledger) => JSON.stringify(ledger).includes('/written'));
        expect(written).toStrictEqual([
            {
                declared: [{ method: 'GET', path: '/written' }],
                reached: [{ method: 'GET', path: '/written' }],
            },
        ]);
    });
});
