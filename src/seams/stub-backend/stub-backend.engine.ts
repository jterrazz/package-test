import type { Armed } from '../../model/chain/capability.js';
import type { Contract } from '../../stubs/contract.js';
import type { StubBackend } from './stub-backend.js';

/**
 * The network of an app running in its OWN process (a server child, a
 * simulator), served by the stub backend its runner declared: each chain's
 * contracts replace the previous chain's, even when it declares none, and the
 * strict violation is the backend's. A runner that declared no backend
 * refuses `.intercept()` when it is stated, naming the option on its own
 * constructor.
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
