import { join } from 'node:path';

import { treeEntries, treeKind } from '../../../src/kernel/files/git-tree.js';
import { isGroundName } from '../../../src/kernel/files/ground.js';
import { isTestFileName } from './role.js';

export const SKIPPED = new Set(['.git', '.artifacts', 'coverage', 'dist', 'node_modules']);

/** Never ground (a fixture project's tests are an input) nor a nested package; `specs/` is the tree passes'. */
export function moduleTestsOf(member: string): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (entry.isFile() && isTestFileName(entry.name)) {
                found.push(path);
            } else if (
                entry.isDirectory() &&
                !SKIPPED.has(entry.name) &&
                !isGroundName(entry.name) &&
                entry.name !== 'specs' &&
                treeKind(join(path, 'package.json')) !== 'file'
            ) {
                walk(path);
            }
        }
    };
    walk(member);
    return found;
}
