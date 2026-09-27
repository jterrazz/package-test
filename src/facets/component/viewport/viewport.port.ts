import type { Armed } from '../../../kernel/chain/capability.js';

export type ViewportPort = {
    /** Resize the page for this render; the adapter restores the project's size when the test ends. */
    readonly size: (size: { height: number; width: number }) => Promise<Armed>;
};
