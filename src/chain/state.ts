import type { SliceReader } from './action.js';
import type { AnyCapability, SetupContext } from './capability.js';

export type ChainState = {
    readonly slices: Readonly<Record<string, unknown>>;
    /** Fixed by the chain's first call other than `with()`; `null` until then. */
    readonly testDir: null | string;
};

export const EMPTY_STATE: ChainState = { slices: {}, testDir: null };

export function readerOf(state: ChainState): SliceReader {
    return <Slice>(capability: { readonly initial: Slice; readonly name: string }): Slice =>
        Object.hasOwn(state.slices, capability.name)
            ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a slice is stored under its setup's name, and only that setup's reducer writes it
              (state.slices[capability.name] as Slice)
            : capability.initial;
}

export function applied(
    state: ChainState,
    capability: AnyCapability,
    args: readonly unknown[],
    setup: SetupContext<object>,
): ChainState {
    const slice = capability.reduce(readerOf(state)(capability), args, setup);
    return { ...state, slices: { ...state.slices, [capability.name]: slice } };
}
