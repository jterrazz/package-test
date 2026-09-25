import { defineCapability } from '../../model/chain/capability.js';
import type { StubRequest, StubResponder, StubResponse } from '../../stubs/exchange.js';
import type { Stub, StubInput } from '../../stubs/stub.js';
import { declared } from './declared.js';
import type { InterceptPort } from './intercept.port.js';

/**
 * The `.intercept()` overload set, identical on every facet: one stub, a
 * list, a composite — or the inline `(request, response)` pair for a one-off.
 */
export type InterceptMethod<Self> = ((stubs: StubInput) => Self) &
    ((request: StubRequest, response: StubResponder | StubResponse) => Self);

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
