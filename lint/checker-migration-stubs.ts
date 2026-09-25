import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { treeEntries, treeKind } from '../src/kernel/files/git-tree.js';
import { isGroundName } from '../src/kernel/files/ground.js';
import { repointSource } from './checker-crossfile.js';

/**
 * The stubs half of the 16 → 17 mover: 16 called a declared reply a
 * CONTRACT, 17 calls it a STUB, and this pass moves a tree across.
 *
 * - every `contracts/` folder takes the name `stubs/` — any one under a
 *   `specs/` tree (C4's layout), and outside one only a folder that holds a
 *   `*.contracts.ts` facade (F2's test of a stubs folder), since a product
 *   may name a folder of its own `contracts/`;
 * - each facade in a moved folder, `<name>.contracts.ts`, takes the name
 *   `<name>.stubs.ts`;
 * - every relative literal that named a moved folder or facade names it
 *   where it went (`./contracts/news.contracts.js` →
 *   `./stubs/news.stubs.js`);
 * - a name 16 published and 17 renamed, imported from the package's entry,
 *   takes its 17 name — at the import and wherever the file uses it; a name
 *   renamed at the import (`defineContract as dc`) changes at the import alone.
 *
 * Every file walked is judged on its own text, so a second run finds nothing
 * to do: 17 publishes none of the 16 names, and no `contracts/` folder is left.
 */

/** The names 16 published for the stub vocabulary → the name 17 publishes. */
const RENAMED_NAMES: Readonly<Record<string, string>> = {
    Contract: 'Stub',
    ContractInput: 'StubInput',
    ContractRequest: 'StubRequest',
    ContractResponder: 'StubResponder',
    ContractResponse: 'StubResponse',
    ContractResponseValue: 'StubResponseValue',
    Contracts: 'Stubs',
    HttpContractFilter: 'HttpStubFilter',
    defineContract: 'defineStub',
    defineContracts: 'defineStubs',
};

/** The folder 16 declared its replies in, and the one 17 does. */
const OLD_FOLDER = 'contracts';
const NEW_FOLDER = 'stubs';

/** A 16 facade: `<name>.contracts.ts`, or a specifier naming one (`.js`, or no extension). */
const OLD_FACADE = /^(?<stem>.+)\.contracts(?<ext>\.[cm]?[jt]s)?$/u;

const SKIPPED = new Set(['.artifacts', '.git', 'coverage', 'dist', 'node_modules']);

/** A source file a relative literal or an entry import may be written in. */
const SOURCE = /\.[cm]?[jt]sx?$/u;

/** A named import, `import type` included — its names and where it comes from. */
const ENTRY_IMPORT =
    /^import(?<kind>\s+type)?\s*\{(?<names>[^}]*)\}\s*from\s*(?<quote>['"])(?<from>[^'"]+)\k<quote>;?/gmu;

/** Is this the specifier of the package's own entry — published, or a repository's source? */
function isEntry(from: string): boolean {
    return from === '@jterrazz/test' || /(?:^|\/)src\/index\.js$/u.test(from);
}

/** What the stubs pass did to a tree, relative to its root. */
export type StubsMigration = { renamed: string[]; rewritten: string[] };

/** A rename, injected so the CLI can keep git's history of what it moves. */
type Rename = (from: string, to: string) => void;

/** Which tree is walked: a `specs/` tree, or a member outside its `specs/`. */
type Scope = 'member' | 'specs';

/** Does this folder hold a 16 facade? */
function holdsFacade(dir: string): boolean {
    return treeEntries(dir).some(
        (entry) => entry.isFile() && OLD_FACADE.test(entry.name) && SOURCE.test(entry.name),
    );
}

/**
 * Walk the tree a pass owns: never ground, never a skipped folder, never a
 * nested package, and — for a member — never its `specs/` tree, the specs
 * pass's own.
 */
function walkTree(
    root: string,
    scope: Scope,
    visit: (path: string, entry: { isDirectory: () => boolean; name: string }) => void,
): void {
    const walk = (dir: string): void => {
        for (const entry of treeEntries(dir)) {
            const path = join(dir, entry.name);
            visit(path, entry);
            const descend =
                entry.isDirectory() &&
                !SKIPPED.has(entry.name) &&
                !isGroundName(entry.name) &&
                !(scope === 'member' && dir === root && entry.name === 'specs') &&
                treeKind(join(path, 'package.json')) !== 'file';
            if (descend) {
                walk(path);
            }
        }
    };
    walk(root);
}

/** Every 16 folder of the tree, deepest first. */
function oldFolders(root: string, scope: Scope): string[] {
    const found: string[] = [];
    walkTree(root, scope, (path, entry) => {
        if (
            entry.isDirectory() &&
            entry.name === OLD_FOLDER &&
            (scope === 'specs' || holdsFacade(path))
        ) {
            found.push(path);
        }
    });
    return found.toSorted((a, b) => b.split(sep).length - a.split(sep).length);
}

/** Every source file of the tree, listed once the folders have moved. */
function sourceFiles(root: string, scope: Scope): string[] {
    const found: string[] = [];
    walkTree(root, scope, (path, entry) => {
        if (!entry.isDirectory() && SOURCE.test(entry.name)) {
            found.push(path);
        }
    });
    return found;
}

/** Is `path` the folder `dir`, or inside it? */
function isWithin(dir: string, path: string): boolean {
    return path === dir || path.startsWith(`${dir}${sep}`);
}

/** A relative path spelled from `from` to `to`, always starting `./` or `../`. */
function pathFrom(from: string, to: string): string {
    const path = relative(from, to).split(sep).join('/');
    return path.startsWith('..') ? path : `./${path}`;
}

/**
 * Where a relative literal written in `dir` points now — through the folder
 * moves, then a facade's 17 name — or `undefined` when it named nothing that moved.
 */
function movedPath(dir: string, path: string, moves: readonly FolderMove[]): string | undefined {
    const reached = resolve(dir, path);
    const move = moves.find(({ from }) => isWithin(from, reached));
    let next = move === undefined ? reached : join(move.to, relative(move.from, reached));
    const facade = OLD_FACADE.exec(basename(next));
    if (facade?.groups !== undefined && moves.some(({ to }) => dirname(next) === to)) {
        next = join(dirname(next), `${facade.groups.stem}.stubs${facade.groups.ext ?? ''}`);
    }
    if (next === reached) {
        return undefined;
    }
    const spelled = pathFrom(dir, next);
    return path.endsWith('/') && !spelled.endsWith('/') ? `${spelled}/` : spelled;
}

/** Escape a name for a `RegExp`. */
function escaped(name: string): string {
    return name.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/** A specifier of a named import: `[type ]Name[ as Local]`. */
const SPECIFIER =
    /(?<lead>\btype\s+)?\b(?<name>[A-Za-z_$][\w$]*)(?<alias>\s+as\s+[A-Za-z_$][\w$]*)?/gu;

/** The groups {@link SPECIFIER} captures. */
type Specifier = { alias?: string; lead?: string; name: string };

/** The specifiers of one import, each 16 name renamed; a name bound as itself is recorded in `used`. */
function renamedSpecifiers(names: string, used: string[]): string {
    return names.replaceAll(SPECIFIER, (specifier: string, ...parts: unknown[]) => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a replacer's last argument IS the groups object SPECIFIER declares
        const { alias, lead, name } = parts.at(-1) as Specifier;
        const next = RENAMED_NAMES[name];
        if (next === undefined) {
            return specifier;
        }
        if (alias === undefined) {
            used.push(name);
        }
        return `${lead ?? ''}${next}${alias ?? ''}`;
    });
}

/**
 * The 16 names the file imports from the entry take their 17 names: in the
 * import, and — for a name the import binds as itself — wherever the file uses it.
 */
function renameEntryNames(text: string): string {
    const used: string[] = [];
    let next = text.replaceAll(ENTRY_IMPORT, (whole: string, ...match: unknown[]) => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a replacer's last argument IS the groups object ENTRY_IMPORT declares
        const { from, names } = match.at(-1) as { from: string; names: string };
        return isEntry(from) ? whole.replace(names, renamedSpecifiers(names, used)) : whole;
    });
    for (const name of used) {
        const usage = new RegExp(String.raw`(?<![\w$.])${escaped(name)}(?![\w$])`, 'gu');
        next = next.replaceAll(usage, RENAMED_NAMES[name] ?? name);
    }
    return next;
}

/** A folder the pass moved: where it stood, and where it went. */
type FolderMove = { from: string; to: string };

/** Rename each 16 folder of the tree `stubs/`, beside it — never over a folder already there. */
function moveFolders(root: string, scope: Scope, rename: Rename, renamed: string[]): FolderMove[] {
    const moves: FolderMove[] = [];
    for (const from of oldFolders(root, scope)) {
        const to = join(dirname(from), NEW_FOLDER);
        if (treeKind(to) === undefined) {
            rename(from, to);
            moves.push({ from, to });
            renamed.push(`${relative(root, from)} → ${relative(root, to)}`);
        }
    }
    return moves;
}

/** Rename each 16 facade a moved folder holds `<name>.stubs.ts` — never over a file already there. */
function renameFacades(root: string, folder: string, rename: Rename, renamed: string[]): void {
    for (const entry of treeEntries(folder)) {
        const facade = entry.isFile() ? OLD_FACADE.exec(entry.name)?.groups : undefined;
        const target =
            facade === undefined
                ? undefined
                : join(folder, `${facade.stem}.stubs${facade.ext ?? ''}`);
        if (target !== undefined && SOURCE.test(entry.name) && treeKind(target) === undefined) {
            rename(join(folder, entry.name), target);
            renamed.push(`${relative(root, join(folder, entry.name))} → ${relative(root, target)}`);
        }
    }
}

/**
 * Move one tree's stub vocabulary to 17: rename its `contracts/` folders and
 * their facades, then rewrite every source file that named one or imports a
 * renamed name from the entry. What moved and what was rewritten are
 * returned relative to `root`.
 */
export function migrateStubs(root: string, scope: Scope, rename: Rename): StubsMigration {
    const migration: StubsMigration = { renamed: [], rewritten: [] };
    const moves = moveFolders(root, scope, rename, migration.renamed);
    for (const { to } of moves) {
        renameFacades(root, to, rename, migration.renamed);
    }
    for (const file of sourceFiles(root, scope)) {
        const text = readFileSync(file, 'utf8');
        const repointed =
            moves.length === 0
                ? text
                : repointSource(file, (path) => movedPath(dirname(file), path, moves));
        const next = renameEntryNames(repointed);
        if (next !== text) {
            writeFileSync(file, next);
            migration.rewritten.push(relative(root, file));
        }
    }
    return migration;
}
