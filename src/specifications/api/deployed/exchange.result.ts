import type { MatrixRow } from '../../../chain/capability.js';
import { ResponseAccessor } from '../../../expectations/http/response.js';
import type { ResponseRecording, ServerResponse } from '../../../expectations/http/response.js';
import { CaptureScope } from '../../../expectations/tokens/capture-scope.js';
import type { TlsFacts } from './tls-facts.js';

export const EXCHANGE_RESULT_ROWS: readonly MatrixRow[] = [
    { group: 'Result accessor', name: '.response', probe: 'result.response' },
    { group: 'Result accessor', name: '.tls', probe: 'result.tls' },
];

/** What one request to a deployed api hands back: the response, or why none came, and the certificate it came over; no table and no disk, which a deployed api keeps to itself. */
export class ExchangeResult {
    private readonly answer: ServerResponse;
    private readonly recording: ResponseRecording;
    // invariant: one scope per result, so a `#ref` captured by one comparison is the one every later comparison of the result reads.
    private readonly scope = new CaptureScope();
    private readonly testDir: string;
    /** The certificate an https request was presented and the trust check's verdict; undefined over http, or when no handshake completed. */
    readonly tls: TlsFacts | undefined;

    constructor(options: {
        recording: ResponseRecording;
        response: ServerResponse;
        testDir: string;
        tls: TlsFacts | undefined;
    }) {
        this.answer = options.response;
        this.recording = options.recording;
        this.testDir = options.testDir;
        this.tls = options.tls;
    }

    /** The whole response (status, headers, body), or `unreachable: <reason>`, compared whole: `toMatch(<.http text>)` or `toMatch(file(...))`. */
    get response(): ResponseAccessor {
        return new ResponseAccessor(this.answer, this.testDir, this.scope, this.recording);
    }
}
