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
            `${call}(): a bare request needs its response — pass a stub ` +
                `(defineStub({ request, response })) or the inline pair ${call}(request, response).`,
        );
    }
    return [{ request: requestOrStubs, response: maybeResponse }];
}
