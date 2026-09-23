/* oxlint-disable jterrazz/c2-http-only-requests -- C24 sends a body file to requests/ (variant A: `.post(path, file('./requests/x.json'))`) while C2 refuses anything but `.http` there, so the body-file specs below cannot satisfy both; the conflict is question 41 of VISION.md. */
import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { api } from '../api.specification.js';

// ── Critical paths — both node and compose ──

describe('requests', () => {
    test('sends GET request', async () => {
        // Given - seeded data
        const result = await api
            .seed(file('./seeds/two-users.sql'), { database: 'db' })
            .get('/users');

        // Then - the full response for the two seeded users
        expect(result.response).toMatch(file('./expected/users-list.http'));
    });

    test('sends the complete request from a .http file', async () => {
        // Given - method, path, headers, and body loaded from requests/create-user.http
        const result = await api.request(file('./requests/create-user.http'));

        // Then - the full created-user response
        expect(result.response).toMatch(file('./expected/user-created.http'));
    });

    test('request that writes to multiple databases', async () => {
        // Given - create a user (app writes to both databases)
        const result = await api.request(file('./requests/create-user.http'));

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
        const result = await api
            .headers({ 'x-chain': 'from-chain' })
            .request(file('./requests/echo.http'));

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
            .request(file('./requests/echo.http'));

        // Then - the last call wins over both the earlier call and the file
        expect(result.status).toBe(200);
        const body = result.response.body as { headers: Record<string, null | string> };
        expect(body.headers['x-chain']).toBe('second');
        expect(body.headers['x-file']).toBe('chain-wins');
    });

    test('passes a non-JSON request body through verbatim', async () => {
        // Given - a .http file whose body is whitespace-significant plain text
        const result = await api.request(file('./requests/echo-raw.http'));

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
        // Given - a user seeded at a known id (reset truncates without restarting the identity sequence, so the id is pinned in the seed, not assumed)
        const result = await api
            .seed(file('./seeds/one-user-at-id.sql'), { database: 'db' })
            .put('/users/1000', { email: 'updated@test.com', name: 'Alice Updated' });

        // Then - 200 OK and the row now carries the updated fields
        expect(result.status).toBe(200);
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name', 'email'],
            rows: [['Alice Updated', 'updated@test.com']],
        });
    });

    test('sends POST with a body read from a file', async () => {
        // Given - the body in requests/erin.json, not written inline
        const result = await api.post('/users', file('./requests/erin.json'));

        // Then - the app parsed the JSON the file holds, and stored it
        expect(result.status).toBe(201);
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name', 'email'],
            rows: [['Erin', 'erin@test.com']],
        });
    });

    test('sends PUT with a body read from a file', async () => {
        // Given - a user seeded at a known id, and the new fields in requests/alice-renamed.json
        const result = await api
            .seed(file('./seeds/one-user-at-id.sql'), { database: 'db' })
            .put('/users/1000', file('./requests/alice-renamed.json'));

        // Then - the row carries the fields the file holds
        expect(result.status).toBe(200);
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name', 'email'],
            rows: [['Alice Renamed', 'alice.renamed@test.com']],
        });
    });

    test('a JSON body file is sent as its value, the way an inline body is', async () => {
        // Given - requests/erin.json, written over four indented lines
        const result = await api.post('/echo-raw', file('./requests/erin.json'));

        // Then - the app received the value serialised, not the file's layout
        expect(result.status).toBe(200);
        expect(result.response.body).toStrictEqual({
            raw: '{"email":"erin@test.com","name":"Erin"}',
        });
    });

    test('a body file that is not JSON is sent verbatim', async () => {
        // Given - a plain-text body whose whitespace is significant
        const result = await api.post('/echo-raw', file('./requests/note.txt'));

        // Then - the app received the file's bytes as they are written
        expect(result.status).toBe(200);
        expect(result.response.body).toStrictEqual({ raw: 'kept  as\n    written\n' });
    });

    test('sends DELETE request', async () => {
        // Given - non-existent resource
        const result = await api.delete('/users/999');

        // Then - the full not-found response
        expect(result.response).toMatch(file('./expected/user-not-found.http'));
    });
});

// ── Edge cases ──

describe('request errors', () => {
    test('refuses a directory as a body, naming the one-file form', async () => {
        // Given - a body named by directory()
        // Then - the chain rejects before a request is sent: a body is one file
        await expect(api.post('/users', directory('./requests/'))).rejects.toThrow(
            '.post("/users", directory("./requests/")): a body is one file — name it with file().',
        );
    });

    test('throws on nonexistent request file', async () => {
        // Given - reference to a nonexistent .http file
        // Then - the chain rejects with ENOENT
        // checker-disable-next-line c8 -- negative spec: the missing file IS the behaviour under test
        await expect(api.request(file('./requests/nonexistent.http'))).rejects.toThrow('ENOENT');
    });
});
