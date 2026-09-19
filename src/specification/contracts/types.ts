/**
 * The observed outgoing request, reduced to what contract matchers inspect.
 * Built once per request by the engine (MSW on api/jobs, the stub backend on
 * website/mobile) and handed to {@link ContractRequest.match} and to a
 * {@link ContractResponder}.
 */
export type MatchableRequest = {
    /** Parsed JSON body when the payload is JSON, the raw text otherwise, or `null` when absent. */
    body: unknown;
    /** Request headers, keyed by lowercased header name. */
    headers: Record<string, string>;
    /** Uppercased HTTP method of the observed request. */
    method: string;
    /** The request URL — fully-qualified, or origin-relative for the stub backend. */
    url: string;
};

/**
 * The request half of a contract: which outgoing call it speaks for.
 *
 * `url` is either an absolute URL (string or RegExp), or a PATH FORM starting
 * with `/` (`/articles/{{uuid}}`) which matches any origin — the shape a
 * website/mobile app's own backend calls take. `{{token}}` segments compare
 * structurally, declared query params are a subset of the observed ones.
 */
export type ContractRequest = {
    /** Adapter name — `http` | `openai` | `anthropic`. */
    adapter: string;
    /** HTTP method to match. `*` matches any method. */
    method: string;
    /** Absolute URL (string | RegExp) or an any-origin path form (`/articles/{{uuid}}`). */
    url: RegExp | string;
    /** Optional request matcher — the contract only fires if this returns true. */
    match?: ((request: MatchableRequest) => boolean) | undefined;
    /** Transform raw data into a provider-specific response envelope. */
    wrap: (data: unknown) => ContractResponse;
};

/**
 * The response half of a contract: what to reply when the request matches.
 */
export type ContractResponse = {
    /** HTTP status code (default: 200). */
    status?: number;
    /**
     * Response body — an object is JSON, a string is text, `null`/`undefined`
     * is empty, and a {@link StreamBody} (built by `http.stream()` /
     * `http.sse()`) arrives in pieces.
     */
    body: unknown;
    /** Response headers. */
    headers?: Record<string, string> | undefined;
    /** Delay in ms before responding (for timeout testing). */
    delay?: number | undefined;
    /**
     * A transport failure instead of a reply: the request never reached a
     * server, so `fetch` rejects. `status`, `body` and `headers` say nothing
     * here — there is no response to carry them.
     *
     * The one thing a status code cannot express. A component's "the server did
     * not answer, check that it is running" branch is reached by a rejected
     * `fetch`, and a 503 stand-in tests the other branch entirely.
     */
    transport?: 'network-error' | undefined;
};

/**
 * The marker that tells a STREAMED body from a value that happens to be an
 * object. A body reaches three different engines (msw's server, msw's worker,
 * the `node:http` stub) and each of them serialises "an object" as JSON, so a
 * stream declared as a plain value arrives as `{}`. The tag is what each
 * engine recognises before it reaches for `JSON.stringify`.
 */
export const STREAM_BODY = '@jterrazz/test:stream';

/**
 * A body that arrives in pieces — what `http.stream()` and `http.sse()` build.
 *
 * The chunks are written in order, `delayBetweenChunks` milliseconds apart,
 * and the connection closes after the last one. It is the chunks and their
 * ORDER that a streaming subject is specified against: a client that renders
 * tokens as they land, or one that reconnects on a half-read body.
 */
export type StreamBody = {
    /** The pieces, written in order. */
    chunks: readonly string[];
    /** The `content-type` the stream is served under. */
    contentType: string;
    /** Milliseconds between two chunks. Default 0 — everything at once. */
    delayBetweenChunks: number;
    kind: typeof STREAM_BODY;
};

/** Is this body a declared stream rather than a value to serialise? */
export function isStreamBody(body: unknown): body is StreamBody {
    return typeof body === 'object' && body !== null && 'kind' in body && body.kind === STREAM_BODY;
}

/**
 * A dynamic response: computed from the observed request at the moment the
 * contract is served, rather than fixed ahead of time. Handed the same
 * {@link MatchableRequest} the request half matched on, so the reply can echo
 * or derive from the body/headers/url.
 */
export type ContractResponder = (request: MatchableRequest) => ContractResponse;

/**
 * What a contract replies with: either a fixed {@link ContractResponse} or a
 * {@link ContractResponder} evaluated per served request.
 */
export type ContractResponseValue = ContractResponder | ContractResponse;
