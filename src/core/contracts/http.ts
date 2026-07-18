import { CaptureScope } from '../matching/match.js';
import { structuralSubset } from '../matching/structural.js';
import type { InterceptResponse, InterceptTrigger, MatchableRequest } from './types.js';

function wrapJson(data: unknown): InterceptResponse {
    return { status: 200, body: data };
}

/**
 * Request filters for the generic HTTP provider. Every field is a subset
 * constraint — a request matches when all provided fields match.
 */
export interface HttpInterceptFilter {
    /**
     * Body constraint. An object is a deep SUBSET match (toMatchObject-style)
     * whose leaf values may be `match.*` matchers; a string is a containment
     * test and a RegExp a `test()` over the raw text body.
     */
    body?: object | RegExp | string;
    /** Header subset. Names are case-insensitive; string = exact value, RegExp = `test()`. */
    headers?: Record<string, RegExp | string>;
    /** Query-param subset. string = exact value, RegExp = `test()`. */
    query?: Record<string, RegExp | string>;
}

function matchesBody(body: unknown, expected: NonNullable<HttpInterceptFilter['body']>): boolean {
    if (typeof expected === 'string') {
        const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
        return text.includes(expected);
    }
    if (expected instanceof RegExp) {
        const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
        return expected.test(text);
    }
    return structuralSubset(expected, body, new CaptureScope());
}

function matchesEntries(
    expected: Record<string, RegExp | string>,
    lookup: (key: string) => string | undefined,
): boolean {
    return Object.entries(expected).every(([key, value]) => {
        const actual = lookup(key);
        if (actual === undefined) {
            return false;
        }
        return value instanceof RegExp ? value.test(actual) : actual === value;
    });
}

/**
 * Build the `match` predicate for an HTTP trigger filter, or `undefined` when
 * no filter is supplied (fires on any URL/method match).
 */
function buildMatch(filter?: HttpInterceptFilter): InterceptTrigger['match'] {
    if (!filter) {
        return undefined;
    }
    return (request: MatchableRequest): boolean => {
        if (filter.body !== undefined && !matchesBody(request.body, filter.body)) {
            return false;
        }
        if (
            filter.headers &&
            !matchesEntries(filter.headers, (key) => request.headers[key.toLowerCase()])
        ) {
            return false;
        }
        if (filter.query) {
            let params: URLSearchParams;
            try {
                params = new URL(request.url).searchParams;
            } catch {
                return false;
            }
            if (!matchesEntries(filter.query, (key) => params.get(key) ?? undefined)) {
                return false;
            }
        }
        return true;
    };
}

/**
 * Generic HTTP intercept helpers for any URL. An optional {@link
 * HttpInterceptFilter} narrows matching by request body, headers, or query —
 * a request that hits the URL/method but fails the filter counts as unmatched
 * (strict intercepts, CONVENTIONS D7).
 *
 * @example
 *   .intercept(http.get('https://api.example.com/data'), 'http/response.json')
 *   .intercept(http.post(URL, { body: { user: 'alice' } }), http.json({ ok: true }))
 */
export const http = {
    get(url: RegExp | string, filter?: HttpInterceptFilter): InterceptTrigger {
        return { adapter: 'http', match: buildMatch(filter), method: 'GET', url, wrap: wrapJson };
    },

    post(url: RegExp | string, filter?: HttpInterceptFilter): InterceptTrigger {
        return { adapter: 'http', match: buildMatch(filter), method: 'POST', url, wrap: wrapJson };
    },

    put(url: RegExp | string, filter?: HttpInterceptFilter): InterceptTrigger {
        return { adapter: 'http', match: buildMatch(filter), method: 'PUT', url, wrap: wrapJson };
    },

    delete(url: RegExp | string, filter?: HttpInterceptFilter): InterceptTrigger {
        return {
            adapter: 'http',
            match: buildMatch(filter),
            method: 'DELETE',
            url,
            wrap: wrapJson,
        };
    },

    any(url: RegExp | string, filter?: HttpInterceptFilter): InterceptTrigger {
        return { adapter: 'http', match: buildMatch(filter), method: '*', url, wrap: wrapJson };
    },

    /** Response: simple JSON success. */
    json(data: unknown, status = 200): InterceptResponse {
        return { status, body: data };
    },

    /** Response: error with message. */
    error(status: number, message?: string): InterceptResponse {
        return { status, body: { error: message ?? `HTTP ${status}` } };
    },
};
