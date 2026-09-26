import { dirname, join, relative } from 'node:path';

import { treeEntries } from '../../engine/project/git-tree.js';
import {
    isGroundName,
    isReservedName,
    RESERVED_FOLDERS,
    SETUP_FOLDER,
    SHARED_FOLDER,
    UNMARKED_RESERVED,
} from '../../engine/project/ground.js';
import { isUnmarkedReserved, PRUNED } from '../../engine/project/specs-modules.js';
import { findSpecsRoots, isDir } from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

const CLOSED_LIST = RESERVED_FOLDERS.map((name) => `\`${name}/\``).join(', ');

function finding(rootDir: string, path: string, found: string, fix: string): Finding {
    return {
        file: isDir(path) ? `${relative(rootDir, path)}/` : relative(rootDir, path),
        line: 1,
        fix,
        found,
        rule: 'reserved-folder-in-closed-list',
        severity: 'error',
    };
}

function judged(
    rootDir: string,
    specsRoot: string,
    folder: string,
    name: string,
): Finding | undefined {
    const atRoot = relative(specsRoot, folder) === name;
    if (name.startsWith('_') && !isReservedName(name)) {
        return finding(
            rootDir,
            folder,
            `\`${name}/\`, a \`_\` name outside the closed list`,
            `rename it to the reserved folder that says what it holds — ${CLOSED_LIST} — or drop the \`_\` if it is a subject`,
        );
    }
    if (name === SHARED_FOLDER && !atRoot) {
        return finding(
            rootDir,
            folder,
            `\`${SHARED_FOLDER}/\` below the specs root`,
            `move what it holds into the reserved folders of \`${relative(specsRoot, dirname(folder))}/\` itself — what a folder's leaves share sits in that folder's \`${SETUP_FOLDER}/\` or ground; \`${SHARED_FOLDER}/\` exists only as \`specs/${SHARED_FOLDER}/\`, for what facets share`,
        );
    }
    const marked = UNMARKED_RESERVED[name];
    if (marked !== undefined && isUnmarkedReserved(specsRoot, folder)) {
        return finding(
            rootDir,
            folder,
            `\`${name}/\`, a reserved name without its \`_\` and no subject: it holds no spec`,
            name === 'doubles'
                ? `move its modules into \`${SETUP_FOLDER}/\`, each test adapter named for the port it replaces (\`<port>.adapter.ts\`), and the paths that import them`
                : `rename it \`${marked}/\`, and the paths that name it`,
        );
    }
    return undefined;
}

function refusedUnder(rootDir: string, specsRoot: string): Finding[] {
    const found: Finding[] = [];
    const visit = (dir: string, inShared: boolean): void => {
        let entries;
        try {
            entries = treeEntries(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            if (inShared && !isReservedName(entry.name)) {
                found.push(
                    finding(
                        rootDir,
                        path,
                        `\`${relative(specsRoot, path)}\`, which is no reserved folder`,
                        `\`specs/${SHARED_FOLDER}/\` holds reserved folders alone — code in \`${SHARED_FOLDER}/${SETUP_FOLDER}/\`, data in the ground folder of its role`,
                    ),
                );
                continue;
            }
            if (!entry.isDirectory() || PRUNED.has(entry.name) || isGroundName(entry.name)) {
                continue;
            }
            const refused = judged(rootDir, specsRoot, path, entry.name);
            if (refused === undefined) {
                visit(path, dir === specsRoot && entry.name === SHARED_FOLDER);
            } else {
                found.push(refused);
            }
        }
    };
    visit(specsRoot, false);
    return found;
}

export function checkReservedFolderInClosedList(rootDir: string): Finding[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => refusedUnder(rootDir, specsRoot));
}
