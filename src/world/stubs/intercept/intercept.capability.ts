import { defineCapability } from '../../../kernel/chain/capability.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import type { StubRequest, StubResponder, StubResponse } from '../exchange/exchange.js';
import type { Stub, StubInput } from '../stub.js';
import { declared } from './declared.js';
import type { InterceptPort } from './intercept.port.js';

/**
 * The `.intercept()` overload set, identical on every facet: one stub, a
 * list, a composite — or the inline `(request, response)` pair for a one-off.
 */
export type InterceptMethod<Self> = ((stubs: StubInput) => Self) &
    ((request: StubRequest, response: StubResponder | StubResponse) => Self);

/** What `.intercept()` puts on a chain, handing back the chain it was called on. */
export type InterceptChain<Self> = {
    /** Declare outgoing calls — a stub, a list, a composite, or an inline request + response pair. */
    intercept: InterceptMethod<Self>;
};

/** The signature `ChainOf` reads off `intercept`. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface InterceptSignature extends ChainSignature {
    readonly chain: InterceptChain<this['self']>;
}

/**
 * `.intercept(…)`: the outgoing calls this chain expects, and what they reply
 * (CONVENTIONS D7). Calls append; composition and overriding live in
 * `defineStubs()` / `.with()`, not in call order. Strict once armed: while
 * the action runs, a request no stub accepts is the failure it reports.
 */
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
    reduce: (stubs, [requestOrStubs, response], { engines }) => {
        engines.network.accepts();
        return [...stubs, ...declared('.intercept', requestOrStubs, response)];
    },
    row: { group: 'Setup', name: '.intercept()', probe: '.intercept(' },
});
