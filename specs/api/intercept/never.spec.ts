import { http, openai } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api, QUOTES_URL } from '../intercepts.specification.js';

describe('never', () => {
    test('a never stub the action does not reach lets the chain pass', async () => {
        // Given - the read declared, the write to the same provider declared never requested
        const result = await api
            .intercept(http.get(QUOTES_URL), http.json({ quote: 'read only' }))
            .intercept(http.never(http.post(QUOTES_URL)))
            .get('/quote');

        // Then - the action made the read alone, and nothing is refused
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {
                "quote": "read only"
            }
        `);
    });

    test('a never stub the action reaches rejects it, naming the route and the call, even beside a stub that would answer', async () => {
        // Given - the POST declared never requested, before a stub that would have answered it
        const chain = api
            .intercept(http.never(http.post(QUOTES_URL)))
            .intercept(http.post(QUOTES_URL), http.json({ quote: 'answered' }))
            .get('/submit');

        // Then - the call that happened is the failure, read by its route and its url
        await expect(chain).rejects.toThrow(
            'found: a route the chain declared never requested was reached:',
        );
        await expect(chain).rejects.toThrow(
            `- POST ${QUOTES_URL} — reached by POST ${QUOTES_URL}?lang=en`,
        );
    });

    test('a provider stub declared never fails the run when the action calls it, as an http never stub does', async () => {
        // Given - the chat completions endpoint declared never requested, and an action that asks it
        const chain = api.intercept(openai.never(openai.chat())).get('/assistant/openai-chat');

        // Then - the call that happened is the failure
        await expect(chain).rejects.toThrow(
            [
                'found: a route the chain declared never requested was reached:',
                '  - POST https://api.openai.com/v1/chat/completions — reached by POST https://api.openai.com/v1/chat/completions',
                "why: A never stub states the subject must not reach its route within the chain's terminal action, or the `intercept()` scope, it is declared for.",
                'fix: take the call out of the path under test — or, if the call is now intended, replace the never stub with one that answers it',
                'read: docs/reference/stubs.md#never--a-call-that-must-not-happen',
            ].join('\n'),
        );
    });
});
