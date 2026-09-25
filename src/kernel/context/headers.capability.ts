import type { ChainSignature } from '../../kernel/chain/capability.js';
import { defineCapability } from '../chain/capability.js';

/** `.headers(record)`, handing back the chain it was called on. */
export type HeadersMethod<Self> = (headers: Record<string, string>) => Self;

/** What `.headers()` puts on a chain, handing back the chain it was called on. */
export type HeadersChain<Self> = {
    /** Set HTTP headers for the exchange. Multiple calls merge. */
    headers: HeadersMethod<Self>;
};

/** The signature `ChainOf` reads off `headers`. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name
export interface HeadersSignature extends ChainSignature {
    readonly chain: HeadersChain<this['self']>;
}

/**
 * `.headers(record)`: the HTTP headers the chain's exchange carries. Calls
 * merge, a later value of a name replacing an earlier one; the action reads
 * them — no engine arms them.
 */
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
