import { refusal } from '../../../lint/refusal.js';
import type { StubRequest, StubResponder, StubResponse } from '../exchange.js';
import { stubsOf } from '../stub.js';
import type { Stub, StubInput } from '../stub.js';

function isStub(value: unknown): value is Stub {
    return typeof value === 'object' && value !== null && 'request' in value && 'response' in value;
}

/** A bare request is refused; the compiler already refuses the form, so only an untyped call reaches the refusal. */
export function declared(
    call: '.intercept' | 'intercept',
    requestOrStubs: StubInput | StubRequest,
    maybeResponse?: StubResponder | StubResponse,
): Stub[] {
    if (Array.isArray(requestOrStubs) || 'stubs' in requestOrStubs || isStub(requestOrStubs)) {
        return stubsOf(requestOrStubs);
    }
    if (maybeResponse === undefined) {
        throw new Error(
            refusal({
                fix: `pass a stub — defineStub({ request, response }) — or the inline pair ${call}(request, response)`,
                found: `${call}(request), a bare request with no response`,
                read: 'docs/17-stubs.md#using-them-intercept',
                why: 'A stub is a request and its response: a request alone answers nothing.',
            }),
        );
    }
    return [{ request: requestOrStubs, response: maybeResponse }];
}
