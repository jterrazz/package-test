import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function setupEntry(directory: string, source: string, bundled: string): string {
    const path = join(directory, source);
    return existsSync(path) ? path : join(directory, bundled);
}
