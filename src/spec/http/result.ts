import type { SpecificationConfig } from '../builder.js';
import { ResponseAccessor } from '../common/result/response.js';
import { BaseResult } from '../common/result/result.js';
import type { ServerResponse } from './server.port.js';

/** Result from an HTTP action (.get(), .post(), .put(), .delete()). */
export class HttpResult extends BaseResult {
    private responseData: ServerResponse;

    constructor(options: {
        config: SpecificationConfig;
        response: ServerResponse;
        testDir: string;
    }) {
        super(options);
        this.responseData = options.response;
    }

    /** The HTTP response status code. */
    get status(): number {
        return this.responseData.status;
    }

    /** Access the HTTP response body for assertions. */
    get response(): ResponseAccessor {
        return new ResponseAccessor(this.responseData.body, this.testDir);
    }
}
