/**
 * The observed outgoing request, reduced to what trigger matchers inspect.
 * Built once per request by the MSW integration and handed to
 * {@link InterceptTrigger.match}.
 */
export interface MatchableRequest {
    /** Parsed JSON body when the payload is JSON, the raw text otherwise, or `null` when absent. */
    body: unknown;
    /** Request headers, keyed by lowercased header name. */
    headers: Record<string, string>;
    /** The fully-qualified request URL (including any query string). */
    url: string;
}

/**
 * An intercept trigger describes which HTTP request to match.
 */
export interface InterceptTrigger {
    /** Adapter name - must match the folder prefix in file-based intercepts. */
    adapter: string;
    /** HTTP method to match. */
    method: string;
    /** URL pattern to match (string for exact prefix, RegExp for pattern). */
    url: RegExp | string;
    /** Optional request matcher - the handler only fires if this returns true. */
    match?: (request: MatchableRequest) => boolean;
    /**
     * Transform raw JSON data into a provider-specific response envelope.
     * Called when .intercept(trigger, 'adapter/file.json') loads a file.
     */
    wrap: (data: unknown) => InterceptResponse;
}

/**
 * An intercept response describes what to return when the trigger matches.
 */
export interface InterceptResponse {
    /** HTTP status code (default: 200). */
    status?: number;
    /** Response body (will be JSON.stringified). */
    body: unknown;
    /** Response headers. */
    headers?: Record<string, string>;
    /** Delay in ms before responding (for timeout testing). */
    delay?: number;
}

/**
 * A dynamic response: computed from the observed request at the moment the
 * intercept is consumed, rather than fixed ahead of time. Handed the same
 * {@link MatchableRequest} the trigger matched on, so the reply can echo or
 * derive from the request body/headers/url.
 */
export type InterceptResponder = (request: MatchableRequest) => InterceptResponse;

/**
 * What an intercept replies with: either a fixed {@link InterceptResponse} or
 * an {@link InterceptResponder} evaluated per consumed request.
 */
export type InterceptResponseValue = InterceptResponder | InterceptResponse;

/**
 * A fully resolved intercept entry ready to be registered with MSW.
 */
export interface InterceptEntry {
    trigger: InterceptTrigger;
    response: InterceptResponseValue;
}
