import type { Armed } from '../../model/chain/capability.js';
import type { Stub } from '../../stubs/stub.js';
import type { StubBackend } from './stub-backend.js';

/**
 * The network of an app running in its OWN process (a server child, a
 * simulator), served by the stub backend its runner declared: each chain's
 * stubs replace the previous chain's, even when it declares none, and the
 * strict violation is the backend's. A runner that declared no backend
 * refuses `.intercept()` when it is stated, naming the option on its own
 * constructor.
 */
export function stubBackend(
    backend: StubBackend | undefined,
    facet: 'mobile' | 'website',
): {
    readonly accepts: () => void;
    readonly arm: (stubs: readonly Stub[]) => Promise<Armed>;
} {
    return {
        accepts: () => {
            if (backend === undefined) {
                throw new Error(
                    `.intercept(): this runner has no declared backend — add \`backend\` to the specification options ` +
                        `(specification.${facet}({ …, backend: { … } })) so the chain's stubs have a backend to serve them.`,
                );
            }
        },
        arm: async (stubs) => {
            if (backend === undefined) {
                return await Promise.resolve({});
            }
            backend.beginChain(stubs);
            return await Promise.resolve({ violation: () => backend.violation() });
        },
    };
}
