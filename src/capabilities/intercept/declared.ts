import { contractsOf, isContract, isContracts } from '../../stubs/contract.js';
import type { Contract, ContractInput } from '../../stubs/contract.js';
import type { ContractRequest, ContractResponder, ContractResponse } from '../../stubs/exchange.js';

/**
 * The contracts one intercept call declared, whichever of its two forms it
 * used: a contract, a list or a composite — or the inline `(request, response)`
 * pair. A bare request is refused in the words of the call that wrote it,
 * `.intercept` on a chain or `intercept` in module scope: the compiler already
 * refuses the form, so only an untyped call reaches the refusal.
 */
export function declared(
    call: '.intercept' | 'intercept',
    requestOrContracts: ContractInput | ContractRequest,
    maybeResponse?: ContractResponder | ContractResponse,
): Contract[] {
    if (
        Array.isArray(requestOrContracts) ||
        isContracts(requestOrContracts) ||
        isContract(requestOrContracts)
    ) {
        return contractsOf(requestOrContracts);
    }
    if (maybeResponse === undefined) {
        throw new Error(
            `${call}(): a bare request needs its response — pass a contract ` +
                `(defineContract({ request, response })) or the inline pair ${call}(request, response).`,
        );
    }
    return [{ request: requestOrContracts, response: maybeResponse }];
}
