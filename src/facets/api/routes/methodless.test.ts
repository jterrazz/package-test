import { describe, expect, test } from 'vitest';

import { methodlessDrift } from './methodless.js';

const ALL_MCP = { method: 'ALL', path: '/mcp' };
const GET_HEALTH = { method: 'GET', path: '/health' };

describe('methodless', () => {
    test('a list naming exactly the routes taken on any method has drifted nowhere', () => {
        // Given - the app takes /mcp on any method and /health on GET
        // Then - a list naming /mcp alone agrees
        expect(methodlessDrift([ALL_MCP, GET_HEALTH], ['/mcp'])).toStrictEqual([]);
    });

    test('a route taken on any method that the list misses is named, to add', () => {
        // Given - an empty list beside an app.all() route
        // Then - the missing route is named with the line that adds it
        expect(methodlessDrift([ALL_MCP, GET_HEALTH], [])).toStrictEqual([
            "  ALL /mcp — the app takes it on any method, and the list misses it: add '/mcp'",
        ]);
    });

    test('a listed route the app takes on its own methods only, or not at all, is named, to remove', () => {
        // Given - /health taken on GET alone, and no /gone in the table
        // Then - each stale entry says why it goes
        expect(methodlessDrift([ALL_MCP, GET_HEALTH], ['/mcp', '/health', '/gone'])).toStrictEqual([
            "  /health — the list names it, and the app takes it on its own methods only: remove '/health'",
            "  /gone — the list names it, and the app's table holds no such route: remove '/gone'",
        ]);
    });

    test('a route is matched by its shape, whatever its parameters are named', () => {
        // Given - the app takes /mcp/:id on any method
        const table = [{ method: 'ALL', path: '/mcp/:id' }];

        // Then - /mcp/:session is the same route, and a deeper path is another
        expect(methodlessDrift(table, ['/mcp/:session'])).toStrictEqual([]);
        expect(methodlessDrift(table, ['/mcp/:id/x'])).toStrictEqual([
            "  ALL /mcp/:id — the app takes it on any method, and the list misses it: add '/mcp/:id'",
            "  /mcp/:id/x — the list names it, and the app's table holds no such route: remove '/mcp/:id/x'",
        ]);
    });
});
