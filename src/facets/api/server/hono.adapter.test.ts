import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { describe, expect, test } from 'vitest';

import { HonoAdapter } from './hono.adapter.js';

describe('HonoAdapter', () => {
    test('the hono adapter — the routes an app declares — an app.all() route is declared, a middleware is not, and a sub-app keeps its routes behind an error handler', () => {
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

    test('the hono adapter — the routes an app declares — an app with no table declares nothing known', () => {
        // Given - a request function alone
        const adapter = new HonoAdapter({ request: () => Response.json({}) });

        // Then - the table is unknown, not empty
        expect(adapter.declared()).toBeUndefined();
    });

    test('the hono adapter — the requests it sent — records each request by its path, and by the template it was written as', async () => {
        // Given - an item route, reached once written as a template and once as a path
        const app = new Hono();
        app.get('/users/:id', (context) => context.json({ id: context.req.param('id') }));
        const adapter = new HonoAdapter(app);
        await adapter.request('GET', '/users/7', undefined, { template: '/users/:id' });
        await adapter.request('GET', '/users/8');

        // Then - the ledger route coverage reads
        expect(adapter.reached).toStrictEqual([
            { method: 'GET', path: '/users/7', template: '/users/:id' },
            { method: 'GET', path: '/users/8' },
        ]);
    });

    test('the hono adapter — the request it sends — JSON by default, a string as written, and a stated content-type in any case replacing the default', async () => {
        // Given - an app answering what it was sent
        const app = new Hono();
        app.all('/echo', async (context) =>
            context.json({
                body: await context.req.text(),
                key: context.req.header('x-key') ?? null,
                method: context.req.method,
                type: context.req.header('content-type') ?? null,
            }),
        );
        const adapter = new HonoAdapter(app);

        // When - it posts a value, puts a written body under a stated type, and gets nothing
        const sent = await Promise.all([
            adapter.request('POST', '/echo', { name: 'Ada' }),
            adapter.request('PUT', '/echo', 'name=Ada', {
                headers: { 'X-Key': 'k', 'content-type': 'application/x-www-form-urlencoded' },
            }),
            adapter.request('GET', '/echo'),
        ]);

        // Then - what the app read of each
        expect(sent.map((response) => response.body)).toStrictEqual([
            { body: '{"name":"Ada"}', key: null, method: 'POST', type: 'application/json' },
            {
                body: 'name=Ada',
                key: 'k',
                method: 'PUT',
                type: 'application/x-www-form-urlencoded',
            },
            { body: '', key: null, method: 'GET', type: 'application/json' },
        ]);
    });

    test('the hono adapter — the routes an app declares — an entry with no handler is a route', () => {
        // Given - a table a hand-written app states, its entry naming no handler
        const adapter = new HonoAdapter({
            request: () => Response.json({}),
            routes: [{ method: 'GET', path: '/health' }],
        });

        // Then - the route, for nothing marks it middleware
        expect(adapter.declared()).toStrictEqual([{ method: 'GET', path: '/health' }]);
    });

    test('the hono adapter — the body it read — a JSON body is its value, any other body its text, an empty body nothing', async () => {
        // Given - a route per kind of body an app answers with
        const app = new Hono();
        app.get('/json', (context) => context.json({ ok: true }));
        app.get('/page', (context) => context.html('<h1>Hello</h1>\n'));
        app.get('/feed', (context) =>
            context.body('data: one\n\ndata: two\n\n', 200, {
                'content-type': 'text/event-stream',
            }),
        );
        app.get('/nothing', (context) => context.body(null, 204));
        const adapter = new HonoAdapter(app);

        // When - each is requested
        const responses = await Promise.all(
            ['/json', '/page', '/feed', '/nothing'].map(
                async (path) => await adapter.request('GET', path),
            ),
        );

        // Then - the value, the texts without their trailing blank lines, and null
        expect(responses.map((response) => response.body)).toStrictEqual([
            { ok: true },
            '<h1>Hello</h1>',
            'data: one\n\ndata: two',
            null,
        ]);
    });

    test('the hono adapter — the body it read — a named text type and a type named neither text nor binary are read, and only a binary type drops its body', async () => {
        // Given - a YAML document, a GraphQL query, and an archive
        const app = new Hono();
        app.get('/schema', (context) =>
            context.body('count: 42\n', 200, { 'content-type': 'application/x-yaml' }),
        );
        app.get('/query', (context) =>
            context.body('{ user { id } }', 200, { 'content-type': 'application/graphql' }),
        );
        app.get('/archive', (context) =>
            context.body(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 200, {
                'content-type': 'application/zip',
            }),
        );
        const adapter = new HonoAdapter(app);

        // When - each is requested
        const responses = await Promise.all(
            ['/schema', '/query', '/archive'].map(
                async (path) => await adapter.request('GET', path),
            ),
        );

        // Then - both texts, and null for the bytes
        expect(responses.map((response) => response.body)).toStrictEqual([
            'count: 42',
            '{ user { id } }',
            null,
        ]);
    });

    test('the hono adapter — the body it read — a text type is its text though it parses as JSON, and a binary type is not read', async () => {
        // Given - a text reply that reads as a number, and an image
        const app = new Hono();
        app.get('/count', (context) => context.text('42'));
        app.get('/logo', (context) =>
            context.body(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 200, {
                'content-type': 'image/png',
            }),
        );
        const adapter = new HonoAdapter(app);

        // When - each is requested
        const responses = await Promise.all(
            ['/count', '/logo'].map(async (path) => await adapter.request('GET', path)),
        );

        // Then - the text, and null for the bytes
        expect(responses.map((response) => response.body)).toStrictEqual(['42', null]);
    });
});
