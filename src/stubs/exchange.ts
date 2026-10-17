/** An observed outgoing request, reduced to what stub matchers inspect. */
export type MatchableRequest = {
    /** Parsed JSON body when the payload is JSON, the raw text otherwise, or `null` when absent. */
    body: unknown;
    /** Request headers, keyed by lowercased header name. */
    headers: Record<string, string>;
    /** Uppercased HTTP method of the observed request. */
    method: string;
    /** The request URL: fully-qualified, or origin-relative for the stub backend. */
    url: string;
};

/** The request half of a stub: an absolute URL, or a path form (`/articles/{{uuid}}`) matching any origin. */
export type StubRequest = {
    /** Adapter name: `http` | `openai` | `anthropic`. */
    adapter: string;
    /** HTTP method to match. `*` matches any method. */
    method: string;
    /** Absolute URL (string | RegExp) or an any-origin path form (`/articles/{{uuid}}`). */
    url: RegExp | string;
    /** Optional request matcher; the stub only fires if this returns true. */
    match?: ((request: MatchableRequest) => boolean) | undefined;
    /** Header names, case-insensitive, whose presence keeps the stub from firing; `http.*` writes them from `without.headers`. */
    absentHeaders?: readonly string[] | undefined;
    /** Transform raw data into a provider-specific response envelope. */
    wrap: (data: unknown) => StubResponse;
};

/** The response half of a stub. */
export type StubResponse = {
    /** HTTP status code (default: 200). */
    status?: number;
    /** Response body: an object is JSON, a string text, `null` empty, a `StreamBody` arrives in pieces. */
    body: unknown;
    headers?: Record<string, string> | undefined;
    /** Delay in ms before responding (for timeout testing). */
    delay?: number | undefined;
    /** A transport failure instead of a reply: `fetch` rejects, as no status code can express. */
    transport?: 'network-error' | undefined;
};

/** Each adapter serialises an object as JSON, so a stream declared as a plain value would arrive as `{}`: the tag tells them apart. */
export const STREAM_BODY = '@jterrazz/test:stream';

/** A body that arrives in pieces, as `http.stream()` and `http.sse()` build it. */
export type StreamBody = {
    /** The pieces, written in order. */
    chunks: readonly string[];
    /** The `content-type` the stream is served under. */
    contentType: string;
    /** Milliseconds between two chunks. Default 0: everything at once. */
    delayBetweenChunks: number;
    kind: typeof STREAM_BODY;
};

export function isStreamBody(body: unknown): body is StreamBody {
    return typeof body === 'object' && body !== null && 'kind' in body && body.kind === STREAM_BODY;
}

/** A response computed from the observed request at serve time. */
export type StubResponder = (request: MatchableRequest) => StubResponse;

/** A fixed `StubResponse`, or a `StubResponder` evaluated per served request. */
export type StubResponseValue = StubResponder | StubResponse;
