import { GROUND_FIXTURES, PRUNED, treeEntries } from '@jterrazz/typescript/rules';
import type { TreeEntry } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FACETS } from './facets.js';

export const SKIPPED: ReadonlySet<string> = new Set([...PRUNED, GROUND_FIXTURES]);

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

export function textOf(path: string): null | string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return null;
    }
}

export function* walkFiles(dir: string): Generator<string> {
    for (const entry of entriesOf(dir)) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIPPED.has(entry.name)) {
                yield* walkFiles(path);
            }
            continue;
        }
        yield path;
    }
}

export function facetFoldersOf(specsRoot: string): { facet: string; path: string }[] {
    return entriesOf(specsRoot)
        .filter((entry) => entry.isDirectory() && FACETS.has(entry.name))
        .map((entry) => ({ facet: entry.name, path: join(specsRoot, entry.name) }));
}
