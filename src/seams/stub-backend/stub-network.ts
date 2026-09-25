import type { Armed } from '../../model/chain/capability.js';
import type { Contract } from '../../stubs/contract.js';
import type { StubBackend } from './stub-backend.js';

/**
 * The network of a site or an app running in its OWN process — served by the
 * stub backend its constructor started. Arming a chain replaces the previous
 * chain's contracts, the way databases reset; the strict failure is the
 * stub's. A runner that declared no backend refuses the setup when it is
 * stated, naming the constructor option that fixes it.
 */
export function stubBackend(
    backend: StubBackend | undefined,
    facet: 'mobile' | 'website',
): {
    readonly accepts: () => void;
    readonly arm: (contracts: readonly Contract[]) => Promise<Armed>;
} {
    return {
        accepts: () => {
            if (backend === undefined) {
                throw new Error(
                    `.intercept(): this runner has no declared backend — add \`backend\` to the specification options ` +
                        `(specification.${facet}({ …, backend: { … } })) so the chain's contracts have a stub to serve them.`,
                );
            }
        },
        arm: async (contracts) => {
            if (backend === undefined) {
                return await Promise.resolve({});
            }
            backend.beginChain(contracts);
            return await Promise.resolve({ violation: () => backend.violation() });
        },
    };
}
