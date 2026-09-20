import type { SpecificationConfig } from '../../model/chain/builder.js';
import type { ServerResponse } from '../../model/ports/server.port.js';
import { ResponseAccessor } from '../../model/result/response.js';
import { BaseResult } from '../../model/result/result.js';

/** Result from an HTTP action (.request(), .get(), .post(), .put(), .delete()). */
export class HttpResult extends BaseResult {
    private readonly responseData: ServerResponse;

    constructor(options: {
        config: SpecificationConfig;
        response: ServerResponse;
        testDir: string;
    }) {
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
