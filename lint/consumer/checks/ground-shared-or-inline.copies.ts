import { readFileSync, statSync } from 'node:fs';

import { listFiles } from '../../kit/project/tree.js';

function sameSize(path: string, bytes: Buffer): boolean {
    // Stryker disable next-line ConditionalExpression: the size is a shortcut before the comparison of the bytes, which decides alone
    return statSync(path).size === bytes.length;
}

// invariant: a golden that is a byte copy of a file the repository keeps (not ground, not a test) is the author's copy of a source the test could read: it is compared with the source, not written in place, where it would be a second copy to keep in step.
export function sourceCopiedBy(rootDir: string, target: string): string | undefined {
    const bytes = readFileSync(target);
    return listFiles(rootDir, (path) => {
        try {
            return path !== target && sameSize(path, bytes) && readFileSync(path).equals(bytes);
        } catch {
            return false;
        }
    })[0];
}
