import { describe, expect, test } from 'vitest';

import type { MatchableRequest } from '../exchange.js';
import { http } from '../kinds/http.js';
import type { Stub } from '../stub.js';
import { StubQueue } from './stub-queue.js';

const URL_A = 'https://api.example.com/a';
const URL_B = 'https://api.example.com/b';
const URL_C = 'https://api.example.com/c';
const PATTERN_D = /example\.com\/d/u;

function req(overrides: Partial<MatchableRequest> = {}): MatchableRequest {
    return { body: null, headers: {}, method: 'GET', url: URL_A, ...overrides };
}

function stub(request: Stub['request'], tag: string, extra: Partial<Stub> = {}): Stub {
    return { request, response: http.json({ tag }), ...extra };
}

function tagOf(response: unknown): null | string {
    const body: unknown =
        typeof response === 'object' && response !== null && 'body' in response
            ? response.body
            : null;
    return typeof body === 'object' &&
        body !== null &&
        'tag' in body &&
        typeof body.tag === 'string'
        ? body.tag
        : null;
}

function serve(queue: StubQueue, overrides: Partial<MatchableRequest> = {}): null | string {
    const served = queue.take(req(overrides));
    if (!served) {
        return null;
    }
    return tagOf(served.response);
}

const verdictOf = (stubs: Stub[], requests: number): null | string => {
    const queue = new StubQueue(stubs);
    for (let count = 0; count < requests; count += 1) {
        queue.take(req());
    }
    return queue.verdict()?.message ?? null;
};

const unmet = (line: string): string =>
    [
        'found: required stub(s) never satisfied during the chain:',
        line,
        'why: A required stub states the call MUST happen, within the terminal action it is declared for.',
        'fix: the code no longer makes the call, or the stub no longer describes it: correct the one that drifted',
        'read: docs/reference/stubs.md#required-is-verified-per-terminal-action',
    ].join('\n');

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

    test('stub queue — selection — a hand-built request states its absent headers in any case', () => {
        // Given - a stub request written without the http builder, its absent header capitalised
        const queue = new StubQueue([
            stub({ ...http.get(URL_A), absentHeaders: ['Cookie'] }, 'anonymous'),
        ]);

        // Then - the observed lowercased header still keeps the stub from firing
        expect(serve(queue, { headers: { cookie: 'session=1' } })).toBeNull();
        expect(serve(queue)).toBe('anonymous');
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
            stub(http.get('/events'), 'again'),
            stub(http.get(URL_A), 'a'),
        ]);

        // Then - one route per pattern, carrying every declared method
        expect(queue.routes).toHaveLength(2);
        expect(queue.routes[0]?.methods).toStrictEqual(['GET', 'POST']);
        expect(queue.routes[1]?.url).toBe(URL_A);
    });

    test('stub queue — strict failure message (rule `network-strict-after-first-stub`) — names the request and lists every declared stub with its state, or none', () => {
        // Given - never stubs reached and not, a stub exhausted, one served twice, one untouched, one on any method, and headers stated absent
        const queue = new StubQueue([
            http.never(http.get(URL_A)),
            http.never(http.post(URL_A)),
            stub(http.get(URL_B), 'once', { times: 1 }),
            stub(http.put(URL_B), 'twice'),
            stub(http.delete(URL_B), 'untouched'),
            stub(http.patch(URL_B), 'spent', { times: 0 }),
            stub({ ...http.get(URL_C), method: '*' }, 'any'),
            stub(http.get(URL_C, { without: { headers: ['cookie'] } }), 'anonymous'),
            stub(
                http.get(PATTERN_D, { without: { headers: ['cookie', 'authorization'] } }),
                'bare',
            ),
        ]);
        for (const request of [
            req(),
            req(),
            req({ url: URL_B }),
            req({ method: 'PUT', url: URL_B }),
            req({ method: 'PUT', url: URL_B }),
        ]) {
            queue.take(request);
        }

        // Then - the whole refusal, and the one of a queue declaring nothing
        expect([
            queue.unmatchedError('GET', 'https://unregistered.test/x').message,
            new StubQueue([]).unmatchedError('GET', URL_A).message.split('\n').slice(0, 2),
        ]).toStrictEqual([
            [
                'found: an unmatched outgoing request, GET https://unregistered.test/x; declared:',
                `  - GET ${URL_A} (never, reached 2 time(s))`,
                `  - POST ${URL_A} (never)`,
                `  - GET ${URL_B} (exhausted after 1)`,
                `  - PUT ${URL_B} (served 2 time(s))`,
                `  - DELETE ${URL_B}`,
                `  - PATCH ${URL_B} (exhausted after 0)`,
                `  - ANY ${URL_C}`,
                `  - GET ${URL_C} (without header cookie)`,
                `  - GET ${String(PATTERN_D)} (without headers cookie, authorization)`,
                'why: From its first stub, a chain’s network is strict: every outgoing request matches a declared stub.',
                'fix: declare a stub for GET https://unregistered.test/x — or raise the `times` of the one it exhausted',
                'read: docs/reference/linting.md#network-strict-after-first-stub',
            ].join('\n'),
            [
                `found: an unmatched outgoing request, GET ${URL_A}; declared:`,
                '  (no stubs declared)',
            ],
        ]);
    });

    test('stub queue — required verification — a required stub must be requested, exactly its times when it states them', () => {
        // Given - required stubs requested enough, never, and once of twice
        const required = stub(http.get(URL_A), 'a', { required: true });
        const twice = stub(http.get(URL_A), 'a', { required: true, times: 2 });

        // Then - nothing when met, the omission or the count otherwise
        expect([
            verdictOf([required], 1),
            verdictOf([required], 0),
            verdictOf([twice], 1),
            verdictOf([twice], 2),
        ]).toStrictEqual([
            null,
            unmet(`  - GET ${URL_A} — declared and required but never requested`),
            unmet(`  - GET ${URL_A} — declared required with times: 2 but was requested 1 time(s)`),
            null,
        ]);
    });

    test('stub queue — never verification — a never stub nobody reaches passes; one reached wins its route and is reported first, beside the unmatched request and the unmet stub', () => {
        // Given - an unreached never stub, then a never stub declared before a stub answering its route, and a required stub nobody calls
        const quiet = new StubQueue([http.never(http.get(URL_B)), stub(http.get(URL_A), 'a')]);
        quiet.take(req());
        const queue = new StubQueue([
            http.never(http.get(URL_A)),
            http.never(http.delete(URL_A)),
            stub(http.get(URL_A), 'answered'),
            stub(http.get(URL_B), 'b', { required: true }),
            stub(http.post(URL_B), 'b', { required: true }),
        ]);
        const served = queue.take(req({ url: `${URL_A}?page=2` }));
        queue.take(req());
        queue.take(req({ method: 'DELETE' }));
        const verdict = queue.verdict(new Error('unmatched GET https://api.example.com/x'));

        // Then - the never stub took the call, and all three refusals come in one, the never breach first
        expect([quiet.verdict(), served?.response, verdict?.message]).toStrictEqual([
            null,
            {
                status: 418,
                body: { error: `@jterrazz/test: GET ${URL_A} is declared never requested` },
            },
            [
                'found: 3 outcomes of one action, each with its own refusal:',
                '',
                'found: a route the chain declared never requested was reached:',
                `  - GET ${URL_A} — reached by GET ${URL_A}?page=2, GET ${URL_A}`,
                `  - DELETE ${URL_A} — reached by DELETE ${URL_A}`,
                "why: A never stub states the subject must not reach its route within the chain's terminal action, or the `intercept()` scope, it is declared for.",
                'fix: take the call out of the path under test — or, if the call is now intended, replace the never stub with one that answers it',
                'read: docs/reference/stubs.md#never--a-call-that-must-not-happen',
                '',
                'unmatched GET https://api.example.com/x',
                '',
                'found: required stub(s) never satisfied during the chain:',
                `  - GET ${URL_B} — declared and required but never requested`,
                `  - POST ${URL_B} — declared and required but never requested`,
                'why: A required stub states the call MUST happen, within the terminal action it is declared for.',
                'fix: the code no longer makes the call, or the stub no longer describes it: correct the one that drifted',
                'read: docs/reference/stubs.md#required-is-verified-per-terminal-action',
                'why: A reached never stub, an unmatched request and an unmet required stub are independent facts about one action, so all are reported at once.',
                'fix: correct each outcome in turn, by its own fix',
                'read: docs/reference/stubs.md#strict-by-construction',
            ].join('\n'),
        ]);
    });
});
