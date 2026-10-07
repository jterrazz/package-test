import { refusal } from '../../chain/refusals/refusal.js';
import type { StubRequest, StubResponder, StubResponse } from '../exchange.js';
import { stubsOf } from '../stub.js';
import type { Stub, StubInput } from '../stub.js';

// invariant: only a request carries the adapter that speaks for it; a stub, a list and a composite never do.
function isRequest(value: StubInput | StubRequest): value is StubRequest {
    return 'adapter' in value;
}

/** A bare request is refused; the compiler already refuses the form, so only an untyped call reaches the refusal. */
export function declared(
    call: '.intercept' | 'intercept',
    requestOrStubs: StubInput | StubRequest,
    maybeResponse?: StubResponder | StubResponse,
): Stub[] {
    if (!isRequest(requestOrStubs)) {
        return stubsOf(requestOrStubs);
    }
    if (maybeResponse === undefined) {
        throw new Error(
            refusal({
                fix: `pass a stub — defineStub({ request, response }) — or the inline pair ${call}(request, response)`,
                found: `${call}(request), a bare request with no response`,
                read: 'docs/reference/stubs.md#using-them-intercept',
                why: 'A stub is a request and its response: a request alone answers nothing.',
            }),
        );
    }
    return [{ request: requestOrStubs, response: maybeResponse }];
}
