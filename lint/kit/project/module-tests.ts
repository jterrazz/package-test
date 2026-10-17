import {
    isGroundFolder,
    PRUNED,
    TESTS_FOLDER,
    treeEntries,
    treeKind,
} from '@jterrazz/typescript/rules';
import { basename, dirname, join } from 'node:path';

import { isTestFileName } from './role.js';

export const PRUNED_WITH_OUTPUTS: ReadonlySet<string> = new Set([
    ...PRUNED,
    '.artifacts',
    'coverage',
]);

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
                !PRUNED_WITH_OUTPUTS.has(entry.name) &&
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

/** The `__tests__/` folders a member's module tests sit in: the only place outside `specs/` where ground may stand. */
export function testsFoldersOf(member: string): string[] {
    return [
        ...new Set(
            moduleTestsOf(member)
                .map((file) => dirname(file))
                .filter((folder) => basename(folder) === TESTS_FOLDER),
        ),
    ];
}

/** A path inside the ground of a `__tests__/` folder: `<dir>/__tests__/__expected__/...`. */
export function isTestsFolderGround(path: string): boolean {
    const segments = path.split(/[/\\]/u);
    return segments.some(
        (segment, index) => segment === TESTS_FOLDER && isGroundFolder(segments[index + 1] ?? ''),
    );
}
