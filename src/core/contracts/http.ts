import { CaptureScope } from '../matching/match.js';
import { structuralSubset } from '../matching/structural.js';
import type { ContractRequest, ContractResponse, MatchableRequest } from './types.js';

function wrapJson(data: unknown): ContractResponse {
    return { status: 200, body: data };
}

const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

/**
 * Request filters for the generic HTTP provider. Every field is a subset
 * constraint — a request matches when all provided fields match.
 */
export interface HttpContractFilter {
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

/** Init options shared by the response builders. */
export interface HttpResponseInit {
    /** Delay in ms before responding (for timeout testing). */
    delay?: number;
    /** Response headers, merged over the builder's own. */
    headers?: Record<string, string>;
    /** HTTP status code. */
    status?: number;
}

function matchesBody(body: unknown, expected: NonNullable<HttpContractFilter['body']>): boolean {
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
 * Build the `match` predicate for an HTTP request filter, or `undefined` when
 * no filter is supplied (fires on any URL/method match).
 */
function buildMatch(filter?: HttpContractFilter): ContractRequest['match'] {
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
                params = new URL(request.url, 'http://contract.invalid').searchParams;
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

function declare(
    method: string,
    url: RegExp | string,
    filter?: HttpContractFilter,
): ContractRequest {
    return { adapter: 'http', match: buildMatch(filter), method, url, wrap: wrapJson };
}

/**
 * Generic HTTP contract helpers for any URL. The url is absolute (string or
 * RegExp), or a PATH FORM starting with `/` — `http.get('/articles/{{uuid}}')`
 * matches that path on ANY origin, which is what an app calling its own
 * backend needs. An optional {@link HttpContractFilter} narrows matching by
 * body, headers, or query — a request that hits the URL/method but fails the
 * filter counts as unmatched (strict contracts, CONVENTIONS D7).
 *
 * @example
 *   defineContract({ request: http.get('/articles/{{uuid}}'), response: http.json(article) })
 *   defineContract({ request: http.post(URL, { body: { user: 'alice' } }), response: http.empty() })
 */
export const http = {
    any(url: RegExp | string, filter?: HttpContractFilter): ContractRequest {
        return declare('*', url, filter);
    },

    delete(url: RegExp | string, filter?: HttpContractFilter): ContractRequest {
        return declare('DELETE', url, filter);
    },

    get(url: RegExp | string, filter?: HttpContractFilter): ContractRequest {
        return declare('GET', url, filter);
    },

    patch(url: RegExp | string, filter?: HttpContractFilter): ContractRequest {
        return declare('PATCH', url, filter);
    },

    post(url: RegExp | string, filter?: HttpContractFilter): ContractRequest {
        return declare('POST', url, filter);
    },

    put(url: RegExp | string, filter?: HttpContractFilter): ContractRequest {
        return declare('PUT', url, filter);
    },

    /** Response: a body-less reply (204 by default). */
    empty(status = 204): ContractResponse {
        return { status, body: null };
    },

    /** Response: an error status. Without a body, `{ error: 'HTTP <status>' }`. */
    error(status: number, body?: unknown): ContractResponse {
        return { status, body: body === undefined ? { error: `HTTP ${status}` } : body };
    },

    /** Response: a JSON body (200 by default). */
    json(body: unknown, init?: HttpResponseInit): ContractResponse {
        return {
            status: init?.status ?? 200,
            body,
            delay: init?.delay,
            headers: init?.headers,
        };
    },

    /** Response: a text body, served as `text/plain` (200 by default). */
    text(body: string, init?: HttpResponseInit): ContractResponse {
        return {
            status: init?.status ?? 200,
            body,
            delay: init?.delay,
            headers: { 'content-type': TEXT_CONTENT_TYPE, ...init?.headers },
        };
    },
};
