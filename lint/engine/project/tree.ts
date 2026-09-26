import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { isNode, nodeStart } from './ast.js';
import { treeEntries, treeKind } from './git-tree.js';
import { GROUND_DIRS, isGroundName, SHARED_FOLDER } from './ground.js';
import { parseProgram } from './module-parser.js';
import { literalPathVisitor, visitProgram } from './path-references.js';
import { isRelativePath } from './relative-path.js';
import { isTestFileName } from './role.js';
import { documentPaths, parseSpecDocument, SPEC_EXTENSION } from './spec-document.js';

const PRUNED = new Set(['.git', 'dist', 'node_modules']);

export const GROUND_SUBDIRS = new Set<string>(GROUND_DIRS);

function isSharedFolder(dir: string): boolean {
    return basename(dir) === SHARED_FOLDER && basename(dirname(dir)) === 'specs';
}

function isPool(dir: string): boolean {
    return isGroundName(basename(dir)) && isSharedFolder(dirname(dir));
}

export function specsRootOfPool(pool: string): string {
    return dirname(dirname(pool));
}

/** A fixture project with a `specs/` tree of its own is an input, judged where a spec runs the checker over it. */
function isPruned(dir: string): boolean {
    return PRUNED.has(basename(dir)) || isGroundName(basename(dir)) || isSharedFolder(dir);
}

export function listFiles(dir: string, predicate: (path: string) => boolean): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory()) {
                if (!isPruned(path)) {
                    visit(path);
                }
            } else if (predicate(path)) {
                out.push(path);
            }
        }
    };
    visit(dir);
    return out;
}

export function listDirs(dir: string): string[] {
    const out: string[] = [];
    const visit = (current: string): void => {
        out.push(current);
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(current, entry.name);
            if (entry.isDirectory() && !isPruned(path)) {
                visit(path);
            }
        }
    };
    visit(dir);
    return out;
}

export function findSpecsRoots(dir: string): string[] {
    const roots: string[] = [];
    const visit = (current: string): void => {
        if (basename(current) === 'specs') {
            roots.push(current);
            return;
        }
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory() && !PRUNED.has(entry.name)) {
                visit(join(current, entry.name));
            }
        }
    };
    visit(dir);
    return roots;
}

export function findPools(dir: string): string[] {
    const pools: string[] = [];
    const visit = (current: string): void => {
        let entries;
        try {
            entries = treeEntries(current);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || PRUNED.has(entry.name)) {
                continue;
            }
            const path = join(current, entry.name);
            if (isPool(path)) {
                pools.push(path);
            } else if (!isGroundName(entry.name)) {
                visit(path);
            }
        }
    };
    visit(dir);
    return pools;
}

export function readText(path: string): string {
    try {
        return readFileSync(path, 'utf8');
    } catch {
        return '';
    }
}

/** Newlines survive and strings stay untouched, so offsets and line numbers still hold. */
export function blankComments(text: string): string {
    const out = [...text];
    let state: "'" | '"' | '' | '`' | 'block' | 'line' = '';
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (state === 'line') {
            if (char === '\n') {
                state = '';
            } else {
                out[i] = ' ';
            }
        } else if (state === 'block') {
            if (char === '*' && next === '/') {
                out[i] = ' ';
                out[i + 1] = ' ';
                i += 1;
                state = '';
            } else if (char !== '\n') {
                out[i] = ' ';
            }
        } else if (state === '"' || state === "'" || state === '`') {
            if (char === '\\') {
                i += 1;
            } else if (char === state) {
                state = '';
            }
        } else if (char === '/' && next === '/') {
            out[i] = ' ';
            state = 'line';
        } else if (char === '/' && next === '*') {
            out[i] = ' ';
            state = 'block';
        } else if (char === '"' || char === "'" || char === '`') {
            state = char;
        }
    }
    return out.join('');
}

export function readSource(path: string): string {
    return blankComments(readText(path));
}

/** A document counts: a rendered unit's ARIA golden sits in the same `_expected/` as a spec's. */
export function isReferrer(name: string): boolean {
    return isTestFileName(name) || name.endsWith(SPEC_EXTENSION);
}

export function isDir(path: string): boolean {
    return treeKind(path) === 'directory';
}

function columnAt(text: string, index: number): number {
    return index - text.lastIndexOf('\n', index - 1);
}

export function lineAt(text: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i += 1) {
        if (text[i] === '\n') {
            line += 1;
        }
    }
    return line;
}

export const DISK_CALL =
    /(?<![.\w])(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

export function isConventionalSubdir(path: string): boolean {
    if (!isDir(path)) {
        return false;
    }
    // A real ground folder holds leaf fixtures, never a test nor a nested ground folder.
    const files = listFiles(path, isTestFileName);
    if (files.length > 0) {
        return false;
    }
    let children;
    try {
        children = treeEntries(path);
    } catch {
        return false;
    }
    return !children.some((child) => child.isDirectory() && GROUND_SUBDIRS.has(child.name));
}

type FixtureReference = {
    column: number;
    file: string;
    key?: string;
    kind: 'directory' | 'file';
    line: number;
    path: string;
};

const FIXTURE_CALL =
    /\.fixture\(\s*(?<kind>file|directory)\(\s*(?<quote>['"`])(?<path>(?:[^'"`\\]|\\.)*)\k<quote>/gu;

export function collectFixtureReferences(
    file: string,
    pattern = FIXTURE_CALL,
    codeOnly = false,
): FixtureReference[] {
    if (file.endsWith(SPEC_EXTENSION)) {
        try {
            return documentPaths(parseSpecDocument(readText(file), file)).map(
                ({ key, kind, line, path }) => ({ column: 1, file, key, kind, line, path }),
            );
        } catch {
            return [];
        }
    }
    const text = readSource(file);
    const quoted = codeOnly ? stringMask(text) : [];
    const references: FixtureReference[] = [];
    for (const match of text.matchAll(pattern)) {
        if (quoted[match.index] === true) {
            continue;
        }
        const path = match.groups?.path;
        if (path !== undefined && path.length > 0 && isRelativePath(path) && !path.includes('${')) {
            const at = match.index + match[0].lastIndexOf(`${match.groups?.quote ?? ''}${path}`);
            references.push({
                column: columnAt(text, at),
                file,
                kind: match.groups?.kind === 'directory' ? 'directory' : 'file',
                line: lineAt(text, at),
                path,
            });
        }
    }
    return references;
}

/** A template is read whole as a string: a call inside `${…}` is out of reach. */
function stringMask(text: string): boolean[] {
    const mask: boolean[] = [];
    let quote = '';
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index] ?? '';
        if (quote === '') {
            quote = char === '"' || char === "'" || char === '`' ? char : '';
            mask[index] = quote !== '';
        } else {
            mask[index] = true;
            if (char === '\\') {
                index += 1;
                mask[index] = true;
            } else if (char === quote) {
                quote = '';
            }
        }
    }
    return mask;
}

export function listReferrers(specsRoot: string, pool: string): string[] {
    return listFiles(
        specsRoot,
        (path) => path.endsWith('.ts') || path.endsWith(SPEC_EXTENSION),
    ).filter((file) => !file.startsWith(`${pool}/`) && !file.startsWith(`${pool}\\`));
}

export function removeIfEmpty(folder: string): void {
    if (existsSync(folder) && readdirSync(folder).length === 0) {
        rmSync(folder, { recursive: true });
    }
}

export function isLeaf(directory: string): boolean {
    return treeEntries(directory).some(
        (entry) =>
            entry.isFile() && (isTestFileName(entry.name) || entry.name.endsWith(SPEC_EXTENSION)),
    );
}

/** A lone piece counts only when spelled `./` or `../`: a bare one (`resolve(import.meta.dirname, '../_expected')`) is as often an output folder as a path read; a piece opening on `/` restarts the path. */
export function anchoredPaths(
    file: string,
): { column: number; line: number; named: string; target: string }[] {
    const text = readText(file);
    const program = parseProgram(file, text);
    if (!isNode(program)) {
        return [];
    }
    const found: { column: number; line: number; named: string; target: string }[] = [];
    visitProgram(
        program,
        literalPathVisitor(({ node, pieces }) => {
            const [only] = pieces;
            const lone = pieces.length === 1 && !isRelativePath(only ?? '');
            if (lone || pieces.some((piece) => isAbsolute(piece))) {
                return;
            }
            const at = nodeStart(node);
            found.push({
                column: columnAt(text, at),
                line: lineAt(text, at),
                named: pieces.map((piece) => `'${piece}'`).join(', '),
                target: resolve(dirname(file), ...pieces),
            });
        }),
    );
    return found;
}

export function isWithin(directory: string, path: string): boolean {
    const rest = relative(directory, path);
    return rest !== '' && !rest.startsWith('..') && !isAbsolute(rest);
}

export function lowestCommonFolder(folders: readonly string[]): string | undefined {
    const [first, ...others] = folders;
    if (first === undefined) {
        return undefined;
    }
    let common = first;
    while (!others.every((folder) => folder === common || isWithin(common, folder))) {
        const parent = dirname(common);
        if (parent === common) {
            return undefined;
        }
        common = parent;
    }
    return common;
}

export function reservedFolderOf(specsRoot: string, owner: string, reserved: string): string {
    return owner === specsRoot ? join(specsRoot, SHARED_FOLDER, reserved) : join(owner, reserved);
}

export function decodeText(path: string): null | string {
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return null;
    }
    // A NUL or a U+FFFD replacement char: a binary snapshot carries no token grammar.
    return text.includes('\u0000') || text.includes('\uFFFD') ? null : text;
}
