import { defineCapability } from '../../../kernel/chain/capability.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import type { StubRequest, StubResponder, StubResponse } from '../exchange.js';
import type { Stub, StubInput } from '../stub.js';
import { declared } from './declared.js';
import type { InterceptPort } from './intercept.port.js';

/** One stub, a list, a composite, or an inline `(request, response)` pair. */
export type InterceptMethod<Self> = ((stubs: StubInput) => Self) &
    ((request: StubRequest, response: StubResponder | StubResponse) => Self);

export type InterceptChain<Self> = {
    /** Declare outgoing calls — a stub, a list, a composite, or an inline request + response pair. */
    intercept: InterceptMethod<Self>;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface InterceptSignature extends ChainSignature {
    readonly chain: InterceptChain<this['self']>;
}

/** Calls append (`network-strict-after-first-stub`); composition and overriding live in `defineStubs()` / `.with()`. Strict once armed. */
export const intercept = defineCapability<
    'intercept',
    readonly Stub[],
    [requestOrStubs: StubInput | StubRequest, response?: StubResponder | StubResponse],
    InterceptSignature,
    { network: InterceptPort }
>({
    arm: async (stubs, { network }) => await network.arm(stubs),
    initial: [],
    name: 'intercept',
    phase: 40,
    reduce: (stubs, [requestOrStubs, response], { adapters }) => {
        adapters.network.accepts();
        return [...stubs, ...declared('.intercept', requestOrStubs, response)];
    },
    row: { group: 'Setup', name: '.intercept()', probe: '.intercept(' },
});
