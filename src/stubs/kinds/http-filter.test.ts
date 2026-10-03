import { describe, expect, test } from 'vitest';

import { match } from '../../expectations/tokens/match.js';
import type { MatchableRequest } from '../exchange.js';
import { absentHeadersOf, buildMatch } from './http-filter.js';
import type { HttpStubFilter } from './http-filter.js';

const URL = 'https://api.example.com/things';

function request(overrides: Partial<MatchableRequest> = {}): MatchableRequest {
    return { body: null, headers: {}, method: 'POST', url: URL, ...overrides };
}

describe('http-filter', () => {
    test.each([
        {
            filter: { body: { user: { role: 'admin' } } },
            expected: true,
            name: 'an object body is a deep subset match: a superset passes',
            observed: request({ body: { extra: 1, user: { id: 7, role: 'admin' } } }),
        },
        {
            filter: { body: { user: { role: 'admin' } } },
            expected: false,
            name: 'an object body is a deep subset match: a diverging leaf fails',
            observed: request({ body: { user: { role: 'guest' } } }),
        },
        {
            filter: { body: { id: match.uuid() } },
            expected: true,
            name: 'an object body takes match.* leaves: a well-formed uuid passes',
            observed: request({ body: { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' } }),
        },
        {
            filter: { body: { id: match.uuid() } },
            expected: false,
            name: 'an object body takes match.* leaves: a malformed uuid fails',
            observed: request({ body: { id: 'not-a-uuid' } }),
        },
        {
            filter: { body: 'needle' },
            expected: true,
            name: 'a string body is a containment over the raw text',
            observed: request({ body: 'a haystack with a needle inside' }),
        },
        {
            filter: { body: 'needle' },
            expected: false,
            name: 'a string body fails a text without it',
            observed: request({ body: 'nothing here' }),
        },
        {
            filter: { body: 'alice' },
            expected: true,
            name: 'a string body spans a stringified JSON body',
            observed: request({ body: { user: 'alice' } }),
        },
        {
            filter: { body: /order-\d+/u },
            expected: true,
            name: 'a RegExp body tests the raw text: a match passes',
            observed: request({ body: 'order-42 placed' }),
        },
        {
            filter: { body: /order-\d+/u },
            expected: false,
            name: 'a RegExp body tests the raw text: a miss fails',
            observed: request({ body: 'order-none' }),
        },
        {
            filter: { headers: { Authorization: /^Bearer /u, 'X-Env': 'prod' } },
            expected: true,
            name: 'headers are a case-insensitive subset: a superset passes',
            observed: request({
                headers: { authorization: 'Bearer abc', 'x-env': 'prod', 'x-extra': '1' },
            }),
        },
        {
            filter: { headers: { Authorization: /^Bearer /u, 'X-Env': 'prod' } },
            expected: false,
            name: 'headers: a RegExp value the header misses fails',
            observed: request({ headers: { authorization: 'Basic abc', 'x-env': 'prod' } }),
        },
        {
            filter: { headers: { Authorization: /^Bearer /u, 'X-Env': 'prod' } },
            expected: false,
            name: 'headers: an absent header fails',
            observed: request({ headers: { 'x-env': 'prod' } }),
        },
        {
            filter: { query: { page: /^\d+$/u, tag: 'news' } },
            expected: true,
            name: 'the query is a subset of the search params: a superset passes',
            observed: request({ url: `${URL}?tag=news&page=3&sort=desc` }),
        },
        {
            filter: { query: { page: /^\d+$/u, tag: 'news' } },
            expected: false,
            name: 'the query: a different exact value fails',
            observed: request({ url: `${URL}?tag=sports&page=3` }),
        },
        {
            filter: { query: { page: /^\d+$/u, tag: 'news' } },
            expected: false,
            name: 'the query: an absent param fails',
            observed: request({ url: `${URL}?page=3` }),
        },
        {
            filter: { query: { locale: 'fr' } },
            expected: true,
            name: 'the query reads a relative url: a match passes',
            observed: request({ url: '/articles?locale=fr' }),
        },
        {
            filter: { query: { locale: 'fr' } },
            expected: false,
            name: 'the query reads a relative url: a miss fails',
            observed: request({ url: '/articles?locale=en' }),
        },
        {
            filter: {
                body: { action: 'create' },
                headers: { 'content-type': 'application/json' },
                query: { v: '2' },
            },
            expected: true,
            name: 'a combined filter passes when every facet matches',
            observed: request({
                body: { action: 'create', payload: {} },
                headers: { 'content-type': 'application/json' },
                url: `${URL}?v=2`,
            }),
        },
        {
            filter: {
                body: { action: 'create' },
                headers: { 'content-type': 'application/json' },
                query: { v: '2' },
            },
            expected: false,
            name: 'a combined filter fails when one facet misses',
            observed: request({
                body: { action: 'create' },
                headers: { 'content-type': 'application/json' },
                url: `${URL}?v=3`,
            }),
        },
    ] satisfies {
        expected: boolean;
        filter: HttpStubFilter;
        name: string;
        observed: MatchableRequest;
    }[])('buildMatch — buildMatch — $name', ({ expected, filter, observed }) => {
        // Given - a request filter, and a request the subject sent
        // Then - the stub serves it exactly when the filter holds
        expect(buildMatch(filter)?.(observed)).toBe(expected);
    });

    test('http-filter — a string or a RegExp reads the raw text of a body, a value as its JSON, and an absent header never matches', () => {
        // Given - text bodies a JSON reading would quote, a value, and a header pattern that matches any text
        const verdicts = [
            buildMatch({ body: '"hi"' })?.(request({ body: 'say "hi"' })),
            buildMatch({ body: /^say/u })?.(request({ body: 'say it' })),
            buildMatch({ body: '"a":1' })?.(request({ body: { a: 1 } })),
            buildMatch({ headers: { 'x-tag': /.*/u } })?.(request({ headers: {} })),
            buildMatch({ query: { tag: /.*/u } })?.(request({ url: URL })),
        ];

        // Then - each verdict
        expect(verdicts).toStrictEqual([true, true, true, false, false]);
    });

    test('http-filter — absentHeadersOf — none for a filter forbidding nothing, and every contradicted header named', () => {
        // Given - filters without the forbidden list, with an empty one, and contradicting two headers
        const contradicting = {
            headers: { 'X-A': 'a', 'X-B': 'b' },
            without: { headers: ['x-a', 'X-B'] },
        };

        // Then - nothing forbidden, and the refusal naming both
        expect([
            absentHeadersOf(),
            absentHeadersOf({ without: {} }),
            absentHeadersOf({ without: { headers: [] } }),
        ]).toStrictEqual([undefined, undefined, undefined]);
        expect(() => absentHeadersOf(contradicting)).toThrow(
            'found: an http stub filter that both requires and forbids the header(s) x-a, x-b',
        );
    });
});
