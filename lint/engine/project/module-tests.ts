import { isGroundFolder, PRUNED, treeEntries, treeKind } from '@jterrazz/typescript/rules';
import { join } from 'node:path';

import { isTestFileName } from './role.js';

export const SKIPPED: ReadonlySet<string> = new Set([...PRUNED, '.artifacts', 'coverage']);

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
                !isGroundFolder(entry.name) &&
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
