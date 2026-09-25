import type { Armed } from '../../model/chain/capability.js';
import type { Contract } from '../../stubs/contract.js';

/**
 * The network of THIS process, served by msw's node interceptor. The engine
 * is imported when a chain first declares a contract, so a run that declares
 * none never loads it; a chain with none arms nothing and is unguarded — the
 * process has real traffic of its own (CONVENTIONS D7, known scope).
 */
export const mswNode: {
    readonly accepts: () => void;
    readonly arm: (contracts: readonly Contract[]) => Promise<Armed>;
} = {
    accepts: () => {
        // Every chain of this process may declare contracts: the process has a network.
    },
    arm: async (contracts) => {
        if (contracts.length === 0) {
            return {};
        }
        const { registerContracts } = await import('./server.js');
        const registration = await registerContracts(contracts);
        return { release: registration.cleanup, violation: registration.violation };
    },
};
