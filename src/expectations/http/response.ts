import { CaptureScope } from '../tokens/capture-scope.js';

/** An HTTP response, its body read as a response `.http` reads one. */
export type ServerResponse = {
    status: number;
    /** The JSON value the body holds, or its text when it is not JSON (HTML, an event stream, plain text); null when the body is empty. */
    body: unknown;
    /** Response headers as a flat key-value map. */
    headers: Record<string, string>;
    /** Why no response came back (`refused`, `timeout`, `dns`, `tls CERT_HAS_EXPIRED` ...): set only when the exchange never answered, and then the status is 0, the headers empty and the body null. */
    unreachable?: string | undefined;
};

/** What update mode writes into a golden that states nothing yet: which headers it records, and whether a golden stating no body keeps stating none. */
export type ResponseRecording = {
    /** A golden that states no body keeps stating none: the body is claimed by writing it. */
    readonly bodyKeptAbsent: boolean;
    /** The header names a fresh golden records, those the response carries. */
    readonly headers: readonly string[];
};

/** A fresh golden records the content-type alone, and a golden with no body is given the body the response carried. */
export const DEFAULT_RECORDING: ResponseRecording = {
    bodyKeptAbsent: false,
    headers: ['content-type'],
};

/** Read-only accessor for an HTTP response, compared by `expect(...).toMatch(...)`. */
export class ResponseAccessor {
    /** The JSON value the body holds, or its text when it is not JSON; null when the body is empty. */
    readonly body: unknown;
    /** @internal */
    readonly captures: CaptureScope;
    /** Response headers as a flat, lower-cased key-value map. */
    readonly headers: Record<string, string>;
    /** @internal */
    readonly recording: ResponseRecording;
    readonly status: number;
    /** @internal */
    readonly testDir: string;
    /** Why the exchange never answered, a golden's `unreachable: <reason>` line; undefined when it answered. */
    readonly unreachable: string | undefined;

    constructor(
        response: ServerResponse,
        testDir: string,
        captures?: CaptureScope,
        recording: ResponseRecording = DEFAULT_RECORDING,
    ) {
        this.body = response.body;
        this.headers = response.headers;
        this.status = response.status;
        this.unreachable = response.unreachable;
        this.testDir = testDir;
        this.captures = captures ?? new CaptureScope();
        this.recording = recording;
    }
}
