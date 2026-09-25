import { ResponseAccessor } from '../../../expectations/http/response.js';
import { BaseResult } from '../../../expectations/result.js';
import type { ResultConfig } from '../../../expectations/result.js';
import type { ServerResponse } from '../server/server.port.js';

/** Result from an HTTP action (.request(), .get(), .post(), .put(), .delete()). */
export class HttpResult extends BaseResult {
    private readonly responseData: ServerResponse;

    constructor(options: { config: ResultConfig; response: ServerResponse; testDir: string }) {
        super(options);
        this.responseData = options.response;
    }

    /** Access the HTTP response (status, headers, body) for assertions. */
    get response(): ResponseAccessor {
        return new ResponseAccessor(this.responseData, this.testDir, this.captures);
    }

    /** The HTTP response status code. */
    get status(): number {
        return this.responseData.status;
    }
}
