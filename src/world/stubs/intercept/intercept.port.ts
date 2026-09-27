import type { Armed } from '../../../kernel/chain/capability.js';
import type { Stub } from '../stub.js';

export type InterceptPort = {
    /** Refuse the setup when this adapter cannot serve a stub at all. */
    readonly accepts: () => void;
    /** Serve the chain's stubs until released, recording the strict violation. */
    readonly arm: (stubs: readonly Stub[]) => Promise<Armed>;
};
