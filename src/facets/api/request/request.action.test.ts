import { describe, expect, test } from 'vitest';

import { readerOf } from '../../../chain/state.js';
import { directory, file } from '../../../disk/spec-path.js';
import type { ServerPort } from '../server/server.port.js';
import { del, get, post, put, request } from './request.action.js';
import { params } from './route.js';

type Asked = { body: unknown; headers: unknown; method: string; path: string; template: unknown };

/** A server that records what it is asked, and answers 200. */
function recording(asked: Asked[]): { server: ServerPort } {
    return {
        server: {
            request: async (method, path, body, options = {}) => {
                asked.push({
                    body,
                    headers: options.headers,
                    method,
                    path,
                    template: options.template,
                });
                return await Promise.resolve({ body: null, headers: {}, status: 200 });
            },
        },
    };
}

const run = (testDir: string): { config: object; testDir: string; workDir: null } => ({
    config: {},
    testDir,
    workDir: null,
});

async function messageOf(work: () => Promise<unknown>): Promise<string> {
    try {
        await work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

function refusalOf(work: () => unknown): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('request', () => {
    test('request.action — the verbs — each sends its method to the filled route, a file body read by its kind, the chain’s headers only when it carries some', async () => {
        // Given - a spec folder, a recording server, and a chain carrying a header and one carrying none
        const testDir = import.meta.dirname;
        const asked: Asked[] = [];
        const adapters = recording(asked);
        const carrying = readerOf({ slices: { headers: { 'x-key': 'k' } }, testDir: null });
        const bare = readerOf({ slices: {}, testDir: null });

        // When - each verb is sent
        await get.perform(['/users/:id', { params: { id: 7 } }], carrying, adapters, run(testDir));
        await post.perform(
            ['/orders', file('./_requests/order.json')],
            bare,
            adapters,
            run(testDir),
        );
        await put.perform(['/notes/1', file('./_requests/note.txt')], bare, adapters, run(testDir));
        await del.perform(['/notes/1'], bare, adapters, run(testDir));

        // Then - what the server was asked
        expect(asked).toStrictEqual([
            {
                body: undefined,
                headers: { 'x-key': 'k' },
                method: 'GET',
                path: '/users/7',
                template: '/users/:id',
            },
            {
                body: { sku: 'A1' },
                headers: undefined,
                method: 'POST',
                path: '/orders',
                template: undefined,
            },
            {
                body: 'hello\n',
                headers: undefined,
                method: 'PUT',
                path: '/notes/1',
                template: undefined,
            },
            {
                body: undefined,
                headers: undefined,
                method: 'DELETE',
                path: '/notes/1',
                template: undefined,
            },
        ]);
    });

    test('request.action — .request() — sends a request written in place or in a file, the chain’s headers over the written ones', async () => {
        // Given - a spec folder, and a chain carrying a header the file also writes
        const testDir = import.meta.dirname;
        const asked: Asked[] = [];
        const carrying = readerOf({ slices: { headers: { 'x-trace': 'chain' } }, testDir: null });

        // When - a request written in place, and one from a file, are sent
        const result = await request.perform(
            [
                '\n            PATCH /users/7\n            x-a: 1\n\n            {"name": "Ada"}\n        ',
            ],
            readerOf({ slices: {}, testDir: null }),
            recording(asked),
            run(testDir),
        );
        await request.perform(
            [file('./_requests/create.http')],
            carrying,
            recording(asked),
            run(testDir),
        );

        // Then - each parsed whole, and the result read from the answer
        expect([asked, result.status]).toStrictEqual([
            [
                {
                    body: '{"name": "Ada"}',
                    headers: { 'x-a': '1' },
                    method: 'PATCH',
                    path: '/users/7',
                    template: undefined,
                },
                {
                    body: '{ "sku": "B2" }',
                    headers: { 'x-trace': 'chain' },
                    method: 'POST',
                    path: '/orders',
                    template: undefined,
                },
            ],
            200,
        ]);
    });

    test('request.action — refusals — a route handed no params, by each verb, a directory as a body, and a request written off its form', async () => {
        // Given - each verb sent a template with no params, a post handed a directory, and a request in place with no request line
        const bare = readerOf({ slices: {}, testDir: null });
        const [adapters, ran] = [recording([]), run(import.meta.dirname)];
        const sends = [
            async () => await get.perform(['/users/:id'], bare, adapters, ran),
            async () => await post.perform(['/users/:id'], bare, adapters, ran),
            async () => await put.perform(['/users/:id'], bare, adapters, ran),
            async () => await del.perform(['/users/:id'], bare, adapters, ran),
            async () =>
                await post.perform(['/orders', directory('./_requests/')], bare, adapters, ran),
            async () => await request.perform(['nonsense'], bare, adapters, ran),
        ];

        // When - each is sent
        const refusals = await Promise.all(sends.map(messageOf));

        // Then - each refused in the words of its call
        expect(refusals.map((refusal) => refusal.split('\n')[0])).toStrictEqual([
            'found: .get("/users/:id") names :id and is handed no params',
            'found: .post("/users/:id") names :id and is handed no params',
            'found: .put("/users/:id") names :id and is handed no params',
            'found: .delete("/users/:id") names :id and is handed no params',
            'found: .post("/orders", directory("./_requests/")), a directory where the body is one file',
            'found: the request in place: the first line is "nonsense"',
        ]);
        expect(refusals[4]).toBe(
            [
                'found: .post("/orders", directory("./_requests/")), a directory where the body is one file',
                'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.',
                'fix: name one file: .post("/orders", file(\'./_requests/body.json\'))',
                'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
        );
        expect(
            refusalOf(() => {
                void get.prepare?.(['/users/:id'], bare);
            }),
        ).toBe(refusals[0]);
    });

    test('each route action takes the route option, and only it', () => {
        // Given - the four actions a route is sent through
        const actions = [get, post, put, del];

        // Then - each declares the params option, which names itself as the route option
        expect([actions.map(({ options }) => options), params]).toStrictEqual([
            [[params], [params], [params], [params]],
            {
                kind: 'option',
                name: 'params',
                row: {
                    group: 'Route option',
                    member: 'params',
                    name: '{ params }',
                    probe: 'params:',
                },
            },
        ]);
    });
});
