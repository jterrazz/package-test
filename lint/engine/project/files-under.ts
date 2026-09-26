import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function filesUnder(dir: string): string[] {
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir, { recursive: true })
        .map(String)
        .filter((path) => statSync(join(dir, path)).isFile())
        .toSorted();
}
