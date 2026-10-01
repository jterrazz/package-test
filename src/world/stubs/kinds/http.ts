import { refusal } from '../../../../lint/index.refusal.js';
import { CaptureScope } from '../../../expectations/tokens/match.js';
import { structuralSubset } from '../../../expectations/tokens/structural.js';
import { STREAM_BODY } from '../exchange.js';
import type { MatchableRequest, StreamBody, StubRequest, StubResponse } from '../exchange.js';
import { describeRoute } from '../matching/route.js';
import type { Stub } from '../stub.js';

function wrapJson(data: unknown): StubResponse {
    return { status: 200, body: data };
}

const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
const STREAM_CONTENT_TYPE = 'application/octet-stream';
const SSE_CONTENT_TYPE = 'text/event-stream';

/** Request filters; a request matches when every provided field matches. */
export type HttpStubFilter = {
    /** An object is a deep subset match (leaves may be `match.*`); a string is containment, a RegExp `test()`s the raw body. */
    body?: object | RegExp | string;
    /** Header subset. Names are case-insensitive; string = exact value, RegExp = `test()`. */
    headers?: Record<string, RegExp | string>;
    /** Query-param subset. string = exact value, RegExp = `test()`. */
    query?: Record<string, RegExp | string>;
    without?: { headers?: readonly string[] };
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
    // A multi-line payload is several `data:` lines: a raw newline would end the frame.
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

function matchesBody(body: unknown, expected: NonNullable<HttpStubFilter['body']>): boolean {
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

function buildMatch(filter?: HttpStubFilter): StubRequest['match'] {
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
                params = new URL(request.url, 'http://stub.invalid').searchParams;
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

function absentHeadersOf(filter?: HttpStubFilter): string[] | undefined {
    const absent = filter?.without?.headers?.map((name) => name.toLowerCase()) ?? [];
    if (absent.length === 0) {
        return undefined;
    }
    const required = new Set(Object.keys(filter?.headers ?? {}).map((name) => name.toLowerCase()));
    const contradicted = absent.filter((name) => required.has(name));
    if (contradicted.length > 0) {
        const names = contradicted.join(', ');
        throw new Error(
            refusal({
                fix: `state ${names} in \`headers\` or in \`without.headers\`, never both`,
                found: `an http stub filter that both requires and forbids the header(s) ${names}`,
                read: 'docs/16-stubs.md#http--any-url',
                why: 'A header both required and absent matches no request, so the stub could never fire.',
            }),
        );
    }
    return absent;
}

function declare(method: string, url: RegExp | string, filter?: HttpStubFilter): StubRequest {
    const absentHeaders = absentHeadersOf(filter);
    return {
        ...(absentHeaders && { absentHeaders }),
        adapter: 'http',
        match: buildMatch(filter),
        method,
        url,
        wrap: wrapJson,
    };
}

/** Generic HTTP stub helpers: an absolute URL, or a path form (`/articles/{{uuid}}`) matching any origin. */
export const http = {
    any(url: RegExp | string, filter?: HttpStubFilter): StubRequest {
        return declare('*', url, filter);
    },

    delete(url: RegExp | string, filter?: HttpStubFilter): StubRequest {
        return declare('DELETE', url, filter);
    },

    get(url: RegExp | string, filter?: HttpStubFilter): StubRequest {
        return declare('GET', url, filter);
    },

    patch(url: RegExp | string, filter?: HttpStubFilter): StubRequest {
        return declare('PATCH', url, filter);
    },

    post(url: RegExp | string, filter?: HttpStubFilter): StubRequest {
        return declare('POST', url, filter);
    },

    put(url: RegExp | string, filter?: HttpStubFilter): StubRequest {
        return declare('PUT', url, filter);
    },

    /** A stub the chain fails on if the subject reaches its route: `required` with `times: 0`. */
    never(request: StubRequest): Stub {
        return {
            request,
            required: true,
            response: {
                status: 418,
                body: {
                    error: `@jterrazz/test: ${describeRoute(request)} is declared never requested`,
                },
            },
            times: 0,
        };
    },

    /** Response: a body-less reply (204 by default). */
    empty(status = 204): StubResponse {
        return { status, body: null };
    },

    /** Response: an error status. Without a body, `{ error: 'HTTP <status>' }`. */
    error(status: number, body?: unknown): StubResponse {
        return { status, body: body === undefined ? { error: `HTTP ${status}` } : body };
    },

    /** Response: a JSON body (200 by default). */
    json(body: unknown, init?: HttpResponseInit): StubResponse {
        return {
            status: init?.status ?? 200,
            body,
            delay: init?.delay,
            headers: init?.headers,
        };
    },

    /** Response: no response at all; `fetch` rejects, as when no server is running. */
    unreachable(): StubResponse {
        return { body: null, transport: 'network-error' };
    },

    /** Response: a body that arrives in pieces, written in order. */
    stream(chunks: readonly string[], init?: HttpStreamInit): StubResponse {
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

    /** Response: a server-sent event stream, served as `text/event-stream`. */
    sse(events: readonly SseEvent[], init?: Omit<HttpStreamInit, 'contentType'>): StubResponse {
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
    text(body: string, init?: HttpResponseInit): StubResponse {
        return {
            status: init?.status ?? 200,
            body,
            delay: init?.delay,
            headers: { 'content-type': TEXT_CONTENT_TYPE, ...init?.headers },
        };
    },
};
