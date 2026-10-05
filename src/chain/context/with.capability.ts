import type { Sharing } from '../capability.js';

/** Merged over `process.env`; a `null` value unsets the variable. */
export type EnvRecord = Record<string, null | string>;

/** What a file shares on every chain it starts: settings, never state. */
export type ChainContext = {
    /** The instant every chain pins — a chain's own `.clock()` wins. */
    clock?: string;
    /** The environment every command runs with — a chain's own `.env()` merges over it. */
    env?: EnvRecord;
    /** The headers every request carries — a chain's own `.headers()` merges over them. */
    headers?: Record<string, string>;
};

/** A key the specification composes no setup for is ignored. */
export const sharing: Sharing = {
    kind: 'context',
    name: 'with',
    row: { group: 'Setup', name: '.with()', probe: '.with({' },
};
