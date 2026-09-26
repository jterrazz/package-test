import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import { treeEntries, treeKind } from '../../src/kernel/files/git-tree.js';
import { isGroundName } from '../../src/kernel/files/ground.js';
import { repointSource } from '../checks/crossfile.js';

/** 16 called a declared reply a contract, 17 calls it a stub. Outside a `specs/` tree only a folder holding a `*.contracts.ts` facade moves, since a product may name a folder `contracts/`; each file is judged on its own text, so a second run finds nothing to do. */

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

const OLD_FOLDER = 'contracts';
const NEW_FOLDER = 'stubs';

const OLD_FACADE = /^(?<stem>.+)\.contracts(?<ext>\.[cm]?[jt]s)?$/u;

const SKIPPED = new Set(['.artifacts', '.git', 'coverage', 'dist', 'node_modules']);

const SOURCE = /\.[cm]?[jt]sx?$/u;

const ENTRY_IMPORT =
    /^import(?<kind>\s+type)?\s*\{(?<names>[^}]*)\}\s*from\s*(?<quote>['"])(?<from>[^'"]+)\k<quote>;?/gmu;

function isEntry(from: string): boolean {
    return from === '@jterrazz/test' || /(?:^|\/)src\/index\.js$/u.test(from);
}

export type StubsMigration = { renamed: string[]; rewritten: string[] };

/** Injected so the CLI keeps git's history of what it moves. */
type Rename = (from: string, to: string) => void;

type Scope = 'member' | 'specs';

function holdsFacade(dir: string): boolean {
    return treeEntries(dir).some(
        (entry) => entry.isFile() && OLD_FACADE.test(entry.name) && SOURCE.test(entry.name),
    );
}

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

function sourceFiles(root: string, scope: Scope): string[] {
    const found: string[] = [];
    walkTree(root, scope, (path, entry) => {
        if (!entry.isDirectory() && SOURCE.test(entry.name)) {
            found.push(path);
        }
    });
    return found;
}

function isWithin(dir: string, path: string): boolean {
    return path === dir || path.startsWith(`${dir}${sep}`);
}

function pathFrom(from: string, to: string): string {
    const path = relative(from, to).split(sep).join('/');
    return path.startsWith('..') ? path : `./${path}`;
}

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

function escaped(name: string): string {
    return name.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

const SPECIFIER =
    /(?<lead>\btype\s+)?\b(?<name>[A-Za-z_$][\w$]*)(?<alias>\s+as\s+[A-Za-z_$][\w$]*)?/gu;

type Specifier = { alias?: string; lead?: string; name: string };

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

/** A name the import renames (`defineContract as dc`) changes at the import alone. */
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

type FolderMove = { from: string; to: string };

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
