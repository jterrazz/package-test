import type { Sharing } from '../../model/chain/capability.js';
import type { CliEnv } from '../../model/ports/cli.port.js';

/**
 * What a FILE shares on every chain it starts: the settings, never the state.
 * A clock, headers, an environment are how the file reaches its subject; a
 * seed or a stub is the Given of one test, and stays on its chain.
 */
export type ChainContext = {
    /** The instant every chain pins — a chain's own `.clock()` wins. */
    clock?: string;
    /** The environment every command runs with — a chain's own `.env()` merges over it. */
    env?: CliEnv;
    /** The headers every request carries — a chain's own `.headers()` merges over them. */
    headers?: Record<string, string>;
};

/**
 * `with()`: start from what a whole file shares, each setting folded in as
 * its own setup would state it, so a later setup of the chain overrides or
 * merges exactly as it would over an earlier one. A key the facet composes no
 * setup for is ignored.
 */
export const sharing: Sharing = {
    kind: 'context',
    name: 'with',
    row: { group: 'Setup', name: '.with()', probe: '.with({' },
};
