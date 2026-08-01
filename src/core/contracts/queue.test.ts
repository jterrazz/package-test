import { describe, expect, test } from 'vitest';

import type { Contract } from './contract.js';
import { http } from './http.js';
import { ContractQueue } from './queue.js';
import type { MatchableRequest } from './types.js';

const URL_A = 'https://api.example.com/a';
const URL_B = 'https://api.example.com/b';

/** An observed request — method defaults to GET, body/headers to empty. */
function req(overrides: Partial<MatchableRequest> = {}): MatchableRequest {
    return { body: null, headers: {}, method: 'GET', url: URL_A, ...overrides };
}

function contract(
    request: Contract['request'],
    tag: string,
    extra: Partial<Contract> = {},
): Contract {
    return { request, response: http.json({ tag }), ...extra };
}

/** Serve one observed request and report which contract answered (or null). */
function serve(queue: ContractQueue, overrides: Partial<MatchableRequest> = {}): null | string {
    const served = queue.take(req(overrides));
    if (!served) {
        return null;
    }
    return (served.response as { body: { tag: string } }).body.tag;
}

describe('contract queue — selection', () => {
    test('the first matching contract wins and, without times, keeps serving', () => {
        // Given - two contracts on the same route
        const queue = new ContractQueue([
            contract(http.get(URL_A), 'first'),
            contract(http.get(URL_A), 'second'),
        ]);

        // Then - the first one answers every request (no times = unlimited:
        // A re-render or a retry replays it instead of falling through)
        expect(serve(queue)).toBe('first');
        expect(serve(queue)).toBe('first');
    });

    test('times exhausts a contract, and the next matching one takes over', () => {
        // Given - a finite error sequence before an unlimited success tail
        const queue = new ContractQueue([
            contract(http.get(URL_A), 'error', { times: 2 }),
            contract(http.get(URL_A), 'ok'),
        ]);

        // Then - the sequence plays out, then the tail stays
        expect(serve(queue)).toBe('error');
        expect(serve(queue)).toBe('error');
        expect(serve(queue)).toBe('ok');
        expect(serve(queue)).toBe('ok');
    });

    test('an exhausted queue yields null — the strict violation signal', () => {
        // Given - one contract allowed exactly once
        const queue = new ContractQueue([contract(http.get(URL_A), 'once', { times: 1 })]);

        // Then - the second request matches nothing left
        expect(serve(queue)).toBe('once');
        expect(serve(queue)).toBeNull();
    });

    test('method and url both gate the match; * matches any method', () => {
        // Given - a GET on A and a wildcard on B
        const queue = new ContractQueue([
            contract(http.get(URL_A), 'get-a'),
            contract(http.any(URL_B), 'any-b'),
        ]);

        // Then - a mismatched method or url selects nothing
        expect(serve(queue, { method: 'POST' })).toBeNull();
        expect(serve(queue, { method: 'DELETE', url: URL_B })).toBe('any-b');
        expect(serve(queue)).toBe('get-a');
    });

    test('a body filter routes two contracts sharing one url', () => {
        // Given - two contracts on one url routed by body content
        const queue = new ContractQueue([
            contract(http.post(URL_A, { body: { user: 'alice' } }), 'alice'),
            contract(http.post(URL_A, { body: { user: 'bob' } }), 'bob'),
        ]);

        // Then - the body picks the contract, whatever the declaration order
        expect(serve(queue, { body: { user: 'bob' }, method: 'POST' })).toBe('bob');
        expect(serve(queue, { body: { user: 'alice' }, method: 'POST' })).toBe('alice');
        expect(serve(queue, { body: { user: 'carol' }, method: 'POST' })).toBeNull();
    });
});

describe('contract queue — url forms', () => {
    test('a path-form url matches any origin, tokens structural, query a subset', () => {
        // Given - a path-form contract with a token segment and a query param
        const queue = new ContractQueue([
            contract(http.get('/articles/{{uuid}}?locale=fr'), 'article'),
        ]);

        const article = 'https://app.test/articles/3f2504e0-4f89-41d3-9a0c-0305e82c3301';

        // Then - any origin matches, extra query params are ignored
        expect(serve(queue, { url: `${article}?locale=fr&page=2` })).toBe('article');

        // And - a non-uuid segment or a missing declared param does not
        expect(serve(queue, { url: 'https://app.test/articles/nope?locale=fr' })).toBeNull();
        expect(serve(queue, { url: article })).toBeNull();
    });

    test('a relative observed url (the stub backend) matches a path-form contract', () => {
        // Given - the stub backend sees `/events?x=1`, not a full URL
        const queue = new ContractQueue([contract(http.get('/events'), 'events')]);

        // Then - it matches, and the declared query stays a subset constraint
        expect(serve(queue, { url: '/events?x=1' })).toBe('events');
    });

    test('an absolute url matches on origin+pathname, ignoring extra query', () => {
        // Given - an absolute contract url with no query of its own
        const queue = new ContractQueue([contract(http.get(URL_A), 'a')]);

        // Then - the app may append its own params
        expect(serve(queue, { url: `${URL_A}?lang=en` })).toBe('a');
        expect(serve(queue, { url: URL_B })).toBeNull();
    });

    test('a RegExp url tests the full observed url', () => {
        // Given - a pattern contract
        const queue = new ContractQueue([contract(http.get(/example\.com\/a/), 're')]);

        // Then - it matches by pattern, and shares one route with its twin
        expect(serve(queue)).toBe('re');
        expect(queue.routes).toHaveLength(1);
    });

    test('routes dedupe by pattern and collect their methods', () => {
        // Given - two methods on one path-form url plus another route
        const queue = new ContractQueue([
            contract(http.get('/events'), 'get'),
            contract(http.post('/events'), 'post'),
            contract(http.get(URL_A), 'a'),
        ]);

        // Then - one route per pattern, carrying every declared method
        expect(queue.routes).toHaveLength(2);
        expect(queue.routes[0].methods).toEqual(['GET', 'POST']);
        expect(queue.routes[1].url).toBe(URL_A);
    });
});

describe('contract queue — strict failure message (CONVENTIONS D7)', () => {
    test('names the offending request and lists contracts with their state', () => {
        // Given - a queue with one exhausted and one untouched contract
        const queue = new ContractQueue([
            contract(http.get(URL_A), 'a', { times: 1 }),
            contract(http.post(URL_B), 'b'),
        ]);
        serve(queue);

        // When - an unmatched request is reported
        const error = queue.unmatchedError('GET', 'https://unregistered.test/x');

        // Then - method + url + every declared contract with its state
        expect(error.message).toContain(
            'Unmatched outgoing HTTP request during spec: GET https://unregistered.test/x',
        );
        expect(error.message).toContain(`- GET ${URL_A} (exhausted after 1)`);
        expect(error.message).toContain(`- POST ${URL_B}`);
    });

    test('falls back to "no contracts declared" on an empty queue', () => {
        // Given - an empty queue
        const queue = new ContractQueue([]);

        // Then - the fallback wording is used
        expect(queue.unmatchedError('GET', URL_A).message).toContain('no contracts declared');
    });
});

describe('contract queue — required verification', () => {
    test('a required contract never requested fails the chain', () => {
        // Given - a contract the spec claims MUST be called
        const queue = new ContractQueue([contract(http.get(URL_A), 'a', { required: true })]);

        // Then - the chain-end check names the route and the omission
        const error = queue.requiredError();
        expect(error?.message).toContain(
            `- GET ${URL_A} — declared and required but never requested`,
        );
    });

    test('a required contract that was requested passes', () => {
        // Given - the same contract, actually requested
        const queue = new ContractQueue([contract(http.get(URL_A), 'a', { required: true })]);
        serve(queue);

        // Then - nothing to report
        expect(queue.requiredError()).toBeNull();
    });

    test('required with times demands exactly that many requests', () => {
        // Given - a contract required exactly twice, requested once
        const queue = new ContractQueue([
            contract(http.get(URL_A), 'a', { required: true, times: 2 }),
        ]);
        serve(queue);

        // Then - the count mismatch is the failure
        expect(queue.requiredError()?.message).toContain(
            'declared required with times: 2 but was requested 1 time(s)',
        );

        // And - the second request satisfies it
        serve(queue);
        expect(queue.requiredError()).toBeNull();
    });
});
