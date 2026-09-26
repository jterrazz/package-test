import type { InterceptPort } from '../../intercept/intercept.port.js';
import type { StubBackend } from './stub-backend.js';

/** Each chain's stubs replace the previous chain's, even when it declares none; a runner without a backend refuses `.intercept()`. */
export function stubBackend(
    backend: StubBackend | undefined,
    facet: 'mobile' | 'website',
): InterceptPort {
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
