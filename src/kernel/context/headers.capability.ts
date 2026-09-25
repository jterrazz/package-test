import { defineCapability } from '../chain/capability.js';

/** `.headers(record)`, handing back the chain it was called on. */
export type HeadersMethod<Self> = (headers: Record<string, string>) => Self;

/**
 * `.headers(record)`: the HTTP headers the chain's exchange carries. Calls
 * merge, a later value of a name replacing an earlier one; the action reads
 * them — no engine arms them.
 */
export const headers = defineCapability<
    'headers',
    Readonly<Record<string, string>>,
    [headers: Record<string, string>],
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
