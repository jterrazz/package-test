import type { InterceptResponse, InterceptTrigger } from './types.js';

/**
 * Generic HTTP intercept helpers for any URL.
 *
 * @example
 *   .intercept(http.get('https://api.example.com/data'), { body: [...] })
 *   .intercept(http.post('https://api.stripe.com/v1/charges'), { body: { id: 'ch_...' } })
 */
export const http = {
    /** Trigger: match GET requests to a URL pattern. */
    get(url: RegExp | string): InterceptTrigger {
        return { method: 'GET', url };
    },

    /** Trigger: match POST requests to a URL pattern. */
    post(url: RegExp | string): InterceptTrigger {
        return { method: 'POST', url };
    },

    /** Trigger: match PUT requests to a URL pattern. */
    put(url: RegExp | string): InterceptTrigger {
        return { method: 'PUT', url };
    },

    /** Trigger: match DELETE requests to a URL pattern. */
    delete(url: RegExp | string): InterceptTrigger {
        return { method: 'DELETE', url };
    },

    /** Trigger: match any method to a URL pattern. */
    any(url: RegExp | string): InterceptTrigger {
        return { method: '*', url };
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
