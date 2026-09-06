import { basename } from 'node:path';

export function nameOf(path: string): string {
    return basename(path);
}
