import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { treeEntries } from '../../src/kernel/files/git-tree.js';
import type { TreeEntry } from '../../src/kernel/files/git-tree.js';
import { GROUND_FIXTURES } from '../../src/kernel/files/ground.js';
import { FACETS } from '../reading/facets.js';

export const SKIPPED = new Set(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

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
