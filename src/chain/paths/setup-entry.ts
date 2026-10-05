import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** A global setup's source in a checkout, else the entry the build names after it: `<name>.global-setup.js`, beside its owner's chunk. */
export function setupEntry(directory: string, name: string): string {
    const source = join(directory, `${name}.global-setup.ts`);
    return existsSync(source) ? source : join(directory, `${name}.global-setup.js`);
}
