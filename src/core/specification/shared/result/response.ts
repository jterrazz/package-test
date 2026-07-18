import { CaptureScope } from '../../../matching/match.js';
import type { ServerResponse } from '../../../ports/server.port.js';

/**
 * Read-only accessor for an HTTP response.
 *
 * Assertions go through `expect()`:
 * `expect(result.response).toMatch('created.http')` compares status,
 * a subset of headers, and the JSON body against `expected/<name>` —
 * with `{{placeholder}}` support in all three.
 */
export class ResponseAccessor {
    /** The parsed JSON response body (null when parsing failed). */
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
