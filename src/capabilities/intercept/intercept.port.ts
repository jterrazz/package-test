import type { Armed } from '../../model/chain/capability.js';
import type { Stub } from '../../stubs/stub.js';

/** The engine a chain's stubs are served by — the only way `.intercept()` reaches the network. */
export type InterceptPort = {
    /** Refuse the setup before it is stated, when this engine cannot serve a stub at all. */
    readonly accepts: () => void;
    /** Serve the chain's stubs until the effect is released, recording the strict violation. */
    readonly arm: (stubs: readonly Stub[]) => Promise<Armed>;
};
