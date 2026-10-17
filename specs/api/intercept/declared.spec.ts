import { http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { api as app } from '../api.specification.js';

describe('declared', () => {
    test('the outgoing call is answered by the stub the chain declares', async () => {
        // Given - the one call the app makes out, answered in place
        const result = await app
            .intercept(
                http.get('https://enrich.example.test/label'),
                http.json({ label: 'enriched' }),
            )
            .get('/label');

        // Then - the app served what the stub answered
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"label": "enriched"}
        `);
    });

    test('a request handed with no response is refused in the words of the call that wrote it', () => {
        // Given - a caller the types do not reach, declaring a request alone
        // Then - refused as it is stated, naming the two forms of a stub
        // @ts-expect-error -- a bare request: the overloads refuse it at every typed site
        expect(() => app.intercept(http.get('https://news.test/latest'))).toThrow(
            [
                'found: .intercept(request), a bare request with no response',
                'why: A stub is a request and its response: a request alone answers nothing.',
                'fix: pass a stub, defineStub({ request, response }), or the inline pair .intercept(request, response)',
                'read: docs/reference/stubs.md#using-them-intercept',
            ].join('\n'),
        );
    });
});
