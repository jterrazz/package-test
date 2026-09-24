import { join } from 'node:path';

import { isGroundName } from '../src/model/chain/ground.js';
import { treeEntries, treeKind } from '../src/seams/git/tree.js';
import { isTestFileName } from './role.js';

/** Directories a member walk never enters. */
const SKIPPED = new Set(['.git', '.artifacts', 'coverage', 'dist', 'node_modules']);

/**
 * Every MODULE test of a member: each test file outside its `specs/` tree —
 * `src/`, `lint/`, wherever a module keeps its test beside it. The walk never
 * enters ground (a fixture project's tests are an input) nor a nested package
 * (its own member), and leaves `specs/` to the tree passes.
 *
 * A module test stands on files as a spec does, so the passes that read or
 * rewrite the paths a test names read these too: C8 and the fixers that move
 * ground.
 */
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
