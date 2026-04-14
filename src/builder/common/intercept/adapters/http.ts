import type { InterceptResponse, InterceptTrigger } from '../types.js';

function wrapJson(data: unknown): InterceptResponse {
    return { status: 200, body: data };
}

/**
 * Generic HTTP intercept helpers for any URL.
 *
 * @example
 *   .intercept(http.get('https://api.example.com/data'), 'http/response.json')
 */
export const http = {
    get(url: RegExp | string): InterceptTrigger {
        return { adapter: 'http', method: 'GET', url, wrap: wrapJson };
    },

    post(url: RegExp | string): InterceptTrigger {
        return { adapter: 'http', method: 'POST', url, wrap: wrapJson };
    },

    put(url: RegExp | string): InterceptTrigger {
        return { adapter: 'http', method: 'PUT', url, wrap: wrapJson };
    },

    delete(url: RegExp | string): InterceptTrigger {
        return { adapter: 'http', method: 'DELETE', url, wrap: wrapJson };
    },

    any(url: RegExp | string): InterceptTrigger {
        return { adapter: 'http', method: '*', url, wrap: wrapJson };
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
