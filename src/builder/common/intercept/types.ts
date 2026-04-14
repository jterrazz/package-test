/**
 * An intercept trigger describes which HTTP request to match.
 */
export interface InterceptTrigger {
    /** HTTP method to match. */
    method: string;
    /** URL pattern to match (string for exact prefix, RegExp for pattern). */
    url: RegExp | string;
    /** Optional request body matcher - the handler only fires if this returns true. */
    match?: (body: unknown) => boolean;
    /**
     * Optional wrapper - transforms raw JSON data into a provider-specific response.
     * Used when .intercept(trigger, 'file.json') loads a file: the raw data is
     * passed through wrap() to produce the correct response envelope.
     */
    wrap?: (data: unknown) => InterceptResponse;
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
 * A fully resolved intercept entry ready to be registered with MSW.
 */
export interface InterceptEntry {
    trigger: InterceptTrigger;
    response: InterceptResponse;
}
