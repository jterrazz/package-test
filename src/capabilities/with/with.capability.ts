import type { CliEnv } from '../../model/ports/cli.port.js';

/**
 * What a FILE shares on every chain it starts: the settings, never the state.
 * A clock, headers, an environment are how the file reaches its subject; a
 * seed or a contract is the Given of one test, and stays on its chain.
 */
export type ChainContext = {
    /** The instant every chain pins — a chain's own `.clock()` wins. */
    clock?: string;
    /** The environment every command runs with — a chain's own `.env()` merges over it. */
    env?: CliEnv;
    /** The headers every request carries — a chain's own `.headers()` merges over them. */
    headers?: Record<string, string>;
};
