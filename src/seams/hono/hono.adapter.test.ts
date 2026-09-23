import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { describe, expect, test } from 'vitest';

import { HonoAdapter } from './hono.adapter.js';

describe('the hono adapter — the routes an app declares', () => {
    test('an app.all() route is declared, a middleware is not, and a sub-app keeps its routes behind an error handler', () => {
        // Given - middleware at the root and under a prefix, a route for every method, a get, and a sub-app with its own error handler
        const app = new Hono();
        app.use('*', cors());
        app.use('/api/*', cors());
        app.all('/mcp', (context) => context.json({ ok: true }));
        app.get('/users', (context) => context.json([]));
        const admin = new Hono();
        admin.onError((_error, context) => context.json({ error: true }, 500));
        admin.get('/stats', (context) => context.json({}));
        app.route('/admin', admin);

        // Then - the routes, never the middleware
        expect(new HonoAdapter(app).declared()).toStrictEqual([
            { method: 'ALL', path: '/mcp' },
            { method: 'GET', path: '/users' },
            { method: 'GET', path: '/admin/stats' },
        ]);
    });

    test('an app with no table declares nothing known', () => {
        // Given - a request function alone
        const adapter = new HonoAdapter({ request: () => Response.json({}) });

        // Then - the table is unknown, not empty
        expect(adapter.declared()).toBeUndefined();
    });
});
