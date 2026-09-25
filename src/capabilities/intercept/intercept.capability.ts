import { defineCapability } from '../../model/chain/capability.js';
import type { Contract, ContractInput } from '../../stubs/contract.js';
import type { ContractRequest, ContractResponder, ContractResponse } from '../../stubs/exchange.js';
import { declared } from './declared.js';
import type { InterceptPort } from './intercept.port.js';

/**
 * The `.intercept()` overload set, identical on every facet: one contract, a
 * list, a composite — or the inline `(request, response)` pair for a one-off.
 */
export type InterceptMethod<Self> = ((contracts: ContractInput) => Self) &
    ((request: ContractRequest, response: ContractResponder | ContractResponse) => Self);

/**
 * `.intercept(…)`: the outgoing calls this chain expects, and what they reply
 * (CONVENTIONS D7). Calls append; composition and overriding live in
 * `defineContracts()` / `.with()`, not in call order. Strict once armed: while
 * the action runs, a request no contract accepts is the failure it reports.
 */
export const intercept = defineCapability<
    'intercept',
    readonly Contract[],
    [
        requestOrContracts: ContractInput | ContractRequest,
        response?: ContractResponder | ContractResponse,
    ],
    { network: InterceptPort }
>({
    arm: async (contracts, { network }) => await network.arm(contracts),
    initial: [],
    name: 'intercept',
    phase: 40,
    reduce: (contracts, [requestOrContracts, response], { engines }) => {
        engines.network.accepts();
        return [...contracts, ...declared('.intercept', requestOrContracts, response)];
    },
    row: { group: 'Setup', name: '.intercept()', probe: '.intercept(' },
});
