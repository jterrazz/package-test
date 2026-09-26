import type { StubRequest, StubResponder, StubResponse } from '../exchange.js';
import { isStub, isStubs, stubsOf } from '../stub.js';
import type { Stub, StubInput } from '../stub.js';

/** A bare request is refused; the compiler already refuses the form, so only an untyped call reaches the refusal. */
export function declared(
    call: '.intercept' | 'intercept',
    requestOrStubs: StubInput | StubRequest,
    maybeResponse?: StubResponder | StubResponse,
): Stub[] {
    if (Array.isArray(requestOrStubs) || isStubs(requestOrStubs) || isStub(requestOrStubs)) {
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
