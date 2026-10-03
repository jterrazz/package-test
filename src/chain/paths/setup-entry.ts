import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The setup's source in a checkout, else the entry the bundle built for it: named by the source's stem unless the bundle names it otherwise. */
export function setupEntry(directory: string, stem: string, bundled: string = stem): string {
    const path = join(directory, `${stem}.ts`);
    return existsSync(path) ? path : join(directory, `${bundled}.js`);
}
