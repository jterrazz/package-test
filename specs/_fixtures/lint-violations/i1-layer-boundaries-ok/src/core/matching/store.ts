import { join } from 'node:path';

export function fixturePath(dir: string, name: string): string {
    return join(dir, '_expected', name);
}
