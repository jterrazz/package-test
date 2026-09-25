import type { ServerResponse } from '../../../expectations/http/response.js';

export type { ServerResponse } from '../../../expectations/http/response.js';

/** What a request carries beside its method, path and body. */
export type ServerRequestOptions = {
    /** The headers to send. */
    headers?: Record<string, string> | undefined;
    /** The route template the test wrote the path as, when it wrote one — what route coverage reads the request by. */
    template?: string | undefined;
};

/**
 * Abstract server interface for specification runners.
 * Integration mode uses an in-process Hono app; E2E mode uses real HTTP via fetch.
 */
export type ServerPort = {
    /** Send an HTTP request and return the parsed response. */
    request: (
        method: string,
        path: string,
        body?: unknown,
        options?: ServerRequestOptions,
    ) => Promise<ServerResponse>;
};
