import { join, relative } from 'node:path';

import { SPEC_EXTENSION } from '../../../src/facets/cli/documents/spec-document.js';
import { treeEntries } from '../../../src/kernel/files/git-tree.js';
import { parseYamlSource } from '../../../src/kernel/yaml/document.js';

const SKIPPED = new Set(['.git', 'dist', 'node_modules']);

export function isFixture(file: string): boolean {
    return file.split('/').includes('fixtures');
}

export function specDocuments(root: string): string[] {
    const found: string[] = [];
    const visit = (dir: string): void => {
        for (const entry of treeEntries(dir)) {
            const path = join(dir, entry.name);
            if (entry.isDirectory() && !SKIPPED.has(entry.name)) {
                visit(path);
            } else if (entry.isFile() && entry.name.endsWith(SPEC_EXTENSION)) {
                found.push(relative(root, path));
            }
        }
    };
    visit(root);
    return found.toSorted();
}

export function documentData(text: string): unknown {
    return parseYamlSource(text).document.toJS();
}
