import type { Armed } from '../../model/chain/capability.js';
import type { Contract } from '../../stubs/contract.js';

/** The engine a chain's contracts are served by — the only way `.intercept()` reaches the network. */
export type InterceptPort = {
    /** Refuse the setup before it is stated, when this engine cannot serve a contract at all. */
    readonly accepts: () => void;
    /** Serve the chain's contracts until the effect is released, recording the strict violation. */
    readonly arm: (contracts: readonly Contract[]) => Promise<Armed>;
};
