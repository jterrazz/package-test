import type { InterceptResponse, InterceptTrigger } from '../types.js';

/** Default wrap: raw JSON data becomes the response body. */
function wrapJson(data: unknown): InterceptResponse {
    return { status: 200, body: data };
}

/**
 * Generic HTTP intercept helpers for any URL.
 *
 * @example
 *   .intercept(http.get('https://api.example.com/data'), 'response.json')
 *   .intercept(http.post('https://api.stripe.com/v1/charges'), http.json({ id: 'ch_...' }))
 */
export const http = {
    /** Trigger: match GET requests to a URL pattern. */
    get(url: RegExp | string): InterceptTrigger {
        return { method: 'GET', url, wrap: wrapJson };
    },

    /** Trigger: match POST requests to a URL pattern. */
    post(url: RegExp | string): InterceptTrigger {
        return { method: 'POST', url, wrap: wrapJson };
    },

    /** Trigger: match PUT requests to a URL pattern. */
    put(url: RegExp | string): InterceptTrigger {
        return { method: 'PUT', url, wrap: wrapJson };
    },

    /** Trigger: match DELETE requests to a URL pattern. */
    delete(url: RegExp | string): InterceptTrigger {
        return { method: 'DELETE', url, wrap: wrapJson };
    },

    /** Trigger: match any method to a URL pattern. */
    any(url: RegExp | string): InterceptTrigger {
        return { method: '*', url, wrap: wrapJson };
    },

    /** Response: simple JSON success. */
    json(data: unknown, status = 200): InterceptResponse {
        return { status, body: data };
    },

    /** Response: error with message. */
    error(status: number, message?: string): InterceptResponse {
        return { status, body: { error: message ?? `HTTP ${status}` } };
    },
};
