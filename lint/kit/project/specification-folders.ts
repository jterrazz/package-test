import { GROUND_FIXTURES, PRUNED, treeEntries } from '@jterrazz/typescript/rules';
import type { TreeEntry } from '@jterrazz/typescript/rules';
import { join } from 'node:path';

import { SPECIFICATIONS } from './specifications.js';

export const PRUNED_WITH_FIXTURES: ReadonlySet<string> = new Set([...PRUNED, GROUND_FIXTURES]);

export function entriesOf(dir: string): TreeEntry[] {
    try {
        return treeEntries(dir);
    } catch {
        return [];
    }
}

export function specificationsIn(dir: string): string[] {
    return entriesOf(dir)
        .filter((entry) => entry.isFile() && entry.name.includes('.specification.'))
        .map((entry) => join(dir, entry.name));
}

export function* walkFiles(dir: string): Generator<string> {
    for (const entry of entriesOf(dir)) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!PRUNED_WITH_FIXTURES.has(entry.name)) {
                yield* walkFiles(path);
            }
            continue;
        }
        yield path;
    }
}

export function specificationFoldersOf(
    specsRoot: string,
): { specification: string; path: string }[] {
    return entriesOf(specsRoot)
        .filter((entry) => entry.isDirectory() && SPECIFICATIONS.has(entry.name))
        .map((entry) => ({ specification: entry.name, path: join(specsRoot, entry.name) }));
}
