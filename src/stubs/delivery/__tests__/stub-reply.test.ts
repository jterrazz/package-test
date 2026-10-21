import { describe, expect, test } from 'vitest';

import type { MatchableRequest } from '../../exchange.js';
import { refusedReply, replyOf, requestBody, unmatchedSummary } from '../stub-reply.js';

const ASKED: MatchableRequest = { body: null, headers: {}, method: 'GET', url: '/orders' };

const echoing = (request: MatchableRequest): { body: string; status: number } => ({
    body: request.url,
    status: 201,
});

describe('stub-reply', () => {
    test('requestBody — a body as a filter reads it — parsed JSON, the raw text when it is none, null when empty', () => {
        // Given - a JSON body, a text body and none
        // Then - the value, the text, and null
        expect([requestBody('{"a":1}'), requestBody('a=1'), requestBody('')]).toStrictEqual([
            { a: 1 },
            'a=1',
            null,
        ]);
    });

    test('replyOf — the reply a matched stub states — a fixed reply as written, a function of the request called with it', async () => {
        // Given - a stub with a fixed reply, and one that answers the url it was asked
        const fixed = { body: 'ok', status: 200 };

        // Then - each stub's reply for this request
        expect([await replyOf(fixed, ASKED), await replyOf(echoing, ASKED)]).toStrictEqual([
            { body: 'ok', status: 200 },
            { body: '/orders', status: 201 },
        ]);
    });

    test('refusedReply — the 501 every delivery answers — one wording for a request no stub matches', () => {
        // Given - an unmatched GET
        // Then - the one error both the msw handlers and the stub backend answer
        expect(refusedReply(unmatchedSummary('GET', '/orders'))).toBe(
            '@jterrazz/test strict stubs: unmatched request GET /orders',
        );
    });
});
