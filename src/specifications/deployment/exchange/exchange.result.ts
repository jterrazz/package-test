import type { MatrixRow } from '../../../chain/capability.js';
import { ResponseAccessor } from '../../../expectations/http/response.js';
import type { ResponseRecording, ServerResponse } from '../../../expectations/http/response.js';
import { BaseResult } from '../../../expectations/result.js';
import type { BaseResultOptions } from '../../../expectations/result.js';
import type { TlsFacts } from './tls-facts.js';

export const EXCHANGE_RESULT_ROWS: readonly MatrixRow[] = [
    { group: 'Result accessor', name: '.response', probe: 'result.response' },
    { group: 'Result accessor', name: '.tls', probe: 'result.tls' },
];

/** What one exchange with a deployment hands back: the response, or why none came, and the certificate it was presented. */
export class ExchangeResult extends BaseResult {
    private readonly answer: ServerResponse;
    private readonly recording: ResponseRecording;
    /** The certificate an https exchange was presented and the trust check's verdict; undefined over http, or when no handshake completed. */
    readonly tls: TlsFacts | undefined;

    constructor(
        options: BaseResultOptions & {
            recording: ResponseRecording;
            response: ServerResponse;
            tls: TlsFacts | undefined;
        },
    ) {
        super(options);
        this.answer = options.response;
        this.recording = options.recording;
        this.tls = options.tls;
    }

    /** The whole response (status, headers, body), or `unreachable: <reason>`, compared whole: `toMatch(<.http text>)` or `toMatch(file(...))`. */
    get response(): ResponseAccessor {
        return new ResponseAccessor(this.answer, this.testDir, this.captures, this.recording);
    }
}
