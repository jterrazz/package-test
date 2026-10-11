import { defineCapability } from '../../../chain/capability.js';
import type { ChainSignature } from '../../../chain/capability.js';

/** What a page finds in its web storage when its first script runs: each store's entries by key. */
export type StorageSeed = {
    /** `localStorage` entries. */
    local?: Readonly<Record<string, string>>;
    /** `sessionStorage` entries. */
    session?: Readonly<Record<string, string>>;
};

/** A seed, or `'throws'`: the browser refuses every read of web storage with a `SecurityError`, as a browser blocking site data does. */
export type StorageState = 'throws' | StorageSeed;

export type StorageMethod<Self> = (state: StorageState) => Self;

export type StorageChain<Self> = {
    /** Seed `localStorage` and `sessionStorage` before the page's first script, or block them with `'throws'`; a later call replaces the earlier. */
    storage: StorageMethod<Self>;
};

export interface StorageSignature extends ChainSignature {
    readonly chain: StorageChain<this['self']>;
}

export const storage = defineCapability<
    'storage',
    null | StorageState,
    [state: StorageState],
    StorageSignature
>({
    initial: null,
    name: 'storage',
    phase: 10,
    reduce: (_held, [state]) => state,
    row: { group: 'Setup', name: '.storage()', probe: '.storage(' },
});
