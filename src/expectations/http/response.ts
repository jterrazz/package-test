import { CaptureScope } from '../tokens/match.js';

/**
 * HTTP response returned by a server port, its body read as a response `.http`
 * reads one.
 */
export type ServerResponse = {
    /** HTTP status code. */
    status: number;
    /** The JSON value the body holds, or its text when it is not JSON (HTML, an event stream, plain text); null when the body is empty. */
    body: unknown;
    /** Response headers as a flat key-value map. */
    headers: Record<string, string>;
};

/**
 * Read-only accessor for an HTTP response.
 *
 * Assertions go through `expect()`:
 * `expect(result.response).toMatch('created.http')` compares status,
 * a subset of headers, and the body — a JSON value or a text — against `expected/<name>` —
 * with `{{placeholder}}` support in all three.
 */
export class ResponseAccessor {
    /** The JSON value the body holds, or its text when it is not JSON; null when the body is empty. */
    readonly body: unknown;
    /** @internal Ref-capture scope shared by the current spec execution. */
    readonly captures: CaptureScope;
    /** Response headers as a flat, lower-cased key-value map. */
    readonly headers: Record<string, string>;
    /** The HTTP response status code. */
    readonly status: number;
    /** @internal Test-file directory — fixture resolution root for matchers. */
    readonly testDir: string;

    constructor(response: ServerResponse, testDir: string, captures?: CaptureScope) {
        this.body = response.body;
        this.headers = response.headers;
        this.status = response.status;
        this.testDir = testDir;
        this.captures = captures ?? new CaptureScope();
    }
}
