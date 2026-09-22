import { join } from 'node:path';

export function fixturePath(dir: string, name: string): string {
    return join(dir, 'expected', name);
}
