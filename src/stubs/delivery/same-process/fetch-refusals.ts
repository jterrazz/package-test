const PROBE = 'http://request-init.invalid/';

// invariant: a streamed body stands in as an empty blob, so the probe never locks the stream the call still sends.
const probeOf = (init: RequestInit): RequestInit =>
    init.body instanceof ReadableStream ? { ...init, body: new Blob() } : init;

/**
 * Wraps `underlying` so a RequestInit that fetch itself refuses rejects with fetch's own TypeError, before any stub can serve it.
 * @see https://fetch.spec.whatwg.org/#dom-request
 */
export function refusingWhatFetchRefuses(underlying: typeof fetch): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (init === undefined) {
            return await underlying(input);
        }
        // outside: msw builds its request with `init.method || 'GET'` and serves an empty method, TRACE, or a GET with a body, all of which undici refuses.
        const { method } = new Request(PROBE, probeOf(init));
        return await underlying(input, { ...init, method });
    };
}
