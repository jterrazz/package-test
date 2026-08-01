/**
 * The observed outgoing request, reduced to what contract matchers inspect.
 * Built once per request by the engine (MSW on api/jobs, the stub backend on
 * website/mobile) and handed to {@link ContractRequest.match} and to a
 * {@link ContractResponder}.
 */
export interface MatchableRequest {
    /** Parsed JSON body when the payload is JSON, the raw text otherwise, or `null` when absent. */
    body: unknown;
    /** Request headers, keyed by lowercased header name. */
    headers: Record<string, string>;
    /** Uppercased HTTP method of the observed request. */
    method: string;
    /** The request URL — fully-qualified, or origin-relative for the stub backend. */
    url: string;
}

/**
 * The request half of a contract: which outgoing call it speaks for.
 *
 * `url` is either an absolute URL (string or RegExp), or a PATH FORM starting
 * with `/` (`/articles/{{uuid}}`) which matches any origin — the shape a
 * website/mobile app's own backend calls take. `{{token}}` segments compare
 * structurally, declared query params are a subset of the observed ones.
 */
export interface ContractRequest {
    /** Adapter name — `http` | `openai` | `anthropic`. */
    adapter: string;
    /** HTTP method to match. `*` matches any method. */
    method: string;
    /** Absolute URL (string | RegExp) or an any-origin path form (`/articles/{{uuid}}`). */
    url: RegExp | string;
    /** Optional request matcher — the contract only fires if this returns true. */
    match?: (request: MatchableRequest) => boolean;
    /** Transform raw data into a provider-specific response envelope. */
    wrap: (data: unknown) => ContractResponse;
}

/**
 * The response half of a contract: what to reply when the request matches.
 */
export interface ContractResponse {
    /** HTTP status code (default: 200). */
    status?: number;
    /** Response body — an object is JSON, a string is text, `null`/`undefined` is empty. */
    body: unknown;
    /** Response headers. */
    headers?: Record<string, string>;
    /** Delay in ms before responding (for timeout testing). */
    delay?: number;
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
