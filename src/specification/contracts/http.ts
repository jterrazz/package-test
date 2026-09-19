import { CaptureScope } from '../matching/match.js';
import { structuralSubset } from '../matching/structural.js';
import { STREAM_BODY } from './types.js';
import type { ContractRequest, ContractResponse, MatchableRequest, StreamBody } from './types.js';

function wrapJson(data: unknown): ContractResponse {
    return { status: 200, body: data };
}

const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
const STREAM_CONTENT_TYPE = 'application/octet-stream';
const SSE_CONTENT_TYPE = 'text/event-stream';

/**
 * Request filters for the generic HTTP provider. Every field is a subset
 * constraint — a request matches when all provided fields match.
 */
export type HttpContractFilter = {
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
};

/** Init options for a streamed reply. */
export type HttpStreamInit = {
    /** The `content-type` the stream is served under. Default `application/octet-stream`. */
    contentType?: string;
    /** Milliseconds between two chunks. Default 0 — every chunk at once. */
    delay?: number;
    /** Response headers, merged over the builder's own. */
    headers?: Record<string, string>;
    /** HTTP status code. Default 200. */
    status?: number;
};

/** One server-sent event, as `http.sse()` frames it. */
export type SseEvent = {
    /** The `data:` payload. An object is serialised as JSON; a string is sent as-is. */
    data: unknown;
    /** The `event:` name. Omitted for an unnamed (default `message`) event. */
    event?: string;
    /** The `id:` the client echoes as `Last-Event-ID` when it reconnects. */
    id?: string;
    /** The `retry:` hint, in milliseconds. */
    retry?: number;
};

/** The wire form of one event — the frame an `EventSource` parses. */
function frameEvent(event: SseEvent): string {
    const lines: string[] = [];
    if (event.event !== undefined) {
        lines.push(`event: ${event.event}`);
    }
    if (event.id !== undefined) {
        lines.push(`id: ${event.id}`);
    }
    if (event.retry !== undefined) {
        lines.push(`retry: ${event.retry}`);
    }
    const payload = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
    // A multi-line payload is several `data:` lines: the parser joins them
    // With newlines, and a raw newline inside one would end the frame.
    for (const line of payload.split('\n')) {
        lines.push(`data: ${line}`);
    }
    return `${lines.join('\n')}\n\n`;
}

/** Init options shared by the response builders. */
export type HttpResponseInit = {
    /** Delay in ms before responding (for timeout testing). */
    delay?: number;
    /** Response headers, merged over the builder's own. */
    headers?: Record<string, string>;
    /** HTTP status code. */
    status?: number;
};

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

    /**
     * Response: no response at all — the request fails in transport, the way a
     * server that is not running fails it. `fetch` rejects; no status is served.
     */
    unreachable(): ContractResponse {
        return { body: null, transport: 'network-error' };
    },

    /**
     * Response: a body that arrives in PIECES, written in order.
     *
     * A subject that reads a response as it lands — a token-by-token render, a
     * progress bar, a reconnect on a half-read body — is specified by the
     * chunks and their order, which a single serialised body cannot state.
     * Honoured by all three engines: msw's server, msw's worker, and the
     * `node:http` stub the website and mobile facets serve from.
     *
     * @example
     *   http.stream(['Hel', 'lo, ', 'world'], { contentType: 'text/plain', delay: 10 })
     */
    stream(chunks: readonly string[], init?: HttpStreamInit): ContractResponse {
        return {
            status: init?.status ?? 200,
            body: {
                chunks: [...chunks],
                contentType: init?.contentType ?? STREAM_CONTENT_TYPE,
                delayBetweenChunks: init?.delay ?? 0,
                kind: STREAM_BODY,
            } satisfies StreamBody,
            headers: init?.headers,
        };
    },

    /**
     * Response: a server-sent event stream — one chunk per event, framed the
     * way an `EventSource` reads them, served as `text/event-stream`.
     *
     * @example
     *   http.sse([{ data: { token: 'Hel' } }, { data: { token: 'lo' } }, { event: 'done', data: '' }])
     */
    sse(events: readonly SseEvent[], init?: Omit<HttpStreamInit, 'contentType'>): ContractResponse {
        return {
            status: init?.status ?? 200,
            body: {
                chunks: events.map(frameEvent),
                contentType: SSE_CONTENT_TYPE,
                delayBetweenChunks: init?.delay ?? 0,
                kind: STREAM_BODY,
            } satisfies StreamBody,
            headers: { 'cache-control': 'no-cache', ...init?.headers },
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
