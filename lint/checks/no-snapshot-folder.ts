import { join, relative, sep } from 'node:path';

import { treeEntries, treeKind, treeNames } from '../../src/kernel/files/git-tree.js';
import { isGroundName } from '../../src/kernel/files/ground.js';
import { SKIPPED } from '../reading/module-tests.js';
import type { Finding } from './checker.js';

/** `rootDir` anchors the reported paths, so a member's finding reads the same alone as inside a whole-workspace run. */
const GROUND_SYNONYMS = new Set(['__snapshots__', 'golden', 'goldens', 'snapshots']);

const CODE_MODULE = /\.[cm]?[jt]sx?$/u;

/** Under the member's `specs/` tree always; elsewhere only when it holds no code: a `goldens/` folder of matcher source is named for what its code does. */
function holdsGround(path: string, memberDir: string): boolean {
    if (relative(memberDir, path).split(sep).includes('specs')) {
        return true;
    }
    try {
        return !treeNames(path).some((name) => CODE_MODULE.test(name));
    } catch {
        return false;
    }
}

/** The walk stops at a nested package and never enters ground: a fixture project may carry the word on purpose. */
export function checkNoSnapshotFolder(memberDir: string, label: string): Finding[] {
    const found: Finding[] = [];
    const walk = (dir: string): void => {
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (!entry.isDirectory() || SKIPPED.has(entry.name) || isGroundName(entry.name)) {
                continue;
            }
            if (GROUND_SYNONYMS.has(entry.name) && holdsGround(path, memberDir)) {
                found.push({
                    file: join(label, relative(memberDir, path), '/'),
                    line: 1,
                    fix: `rename \`${entry.name}/\` to \`expected/\`, beside the test that reads it`,
                    found: `\`${entry.name}/\`, a synonym of \`expected/\``,
                    rule: 'no-snapshot-folder',
                    severity: 'error',
                });
            } else if (dir === memberDir || treeKind(join(path, 'package.json')) !== 'file') {
                walk(path);
            }
        }
    };
    walk(memberDir);
    return found;
}
