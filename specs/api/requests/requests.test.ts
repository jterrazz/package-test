import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

// ── Critical paths — both node and compose ──

describe('requests', () => {
    test('sends GET request', async () => {
        // Given - seeded data
        const result = await api.seed('two-users.sql', { database: 'db' }).get('/users');

        // Then - the full response for the two seeded users
        expect(result.response).toMatch('users-list.http');
    });

    test('sends the complete request from a .http file', async () => {
        // Given - method, path, headers, and body loaded from requests/create-user.http
        const result = await api.request('create-user.http');

        // Then - the full created-user response
        expect(result.response).toMatch('user-created.http');
    });

    test('request that writes to multiple databases', async () => {
        // Given - create a user (app writes to both databases)
        const result = await api.request('create-user.http');

        // Then - user in default db and event in analytics db
        expect(result.status).toBe(201);
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name', 'email'],
            rows: [['Charlie', 'charlie@test.com']],
        });
        await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
            columns: ['type'],
            rows: [['user_created']],
        });
    });

    // oxlint-disable-next-line jterrazz/d12w-response-body-probe -- request-building self-test: the subject is the header MERGE delta (x-file preserved, x-chain overridden, body forwarded), a single-field-delta scalpel — a full-response golden would assert the whole echo envelope and obscure which fields the merge test targets.
    test('merges .headers() on top of the .http file headers', async () => {
        // Given - the file sets x-file and x-chain; the chain overrides x-chain
        const result = await api.headers({ 'x-chain': 'from-chain' }).request('echo.http');

        // Then - file header preserved, chain header wins, body forwarded
        expect(result.status).toBe(200);
        const body = result.response.body as {
            body: { greeting: string };
            headers: { 'x-chain': string; 'x-file': string };
        };
        expect(body.headers['x-file']).toBe('from-file');
        expect(body.headers['x-chain']).toBe('from-chain');
        expect(body.body.greeting).toBe('hello');
    });

    test('repeated .headers() calls merge with the later call winning', async () => {
        // Given - the same header set by two successive .headers() calls
        const result = await api
            .headers({ 'x-chain': 'first' })
            .headers({ 'x-chain': 'second', 'x-file': 'chain-wins' })
            .request('echo.http');

        // Then - the last call wins over both the earlier call and the file
        expect(result.status).toBe(200);
        const body = result.response.body as { headers: Record<string, null | string> };
        expect(body.headers['x-chain']).toBe('second');
        expect(body.headers['x-file']).toBe('chain-wins');
    });

    test('passes a non-JSON request body through verbatim', async () => {
        // Given - a .http file whose body is whitespace-significant plain text
        const result = await api.request('echo-raw.http');

        // Then - the app received the exact raw text (double space + indentation intact)
        expect(result.status).toBe(200);
        expect((result.response.body as { raw: string }).raw).toBe(
            'first  line\n    indented line',
        );
    });

    test('sends POST with an inline body', async () => {
        // Given - inline JSON body (no requests/ file)
        const result = await api.post('/users', { email: 'dora@test.com', name: 'Dora' });

        // Then - 201 Created
        expect(result.status).toBe(201);
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name'],
            rows: [['Dora']],
        });
    });

    test('sends PUT with an inline body', async () => {
        // Given - a user seeded at a known id (reset truncates without restarting
        // The identity sequence, so the id is pinned in the seed, not assumed)
        const result = await api
            .seed('one-user-at-id.sql', { database: 'db' })
            .put('/users/1000', { email: 'updated@test.com', name: 'Alice Updated' });

        // Then - 200 OK and the row now carries the updated fields
        expect(result.status).toBe(200);
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name', 'email'],
            rows: [['Alice Updated', 'updated@test.com']],
        });
    });

    test('sends DELETE request', async () => {
        // Given - non-existent resource
        const result = await api.delete('/users/999');

        // Then - the full not-found response
        expect(result.response).toMatch('user-not-found.http');
    });
});

// ── Edge cases ──

describe('request errors', () => {
    test('throws on nonexistent request file', async () => {
        // Given - reference to a nonexistent .http file
        // Then - the chain rejects with ENOENT
        // oxlint-disable-next-line jterrazz/c8-referenced-fixture-exists -- negative spec: the missing file IS the behaviour under test
        await expect(api.request('nonexistent.http')).rejects.toThrow('ENOENT');
    });
});
