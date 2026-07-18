import { describe, expect, test } from 'vitest';

import { match } from '../matching/match.js';
import { http } from './http.js';
import type { MatchableRequest } from './types.js';

const URL = 'https://api.example.com/things';

function request(overrides: Partial<MatchableRequest> = {}): MatchableRequest {
    return { body: null, headers: {}, url: URL, ...overrides };
}

describe('http — no filter', () => {
    test('leaves match undefined so any URL/method request fires', () => {
        // Given - a bare trigger
        const trigger = http.post(URL);

        // Then - there is no request-level matcher
        expect(trigger.match).toBeUndefined();
    });
});

describe('http — body filter', () => {
    test('object body is a deep SUBSET match; extra keys are ignored', () => {
        // Given - a filter on a nested subset of the body
        const trigger = http.post(URL, { body: { user: { role: 'admin' } } });

        // Then - a superset body matches, a diverging one does not
        expect(
            trigger.match!(request({ body: { extra: 1, user: { id: 7, role: 'admin' } } })),
        ).toBe(true);
        expect(trigger.match!(request({ body: { user: { role: 'guest' } } }))).toBe(false);
    });

    test('object body accepts match.* matchers as leaf values', () => {
        // Given - a subset filter whose leaf is a dynamic matcher
        const trigger = http.post(URL, { body: { id: match.uuid() } });

        // Then - only a well-formed UUID leaf passes
        expect(
            trigger.match!(request({ body: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' } })),
        ).toBe(true);
        expect(trigger.match!(request({ body: { id: 'not-a-uuid' } }))).toBe(false);
    });

    test('string body is a containment test over the raw text body', () => {
        // Given - a substring filter
        const trigger = http.post(URL, { body: 'needle' });

        // Then - raw text containing the needle passes
        expect(trigger.match!(request({ body: 'a haystack with a needle inside' }))).toBe(true);
        expect(trigger.match!(request({ body: 'nothing here' }))).toBe(false);
    });

    test('string body containment also spans a stringified JSON body', () => {
        // Given - a filter that looks for a value serialized in the body
        const trigger = http.post(URL, { body: 'alice' });

        // Then - the JSON body is stringified before the containment test
        expect(trigger.match!(request({ body: { user: 'alice' } }))).toBe(true);
    });

    test('a RegExp body tests the raw text body', () => {
        // Given - a pattern filter
        const trigger = http.post(URL, { body: /order-\d+/ });

        // Then - only a matching body passes
        expect(trigger.match!(request({ body: 'order-42 placed' }))).toBe(true);
        expect(trigger.match!(request({ body: 'order-none' }))).toBe(false);
    });
});

describe('http — header filter', () => {
    test('header names are case-insensitive; string is exact, RegExp tests', () => {
        // Given - a header subset filter mixing string and RegExp
        const trigger = http.get(URL, {
            headers: { Authorization: /^Bearer /, 'X-Env': 'prod' },
        });

        // Then - a superset of headers with the right values matches
        expect(
            trigger.match!(
                request({
                    headers: { authorization: 'Bearer abc', 'x-env': 'prod', 'x-extra': '1' },
                }),
            ),
        ).toBe(true);

        // And - a wrong value or a missing header fails
        expect(
            trigger.match!(request({ headers: { authorization: 'Basic abc', 'x-env': 'prod' } })),
        ).toBe(false);
        expect(trigger.match!(request({ headers: { 'x-env': 'prod' } }))).toBe(false);
    });
});

describe('http — query filter', () => {
    test('matches a subset of URL search params; string exact, RegExp tests', () => {
        // Given - a query subset filter
        const trigger = http.get(URL, { query: { page: /^\d+$/, tag: 'news' } });

        // Then - a URL whose params satisfy the subset matches
        expect(trigger.match!(request({ url: `${URL}?tag=news&page=3&sort=desc` }))).toBe(true);

        // And - a wrong or missing param fails
        expect(trigger.match!(request({ url: `${URL}?tag=sports&page=3` }))).toBe(false);
        expect(trigger.match!(request({ url: `${URL}?page=3` }))).toBe(false);
    });
});

describe('http — combined filter', () => {
    test('every provided facet must match', () => {
        // Given - a filter across body, headers, and query
        const trigger = http.post(URL, {
            body: { action: 'create' },
            headers: { 'content-type': 'application/json' },
            query: { v: '2' },
        });

        // Then - all three must hold
        expect(
            trigger.match!(
                request({
                    body: { action: 'create', payload: {} },
                    headers: { 'content-type': 'application/json' },
                    url: `${URL}?v=2`,
                }),
            ),
        ).toBe(true);

        // And - a single failing facet rejects the request
        expect(
            trigger.match!(
                request({
                    body: { action: 'create' },
                    headers: { 'content-type': 'application/json' },
                    url: `${URL}?v=3`,
                }),
            ),
        ).toBe(false);
    });
});
