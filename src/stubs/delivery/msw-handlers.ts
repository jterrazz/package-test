import type { http, HttpHandler, HttpResponse, passthrough } from 'msw';

import { pause } from '../../chain/pause.js';
import { isStreamBody } from '../exchange.js';
import type { MatchableRequest, StubResponse } from '../exchange.js';
import { StubQueue } from '../matching/stub-queue.js';
import type { Stub } from '../stub.js';
import { toReadableStream } from './stream-body.js';

/** The msw a stub is built with, reached through a lazy import: node and a page load their own. */
export type Msw = {
    readonly http: typeof http;
    readonly HttpResponse: typeof HttpResponse;
    readonly passthrough: typeof passthrough;
};

// invariant: in a page, a real service worker and HTTP cache could serve an earlier test's answer and never reach the queue.
const NEVER_CACHED = { 'cache-control': 'no-store' };

function toMswResponse(msw: Msw, response: StubResponse): Response {
    const { body, headers, status = 200 } = response;
    if (response.transport === 'network-error') {
        // outside: not a reply: the request fails in transport, as `fetch` sees when nothing listens.
        return msw.HttpResponse.error();
    }
    if (body === null || body === undefined) {
        return new msw.HttpResponse(null, { headers: { ...NEVER_CACHED, ...headers }, status });
    }
    if (isStreamBody(body)) {
        // invariant: a stream is the one body not serialised: the pieces and their order are what the subject reads.
        return new msw.HttpResponse(toReadableStream(body), {
            headers: { ...NEVER_CACHED, 'content-type': body.contentType, ...headers },
            status,
        });
    }
    if (typeof body === 'string') {
        return new msw.HttpResponse(body, {
            headers: { ...NEVER_CACHED, 'content-type': 'text/plain; charset=utf-8', ...headers },
            status,
        });
    }
    return msw.HttpResponse.json(body, { headers: { ...NEVER_CACHED, ...headers }, status });
}

// invariant: an empty stub list is still a guard: the catch-all alone says the subject has no network. `bypass` is the runner's own traffic in a page.
function handlerOf(msw: Msw, method: string): typeof http.all | undefined {
    const handlers: Readonly<Record<string, typeof http.all>> = {
        '*': msw.http.all,
        DELETE: msw.http.delete,
        GET: msw.http.get,
        HEAD: msw.http.head,
        OPTIONS: msw.http.options,
        PATCH: msw.http.patch,
        POST: msw.http.post,
        PUT: msw.http.put,
    };
    return handlers[method.toUpperCase()];
}

export function buildStubHandlers(
    msw: Msw,
    stubs: readonly Stub[],
    bypass?: (url: string) => boolean,
): { handlers: HttpHandler[]; violation: () => Error | null } {
    const queue = new StubQueue(stubs);
    let violation: Error | null = null;

    const recordViolation = (method: string, url: string): Response => {
        violation ??= queue.unmatchedError(method, url);
        return msw.HttpResponse.json(
            { error: `@jterrazz/test strict stubs: unmatched request ${method} ${url}` },
            { headers: NEVER_CACHED, status: 501 },
        );
    };

    const handlers: HttpHandler[] = [];
    for (const route of queue.routes) {
        for (const method of route.methods) {
            const handlerFn = handlerOf(msw, method);
            if (handlerFn === undefined) {
                continue;
            }
            handlers.push(
                handlerFn(route.url, async ({ request }: { request: Request }) => {
                    const observed = await observe(request);
                    const stub = queue.take(observed);
                    if (!stub) {
                        // invariant: nothing matches, or everything that matches is spent (`network-strict-after-first-stub`).
                        return recordViolation(request.method, request.url);
                    }
                    const response =
                        typeof stub.response === 'function'
                            ? stub.response(observed)
                            : stub.response;
                    await pause(response.delay ?? 0);
                    return toMswResponse(msw, response);
                }),
            );
        }
    }

    // invariant: catch-all last: handlers of one `use()` match in order. `bypass` spares the runner's own module requests, which a 501 would stop.
    handlers.push(
        msw.http.all('*', ({ request }: { request: Request }) =>
            bypass?.(request.url) === true
                ? msw.passthrough()
                : recordViolation(request.method, request.url),
        ),
    );

    return { handlers, violation: () => queue.verdict(violation) };
}

async function observe(request: Request): Promise<MatchableRequest> {
    let body: unknown = null;
    const rawText = await request.clone().text();
    if (rawText) {
        try {
            body = JSON.parse(rawText);
        } catch {
            // invariant: not JSON; expose the raw text for string/RegExp filters.
            body = rawText;
        }
    }
    return {
        body,
        headers: Object.fromEntries(request.headers),
        method: request.method.toUpperCase(),
        url: request.url,
    };
}
