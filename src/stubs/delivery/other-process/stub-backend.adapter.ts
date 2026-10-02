import { refusal } from '../../../../lint/refusal.js';
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
                    refusal({
                        fix: `add \`backend\` to the specification options: specification.${facet}({ …, backend: { env: 'API_URL' } })`,
                        found: '.intercept(), and this runner has no declared backend',
                        read:
                            facet === 'mobile'
                                ? 'docs/11-mobile.md#declared-backend'
                                : 'docs/10-website.md#declared-backend',
                        why: 'A site or an app is served its stubs by a declared stub backend, the URL it reads in place of its API.',
                    }),
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
