import { describe, expect, test } from 'vitest';

import type { MatchableRequest } from '../exchange.js';
import { http } from '../kinds/http.js';
import type { Stub } from '../stub.js';
import { StubQueue } from './stub-queue.js';

const URL_A = 'https://api.example.com/a';
const URL_B = 'https://api.example.com/b';

function req(overrides: Partial<MatchableRequest> = {}): MatchableRequest {
    return { body: null, headers: {}, method: 'GET', url: URL_A, ...overrides };
}

function stub(request: Stub['request'], tag: string, extra: Partial<Stub> = {}): Stub {
    return { request, response: http.json({ tag }), ...extra };
}

function serve(queue: StubQueue, overrides: Partial<MatchableRequest> = {}): null | string {
    const served = queue.take(req(overrides));
    if (!served) {
        return null;
    }
    return (served.response as { body: { tag: string } }).body.tag;
}

describe('StubQueue', () => {
    test('stub queue — selection — the first matching stub wins and, without times, keeps serving', () => {
        // Given - two stubs on the same route
        const queue = new StubQueue([
            stub(http.get(URL_A), 'first'),
            stub(http.get(URL_A), 'second'),
        ]);

        // Then - the first one answers every request (no times = unlimited: A re-render or a retry replays it instead of falling through)
        expect(serve(queue)).toBe('first');
        expect(serve(queue)).toBe('first');
    });

    test('stub queue — selection — times exhausts a stub, and the next matching one takes over', () => {
        // Given - a finite error sequence before an unlimited success tail
        const queue = new StubQueue([
            stub(http.get(URL_A), 'error', { times: 2 }),
            stub(http.get(URL_A), 'ok'),
        ]);

        // Then - the sequence plays out, then the tail stays
        expect(serve(queue)).toBe('error');
        expect(serve(queue)).toBe('error');
        expect(serve(queue)).toBe('ok');
        expect(serve(queue)).toBe('ok');
    });

    test('stub queue — selection — an exhausted queue yields null — the strict violation signal', () => {
        // Given - one stub allowed exactly once
        const queue = new StubQueue([stub(http.get(URL_A), 'once', { times: 1 })]);

        // Then - the second request matches nothing left
        expect(serve(queue)).toBe('once');
        expect(serve(queue)).toBeNull();
    });

    test('stub queue — selection — method and url both gate the match; * matches any method', () => {
        // Given - a GET on A and a wildcard on B
        const queue = new StubQueue([
            stub(http.get(URL_A), 'get-a'),
            stub(http.any(URL_B), 'any-b'),
        ]);

        // Then - a mismatched method or url selects nothing
        expect(serve(queue, { method: 'POST' })).toBeNull();
        expect(serve(queue, { method: 'DELETE', url: URL_B })).toBe('any-b');
        expect(serve(queue)).toBe('get-a');
    });

    test('stub queue — selection — a body filter routes two stubs sharing one url', () => {
        // Given - two stubs on one url routed by body content
        const queue = new StubQueue([
            stub(http.post(URL_A, { body: { user: 'alice' } }), 'alice'),
            stub(http.post(URL_A, { body: { user: 'bob' } }), 'bob'),
        ]);

        // Then - the body picks the stub, whatever the declaration order
        expect(serve(queue, { body: { user: 'bob' }, method: 'POST' })).toBe('bob');
        expect(serve(queue, { body: { user: 'alice' }, method: 'POST' })).toBe('alice');
        expect(serve(queue, { body: { user: 'carol' }, method: 'POST' })).toBeNull();
    });

    test('stub queue — selection — a request carrying a header the stub states absent does not match', () => {
        // Given - a stub that fires only on a request without a cookie
        const queue = new StubQueue([
            stub(http.get(URL_A, { without: { headers: ['Cookie'] } }), 'anonymous'),
        ]);

        // Then - the header present, with any value, keeps the stub from firing
        expect(serve(queue, { headers: { cookie: '' } })).toBeNull();
        expect(serve(queue, { headers: { 'x-other': '1' } })).toBe('anonymous');
    });

    test('stub queue — strict failure message (rule `network-strict-after-first-stub`) — names the header a declared stub states absent', () => {
        // Given - a stub forbidding a header the request carries
        const queue = new StubQueue([
            stub(http.get(URL_A, { without: { headers: ['cookie'] } }), 'anonymous'),
        ]);
        queue.take(req({ headers: { cookie: 'session=1' } }));

        // Then - the declared list says what the stub refused
        expect(queue.unmatchedError('GET', URL_A).message).toContain(
            `- GET ${URL_A} (without header cookie)`,
        );
    });

    test('stub queue — url forms — a RegExp url tests the full observed url', () => {
        // Given - a pattern stub
        const queue = new StubQueue([stub(http.get(/example\.com\/a/u), 're')]);

        // Then - it matches by pattern, and shares one route with its twin
        expect(serve(queue)).toBe('re');
        expect(queue.routes).toHaveLength(1);
    });

    test('stub queue — url forms — routes dedupe by pattern and collect their methods', () => {
        // Given - two methods on one path-form url plus another route
        const queue = new StubQueue([
            stub(http.get('/events'), 'get'),
            stub(http.post('/events'), 'post'),
            stub(http.get(URL_A), 'a'),
        ]);

        // Then - one route per pattern, carrying every declared method
        expect(queue.routes).toHaveLength(2);
        expect(queue.routes[0]?.methods).toStrictEqual(['GET', 'POST']);
        expect(queue.routes[1]?.url).toBe(URL_A);
    });

    test('stub queue — strict failure message (rule `network-strict-after-first-stub`) — names the offending request and lists stubs with their state', () => {
        // Given - a queue with one exhausted and one untouched stub
        const queue = new StubQueue([
            stub(http.get(URL_A), 'a', { times: 1 }),
            stub(http.post(URL_B), 'b'),
        ]);
        serve(queue);

        // When - an unmatched request is reported
        const error = queue.unmatchedError('GET', 'https://unregistered.test/x');

        // Then - method + url + every declared stub with its state
        expect(error.message).toContain(
            'found: an unmatched outgoing request, GET https://unregistered.test/x; declared:',
        );
        expect(error.message).toContain(`- GET ${URL_A} (exhausted after 1)`);
        expect(error.message).toContain(`- POST ${URL_B}`);
    });

    test('stub queue — strict failure message (rule `network-strict-after-first-stub`) — falls back to "no stubs declared" on an empty queue', () => {
        // Given - an empty queue
        const queue = new StubQueue([]);

        // Then - the fallback wording is used
        expect(queue.unmatchedError('GET', URL_A).message).toContain('no stubs declared');
    });

    test('stub queue — required verification — a required stub never requested fails the chain', () => {
        // Given - a stub the spec claims MUST be called
        const queue = new StubQueue([stub(http.get(URL_A), 'a', { required: true })]);

        // Then - the chain-end check names the route and the omission
        const error = queue.requiredError();
        expect(error?.message).toContain(
            `- GET ${URL_A} — declared and required but never requested`,
        );
    });

    test('stub queue — required verification — a required stub that was requested passes', () => {
        // Given - the same stub, actually requested
        const queue = new StubQueue([stub(http.get(URL_A), 'a', { required: true })]);
        serve(queue);

        // Then - nothing to report
        expect(queue.requiredError()).toBeNull();
    });

    test('stub queue — required verification — required with times demands exactly that many requests', () => {
        // Given - a stub required exactly twice, requested once
        const queue = new StubQueue([stub(http.get(URL_A), 'a', { required: true, times: 2 })]);
        serve(queue);

        // Then - the count mismatch is the failure
        expect(queue.requiredError()?.message).toContain(
            'declared required with times: 2 but was requested 1 time(s)',
        );

        serve(queue);
        expect(queue.requiredError()).toBeNull();
    });

    test('stub queue — never verification — a never stub nobody reaches passes, and takes no request it does not match', () => {
        // Given - a route declared never requested, beside one the subject calls
        const queue = new StubQueue([http.never(http.get(URL_B)), stub(http.get(URL_A), 'a')]);
        serve(queue);

        // Then - the chain end has nothing to report
        expect(queue.requiredError()).toBeNull();
    });

    test('stub queue — never verification — a never stub wins its route over a later stub, and the refusal names the route and the call', () => {
        // Given - a never stub declared before a stub that would answer the same request
        const queue = new StubQueue([
            http.never(http.get(URL_A)),
            stub(http.get(URL_A), 'answered'),
        ]);
        const served = queue.take(req({ url: `${URL_A}?page=2` }));

        // Then - the never stub took the call, and the chain end refuses it
        expect(served?.response).toStrictEqual({
            status: 501,
            body: { error: `@jterrazz/test: GET ${URL_A} is declared never requested` },
        });
        expect(queue.requiredError()).toStrictEqual(
            new Error(
                [
                    'found: a route the chain declared never requested was reached:',
                    `  - GET ${URL_A} — reached by GET ${URL_A}?page=2`,
                    'why: A never stub states the subject must not reach its route within the terminal action it is declared for.',
                    'fix: take the call out of the path under test — or, if the call is now intended, replace the never stub with one that answers it',
                    'read: docs/16-stubs.md#never--a-call-that-must-not-happen',
                ].join('\n'),
            ),
        );
    });

    test('stub queue — never verification — the strict refusal lists a never stub as such', () => {
        // Given - a never stub on one route, and a request to another
        const queue = new StubQueue([http.never(http.post(URL_A))]);
        queue.take(req({ url: URL_B }));

        // Then - the declared list says the route is never to be requested
        expect(queue.unmatchedError('GET', URL_B).message).toContain(`- POST ${URL_A} (never)`);
    });
});
