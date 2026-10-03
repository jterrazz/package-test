import { pause } from '../../chain/pause.js';
import { isStreamBody } from '../exchange.js';
import type { MatchableRequest, StubResponse } from '../exchange.js';
import { StubQueue } from '../matching/stub-queue.js';
import type { Stub } from '../stub.js';
import { toReadableStream } from './stream-body.js';

/** msw runs one handler shape in node and in a page: what a stub becomes is stated once here. Typed loosely: msw is reached through a lazy import. */

/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- the msw namespace crosses a lazy import: this module IS the boundary that gives it a shape */

/** In a page, a real service worker and HTTP cache could serve an earlier test's answer and never reach the queue. */
const NEVER_CACHED = { 'cache-control': 'no-store' };

function toMswResponse(msw: any, response: StubResponse): unknown {
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

/** An empty stub list is still a guard: the catch-all alone says the subject has no network. `bypass` is the runner's own traffic in a page. */
export function buildStubHandlers(
    msw: any,
    stubs: readonly Stub[],
    bypass?: (url: string) => boolean,
): { handlers: unknown[]; violation: () => Error | null } {
    const queue = new StubQueue(stubs);
    let violation: Error | null = null;

    const recordViolation = (method: string, url: string): unknown => {
        violation ??= queue.unmatchedError(method, url);
        return msw.HttpResponse.json(
            { error: `@jterrazz/test strict stubs: unmatched request ${method} ${url}` },
            { headers: NEVER_CACHED, status: 501 },
        );
    };

    const handlers: unknown[] = [];
    for (const route of queue.routes) {
        for (const method of route.methods) {
            const handlerFn = method === '*' ? msw.http.all : msw.http[method.toLowerCase()];
            if (!handlerFn) {
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
                    if (response.delay) {
                        await pause(response.delay);
                    }
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
            // invariant: not JSON — expose the raw text for string/RegExp filters.
            body = rawText;
        }
    }
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
    });
    return { body, headers, method: request.method.toUpperCase(), url: request.url };
}
