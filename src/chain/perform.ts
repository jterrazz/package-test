import type { AnyAction } from './action.js';
import type { AnyCapability, Armed } from './capability.js';
import type { ChainConfig } from './config.js';
import { readerOf } from './state.js';
import type { ChainState } from './state.js';

export type Performed = {
    readonly config: ChainConfig;
    readonly adapters: object;
    readonly state: ChainState;
    readonly testDir: string;
};

/** An adapter's recorded violation wins over the action's error and over its success; every armed effect is released in reverse. */
export async function perform(
    setups: readonly AnyCapability[],
    action: AnyAction,
    args: readonly unknown[],
    { config, adapters, state, testDir }: Performed,
): Promise<unknown> {
    const read = readerOf(state);
    const { workDir } = (await action.prepare?.(args, read)) ?? { workDir: null };
    const run = { config, testDir, workDir };
    // Stryker disable next-line ArrayDeclaration: an entry holding neither a violation nor a release changes nothing
    const armed: Armed[] = [];
    const violation = (): Error | null =>
        armed.map((effect) => effect.violation?.() ?? null).find((error) => error !== null) ?? null;
    try {
        for (const setup of setups.toSorted((one, other) => one.phase - other.phase)) {
            const effect = await setup.arm?.(read(setup), adapters, run);
            armed.push(effect ?? {});
        }
        const value = await action.perform(args, read, adapters, run);
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
