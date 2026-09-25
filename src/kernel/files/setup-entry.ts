import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Where a global setup sits: its `.ts` source beside its owner in a source
 * checkout, its bundled `.js` in the built package, where the bundle and its
 * entries share one folder. `directory` is the owner's `import.meta.dirname`.
 */
export function setupEntry(directory: string, source: string, bundled: string): string {
    const path = join(directory, source);
    return existsSync(path) ? path : join(directory, bundled);
}
