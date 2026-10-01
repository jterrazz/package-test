import type { Action } from './action.js';
import type { Capability, ChainSignature, Sharing } from './capability.js';
import type { ChainOf } from './chain.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- each chain is an empty interface over the computed type, as a facet names its own: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import type { ChainContext } from './context/with.capability.js';

type Assert<Row extends true> = Row;

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type SeedMethod<Self, Key extends string> = (source: string, options?: { database?: Key }) => Self;

type ClockChain<Self> = { clock: (iso: string) => Self };
interface ClockSignature extends ChainSignature {
    readonly chain: ClockChain<this['self']>;
}
type SeedChain<Self, Key extends string> = { seed: SeedMethod<Self, Key> };
interface SeedSignature extends ChainSignature {
    readonly chain: SeedChain<this['self'], this['params']['databaseKey']>;
}
type TriggerSignature = ChainSignature & {
    readonly chain: { trigger: (name: string) => Promise<number> };
};

declare const clock: Capability<
    'clock',
    null | string,
    [iso: string],
    ClockSignature,
    object,
    'clock'
>;
declare const seed: Capability<'seed', readonly string[], [source: unknown], SeedSignature>;
declare const sharing: Sharing;
declare const trigger: Action<'trigger', [name: string], number, TriggerSignature>;

const listed = { actions: [trigger], capabilities: [clock, seed, sharing], options: {} } as const;
const unshared = { actions: [trigger], capabilities: [clock, seed], options: {} } as const;

interface Listed<Key extends string = string> extends ChainOf<
    typeof listed,
    { databaseKey: Key; services: Record<string, unknown> },
    Listed<Key>
> {}

interface Unshared extends ChainOf<
    typeof unshared,
    { databaseKey: string; services: Record<string, unknown> },
    Unshared
> {}

type Expected<Key extends string> = {
    clock: (iso: string) => Listed<Key>;
    seed: SeedMethod<Listed<Key>, Key>;
    trigger: (name: string) => Promise<number>;
    with: (context: Pick<ChainContext, 'clock'>) => Listed<Key>;
};

export type ListedMembers = Assert<Same<keyof Listed, 'clock' | 'seed' | 'trigger' | 'with'>>;
export type ListedSignatures = Assert<Same<Listed<'db'>, Expected<'db'>>>;
export type SharesOnlyTheComposedSetting = Assert<
    Same<keyof Parameters<Listed['with']>[0], 'clock'>
>;
export type NoWithUnlessListed = Assert<Same<keyof Unshared, 'clock' | 'seed' | 'trigger'>>;
