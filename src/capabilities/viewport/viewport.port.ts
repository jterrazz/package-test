import type { Armed } from '../../model/chain/capability.js';

/** The page a chain renders into, by its size — the only way `.viewport()` reaches it. */
export type ViewportPort = {
    /** Resize the page for this render; the engine restores the project's size when the test ends. */
    readonly size: (size: { height: number; width: number }) => Promise<Armed>;
};
