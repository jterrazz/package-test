import {
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundFolder,
    PRUNED,
    SETUP_FOLDER,
    SPECIAL_FOLDERS,
} from '@jterrazz/typescript/rules';
import { basename, dirname, join, relative } from 'node:path';

import { entriesOf } from '../../kit/project/specification-folders.js';
import {
    isModuleName,
    isRetiredShared,
    renamedSpecialOf,
} from '../../kit/project/specs-modules.js';
import { findSpecsRoots, isDir } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

const CLOSED_LIST = SPECIAL_FOLDERS.map((name) => `\`${name}/\``).join(', ');

function finding(rootDir: string, path: string, found: string, fix: string): Spotted {
    return {
        path: isDir(path) ? `${relative(rootDir, path)}/` : relative(rootDir, path),
        line: 1,
        fix,
        found,
        rule: 'reserved-folder-in-closed-list',
    };
}

function shownFolder(specsRoot: string, folder: string): string {
    const owner = relative(specsRoot, folder);
    return owner === '' ? 'specs/' : `specs/${owner}/`;
}

// invariant: a `_` name is the closed-list rule's; a bare name is judged here, where the tree tells a subject from a special folder spelt without its marks.
function judged(
    rootDir: string,
    specsRoot: string,
    folder: string,
    name: string,
): Spotted | undefined {
    if (name.startsWith('_')) {
        return undefined;
    }
    if (isRetiredShared(specsRoot, folder)) {
        return finding(
            rootDir,
            folder,
            `\`${name}/\`, a folder of what several specifications share, and no subject: it holds no spec`,
            `move what it holds into the special folders of \`${shownFolder(specsRoot, dirname(folder))}\` itself — what the leaves of a folder share sits in that folder's \`${SETUP_FOLDER}/\` or ground, \`specs/${SETUP_FOLDER}/\` and the ground at the specs root for what specifications share`,
        );
    }
    const renamed = renamedSpecialOf(specsRoot, folder);
    if (renamed === undefined) {
        return undefined;
    }
    return finding(
        rootDir,
        folder,
        `\`${name}/\`, a special folder spelt without its marks, and no subject: it holds no spec`,
        name === 'doubles'
            ? `move its modules into \`${SETUP_FOLDER}/\`, each test adapter named for the port it replaces (\`<port>.adapter.ts\`), and the paths that import them`
            : `rename it \`${renamed}/\`, and the paths that name it`,
    );
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

function refusedInSetup(
    { rootDir, specsRoot }: Place,
    setup: string,
    path: string,
    isDirectory: boolean,
): Spotted | undefined {
    const name = basename(path);
    const owner = ownerShown(specsRoot, setup);
    if (isDirectory && isGroundFolder(name)) {
        return finding(
            rootDir,
            path,
            `\`${name}/\` inside a \`${SETUP_FOLDER}/\`, which holds code alone`,
            `move it beside that \`${SETUP_FOLDER}/\`, to \`${owner}/${name}/\`, and the paths that name what it holds`,
        );
    }
    if (isDirectory && name.startsWith('_')) {
        return finding(
            rootDir,
            path,
            `\`${name}/\` inside a \`${SETUP_FOLDER}/\`, where every folder is the code's own`,
            `drop the \`_\` and name it for what it holds — the special folders, ${CLOSED_LIST}, sit beside a \`${SETUP_FOLDER}/\`, never inside it`,
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

function refusedInsideSetup(place: Place, setup: string): Spotted[] {
    const found: Spotted[] = [];
    const visit = (dir: string): void => {
        for (const entry of entriesOf(dir)) {
            if (PRUNED.has(entry.name)) {
                continue;
            }
            const path = join(dir, entry.name);
            const refused = refusedInSetup(place, setup, path, entry.isDirectory());
            // invariant: a file is walked as a folder of nothing.
            if (refused === undefined) {
                visit(path);
            } else {
                found.push(refused);
            }
        }
    };
    visit(setup);
    return found;
}

function refusedUnder(rootDir: string, specsRoot: string): Spotted[] {
    const found: Spotted[] = [];
    const visit = (dir: string): void => {
        for (const entry of entriesOf(dir)) {
            if (!entry.isDirectory() || PRUNED.has(entry.name) || isGroundFolder(entry.name)) {
                continue;
            }
            const path = join(dir, entry.name);
            const refused = judged(rootDir, specsRoot, path, entry.name);
            if (refused !== undefined) {
                found.push(refused);
            } else if (entry.name === SETUP_FOLDER) {
                found.push(...refusedInsideSetup({ rootDir, specsRoot }, path));
            } else {
                visit(path);
            }
        }
    };
    visit(specsRoot);
    return found;
}

export function checkReservedFolderInClosedList(rootDir: string): Spotted[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => refusedUnder(rootDir, specsRoot));
}
