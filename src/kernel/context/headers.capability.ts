import { defineCapability } from '../chain/capability.js';
import type { ChainSignature } from '../chain/capability.js';

export type HeadersMethod<Self> = (headers: Record<string, string>) => Self;

export type HeadersChain<Self> = {
    /** Set HTTP headers for the exchange. Multiple calls merge. */
    headers: HeadersMethod<Self>;
};

// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface HeadersSignature extends ChainSignature {
    readonly chain: HeadersChain<this['self']>;
}

export const headers = defineCapability<
    'headers',
    Readonly<Record<string, string>>,
    [headers: Record<string, string>],
    HeadersSignature,
    Record<never, never>,
    'headers'
>({
    context: 'headers',
    initial: {},
    name: 'headers',
    phase: 0,
    reduce: (held, [added]) => ({ ...held, ...added }),
    row: { group: 'Setup', name: '.headers()', probe: '.headers(' },
});
