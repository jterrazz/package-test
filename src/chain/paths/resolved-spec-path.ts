import { resolve } from 'node:path';

import { requireRelativePath } from './spec-path.js';

export function resolveSpecPath(verb: string, path: string, specDir: string): string {
    requireRelativePath(verb, path);
    return resolve(specDir, path);
}
