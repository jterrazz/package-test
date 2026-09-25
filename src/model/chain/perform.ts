import type { AnyAction } from './action.js';
import type { AnyCapability, Armed } from './capability.js';
import type { SpecificationConfig } from './config.js';
import { readerOf } from './state.js';
import type { ChainState } from './state.js';

/** Where the action runs, and what the chain it closes was told. */
export type Performed = {
    readonly config: SpecificationConfig;
    readonly engines: object;
    readonly state: ChainState;
    readonly testDir: string;
};

/**
 * The one pipeline every terminal action runs through: its refusals and its
 * directory first, then every setup armed through its engine in phase order,
 * then the action. An engine's recorded violation is the failure the action
 * reports — over the error the action met, and over a success — and every
 * armed effect is released, in reverse, however the action ends.
 */
export async function perform(
    setups: readonly AnyCapability[],
    action: AnyAction,
    args: readonly unknown[],
    { config, engines, state, testDir }: Performed,
): Promise<unknown> {
    const read = readerOf(state);
    const { workDir } = action.prepare?.(args, read) ?? { workDir: null };
    const run = { config, testDir, workDir };
    const armed: Armed[] = [];
    const violation = (): Error | null =>
        armed.map((effect) => effect.violation?.() ?? null).find((error) => error !== null) ?? null;
    try {
        for (const setup of setups.toSorted((one, other) => one.phase - other.phase)) {
            // oxlint-disable-next-line eslint/no-await-in-loop -- the order IS the contract: a seed lands before the contracts that serve it, the clock last
            const effect = await setup.arm?.(read(setup), engines, run);
            armed.push(effect ?? {});
        }
        const value = await action.perform(args, read, engines, run);
        const failed = violation();
        if (failed !== null) {
            throw failed;
        }
        return value;
    } catch (error) {
        throw violation() ?? error;
    } finally {
        for (const effect of armed.toReversed()) {
            effect.release?.();
        }
    }
}
