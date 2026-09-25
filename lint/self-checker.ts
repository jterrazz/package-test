import { checkCapabilityFolder } from './checker-capability.js';
import type { TokenViolation } from './checker.js';

/**
 * The checker passes whose audience is `self` — this package's own suite
 * discipline, read off a specs tree the way a consumer pass is.
 *
 * They run in `dist/self-checker.js`, which `npm run lint` calls after the
 * published checker and which the tarball never carries: `dist/checker.js`
 * imports nothing from this module, so no consumer run can reach one.
 */
export const SELF_PASS_IDS = ['c35-capability-folder'] as const;

/** The name of a pass only this package runs. */
export type SelfPassId = (typeof SELF_PASS_IDS)[number];

/** Run every self pass over one specs tree; findings are relative to it. */
export function runSelfChecks(specsRoot: string): TokenViolation[] {
    return checkCapabilityFolder(specsRoot);
}
