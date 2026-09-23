import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { api } from '../api.specification.js';

// What a request sends, and what comes back, is data: the documents beside this
// File state it. What stays here is the chain's own `.headers()` layering, and
// What the chain refuses.

describe('requests', () => {
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
