import type { ContractInput } from '../../stubs/contract.js';
import type { ContractRequest, ContractResponder, ContractResponse } from '../../stubs/exchange.js';

/**
 * The `.intercept()` overload set, identical on every facet: one contract, a
 * list, a composite — or the inline `(request, response)` pair for a one-off.
 */
export type InterceptMethod<Self> = ((contracts: ContractInput) => Self) &
    ((request: ContractRequest, response: ContractResponder | ContractResponse) => Self);
