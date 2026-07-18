import { describe, expect, test } from 'vitest';

import type {
    InterceptEntry,
    InterceptResponse,
    MatchableRequest,
} from '../../core/contracts/types.js';
import { InterceptQueue } from './intercept.js';

const URL_A = 'https://api.example.com/a';
const URL_B = 'https://api.example.com/b';

/** Build a MatchableRequest for queue.take() from an optional JSON body. */
function req(body: unknown = null, url = URL_A): MatchableRequest {
    return { body, headers: {}, url };
}

function entry(
    url: RegExp | string,
    method: string,
    response: Partial<InterceptResponse> = {},
    match?: (request: MatchableRequest) => boolean,
): InterceptEntry {
    return {
        response: { body: { ok: true }, status: 200, ...response },
        trigger: { adapter: 'http', match, method, url, wrap: (data) => ({ body: data }) },
    };
}

describe('intercept queue — FIFO consumption', () => {
    test('same trigger declared twice fires in declaration order (429 then 200)', () => {
        // Given - two entries on the same URL: an error first, a success second
        const first = entry(URL_A, 'GET', { status: 429 });
        const second = entry(URL_A, 'GET', { status: 200 });
        const queue = new InterceptQueue([first, second]);

        // Then - requests consume the queue front to back
        expect(queue.take(URL_A, 'GET', req())).toBe(first);
        expect(queue.take(URL_A, 'GET', req())).toBe(second);
    });

    test('an exhausted queue yields null', () => {
        // Given - a single entry, already consumed
        const queue = new InterceptQueue([entry(URL_A, 'GET')]);
        queue.take(URL_A, 'GET', req());

        // Then - the next request finds nothing
        expect(queue.take(URL_A, 'GET', req())).toBeNull();
    });

    test('method and URL both gate the match; * matches any method', () => {
        // Given - a GET on A and a wildcard on B
        const getA = entry(URL_A, 'GET');
        const anyB = entry(URL_B, '*');
        const queue = new InterceptQueue([getA, anyB]);

        // Then - mismatched method or URL is not consumed
        expect(queue.take(URL_A, 'POST', req())).toBeNull();
        expect(queue.take(URL_B, 'DELETE', req(null, URL_B))).toBe(anyB);
        expect(queue.take(URL_A, 'GET', req())).toBe(getA);
    });

    test('a body matcher skips non-matching entries within the same trigger', () => {
        // Given - two entries on one URL routed by body content
        const forAlice = entry(URL_A, 'POST', { body: { user: 'alice' } }, (r) =>
            JSON.stringify(r.body).includes('alice'),
        );
        const forBob = entry(URL_A, 'POST', { body: { user: 'bob' } }, (r) =>
            JSON.stringify(r.body).includes('bob'),
        );
        const queue = new InterceptQueue([forAlice, forBob]);

        // Then - the body selects the entry, regardless of declaration order
        expect(queue.take(URL_A, 'POST', req({ name: 'bob' }))).toBe(forBob);
        expect(queue.take(URL_A, 'POST', req({ name: 'alice' }))).toBe(forAlice);
        expect(queue.take(URL_A, 'POST', req({ name: 'carol' }))).toBeNull();
    });

    test('two RegExp triggers with the same source share one queue', () => {
        // Given - the same pattern object used twice (contract reuse)
        const re = /example\.com\/a/;
        const first = entry(re, 'GET', { status: 429 });
        const second = entry(new RegExp(re.source), 'GET', { status: 200 });
        const queue = new InterceptQueue([first, second]);

        // Then - string-identical patterns are one trigger
        expect(queue.urls).toHaveLength(1);
        expect(queue.take(re, 'GET', req())).toBe(first);
        expect(queue.take(re, 'GET', req())).toBe(second);
    });
});

describe('intercept queue — strict failure message (CONVENTIONS D7)', () => {
    test('names the offending request and lists registered triggers with state', () => {
        // Given - a queue with one consumed and one pending entry
        const queue = new InterceptQueue([entry(URL_A, 'GET'), entry(URL_B, 'POST')]);
        queue.take(URL_A, 'GET', req());

        // When - an unmatched request is reported
        const error = queue.unmatchedError('GET', 'https://unregistered.test/x');

        // Then - method + URL + full trigger list with consumption markers
        expect(error.message).toContain(
            'Unmatched outgoing HTTP request during spec: GET https://unregistered.test/x',
        );
        expect(error.message).toContain(`- GET ${URL_A} (already consumed)`);
        expect(error.message).toContain(`- POST ${URL_B}`);
    });

    test('falls back to "no intercepts registered" on an empty queue', () => {
        // Given - an empty queue
        const queue = new InterceptQueue([]);

        // Then - the fallback wording is used
        expect(queue.unmatchedError('GET', URL_A).message).toContain('no intercepts registered');
    });
});
