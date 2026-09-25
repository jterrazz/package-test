import type { DiskTarget } from '../../model/chain/spec-path.js';

/** `.fixture(target)`, handing back the chain it was called on. */
export type FixtureMethod<Self> = (source: DiskTarget) => Self;
