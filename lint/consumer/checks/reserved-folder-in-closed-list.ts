import { basename, dirname, join, relative } from 'node:path';

import { treeEntries } from '../../engine/project/git-tree.js';
import {
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundName,
    isReservedName,
    RESERVED_FOLDERS,
    SETUP_FOLDER,
    SHARED_FOLDER,
    UNMARKED_RESERVED,
} from '../../engine/project/ground.js';
import { isModuleName, isUnmarkedReserved, PRUNED } from '../../engine/project/specs-modules.js';
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
    if ((name === SHARED_FOLDER || name === 'shared') && !atRoot) {
        if (name === SHARED_FOLDER || isUnmarkedReserved(specsRoot, folder)) {
            return finding(
                rootDir,
                folder,
                `\`${name}/\` below the specs root`,
                `move what it holds into the reserved folders of \`${relative(specsRoot, dirname(folder))}/\` itself — what a folder's leaves share sits in that folder's \`${SETUP_FOLDER}/\` or ground; \`${SHARED_FOLDER}/\` exists only as \`specs/${SHARED_FOLDER}/\`, for what facets share`,
            );
        }
        return undefined;
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

const DECLARATION = /\.d\.[cm]?ts$/u;

function groundOfRole(name: string): string {
    if (name.endsWith('.sql')) {
        return GROUND_SEEDS;
    }
    return name.endsWith('.http') ? GROUND_REQUESTS : GROUND_FIXTURES;
}

function ownerShown(specsRoot: string, setup: string): string {
    const owner = relative(specsRoot, dirname(setup));
    return owner === '' ? 'specs' : `specs/${owner}`;
}

type Place = { rootDir: string; specsRoot: string };

function entriesOf(dir: string): ReturnType<typeof treeEntries> {
    try {
        return treeEntries(dir);
    } catch {
        return [];
    }
}

function refusedInSetup(
    { rootDir, specsRoot }: Place,
    setup: string,
    path: string,
    isDirectory: boolean,
): Finding | undefined {
    const name = basename(path);
    const owner = ownerShown(specsRoot, setup);
    if (isDirectory && isGroundName(name)) {
        return finding(
            rootDir,
            path,
            `\`${name}/\` inside a \`${SETUP_FOLDER}/\`, which holds code alone`,
            `move it beside that \`${SETUP_FOLDER}/\`, to \`${owner}/${name}/\`, and the paths that name what it holds`,
        );
    }
    if (isDirectory || isModuleName(name) || DECLARATION.test(name)) {
        return undefined;
    }
    const role = groundOfRole(name);
    return finding(
        rootDir,
        path,
        `\`${name}\` inside a \`${SETUP_FOLDER}/\`, data where code alone belongs`,
        `move it into the ground of its role beside that \`${SETUP_FOLDER}/\` — \`${owner}/${role}/${name}\`, or \`${owner}/${GROUND_EXPECTED}/${name}\` when a test compares against it — and the paths that import or name it`,
    );
}

function refusedInsideSetup(place: Place, setup: string): Finding[] {
    const found: Finding[] = [];
    const visit = (dir: string): void => {
        for (const entry of entriesOf(dir)) {
            if (PRUNED.has(entry.name)) {
                continue;
            }
            const path = join(dir, entry.name);
            const refused = refusedInSetup(place, setup, path, entry.isDirectory());
            if (refused !== undefined) {
                found.push(refused);
            } else if (entry.isDirectory()) {
                visit(path);
            }
        }
    };
    visit(setup);
    return found;
}

function refusedUnder(rootDir: string, specsRoot: string): Finding[] {
    const found: Finding[] = [];
    const visit = (dir: string, inShared: boolean): void => {
        for (const entry of entriesOf(dir)) {
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
            if (refused !== undefined) {
                found.push(refused);
            } else if (entry.name === SETUP_FOLDER) {
                found.push(...refusedInsideSetup({ rootDir, specsRoot }, path));
            } else {
                visit(path, dir === specsRoot && entry.name === SHARED_FOLDER);
            }
        }
    };
    visit(specsRoot, false);
    return found;
}

export function checkReservedFolderInClosedList(rootDir: string): Finding[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => refusedUnder(rootDir, specsRoot));
}
