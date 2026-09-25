import type { SliceReader } from './action.js';
import type { AnyCapability, SetupContext } from './capability.js';

/** What a chain has been told: one slice per setup, by name, and where its paths start. */
export type ChainState = {
    readonly slices: Readonly<Record<string, unknown>>;
    /** Fixed by the chain's first call other than `with()`; `null` until then. */
    readonly testDir: null | string;
};

/** A chain nobody has told anything yet. */
export const EMPTY_STATE: ChainState = { slices: {}, testDir: null };

/** The reader a setup's arming and an action are handed over one state. */
export function readerOf(state: ChainState): SliceReader {
    return <Slice>(capability: { readonly initial: Slice; readonly name: string }): Slice =>
        Object.hasOwn(state.slices, capability.name)
            ? // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a slice is stored under its setup's name, and only that setup's reducer writes it
              (state.slices[capability.name] as Slice)
            : capability.initial;
}

/**
 * One setup folded into a state — a NEW state: the one it came from is
 * untouched, so a chain reused after a setup never carries what a later
 * branch of it was told.
 */
export function applied(
    state: ChainState,
    capability: AnyCapability,
    args: readonly unknown[],
    setup: SetupContext<object>,
): ChainState {
    const slice = capability.reduce(readerOf(state)(capability), args, setup);
    return { ...state, slices: { ...state.slices, [capability.name]: slice } };
}
