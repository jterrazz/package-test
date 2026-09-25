import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { basename, dirname, relative, resolve } from 'node:path';

import { parseProgram } from '../src/seams/oxc-parser/parse.js';
import { child, childList, isNode, stringValue, walk } from './ast.js';
import type { AstNode } from './rule-shape.js';
import { SIBLINGLESS_KINDS } from './siblingless-kinds.js';

/**
 * The architecture a facet is composed in, read off the tree: the folders a
 * definition lives in, the definitions each module exports, and what a module
 * loads at any depth. The meta-tests I7 and I8 hold it (`architecture.test.ts`).
 */

/** The folders directly under a tree of `src/`. */
export function foldersOf(root: string, tree: string): string[] {
    return readdirSync(resolve(root, 'src', tree), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .toSorted();
}

/** The modules of every folder of a tree whose name ends in `suffix`, as repository paths. */
export function modulesOf(root: string, tree: string, suffix: string): string[] {
    return foldersOf(root, tree).flatMap((folder) =>
        readdirSync(resolve(root, 'src', tree, folder))
            .filter((name) => name.endsWith(suffix) && !name.endsWith('.test.ts'))
            .map((name) => `src/${tree}/${folder}/${name}`),
    );
}

/**
 * Is the declaration a type only — erased, so it loads nothing? Only an
 * `import type`/`export type` is: under `verbatimModuleSyntax` a declaration
 * whose every specifier is inline-typed compiles to `import {} from '…'`,
 * which still loads its module.
 */
function typeOnly(declaration: AstNode): boolean {
    return declaration.importKind === 'type' || declaration.exportKind === 'type';
}

/**
 * The specifiers a module loads: its value imports, the modules it re-exports
 * from, and every `import('…')` it names by a string, wherever it sits.
 */
function loadedBy(path: string): string[] {
    const program = parseProgram(path, readFileSync(path, 'utf8'));
    if (!isNode(program)) {
        return [];
    }
    const loaded = childList(program, 'body').flatMap((statement) => {
        const source = stringValue(child(statement, 'source'));
        return source !== undefined && !typeOnly(statement) ? [source] : [];
    });
    walk(program, (node) => {
        const source =
            node.type === 'ImportExpression' ? stringValue(child(node, 'source')) : undefined;
        if (source !== undefined) {
            loaded.push(source);
        }
    });
    return loaded;
}

/**
 * Every load that leaves the tree, following the modules' relative imports to
 * any depth: a node builtin, as `<module> imports <builtin>`, and a package —
 * which the walk cannot follow into — as `<module> imports <package>, a package`.
 */
export function outsideLoadsReached(root: string, starts: string[]): string[] {
    const seen = new Set<string>();
    const pending = starts.map((path) => resolve(root, path));
    const found: string[] = [];
    for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
        if (!seen.has(path)) {
            seen.add(path);
            for (const specifier of loadedBy(path)) {
                if (isBuiltin(specifier)) {
                    found.push(`${relative(root, path)} imports ${specifier}`);
                } else if (specifier.startsWith('.')) {
                    const target = resolve(dirname(path), specifier.replace(/\.js$/u, '.ts'));
                    pending.push(existsSync(target) ? target : `${target}x`);
                } else {
                    found.push(`${relative(root, path)} imports ${specifier}, a package`);
                }
            }
        }
    }
    return found.toSorted();
}

/** A definition a module exports, as the kernel reads it. */
export type Definition = { arm?: unknown; kind: string; name: string };

/** Is the value a setup, a sharing or an action definition? */
function isDefinition(value: unknown): value is Definition {
    return (
        typeof value === 'object' &&
        value !== null &&
        'kind' in value &&
        'name' in value &&
        typeof value.name === 'string' &&
        (value.kind === 'setup' || value.kind === 'context' || value.kind === 'action')
    );
}

/** Every definition the modules export, each with the module exporting it. */
export async function definitionsIn(
    root: string,
    paths: string[],
): Promise<{ definition: Definition; path: string }[]> {
    const modules = await Promise.all(
        paths.map(async (path) => {
            const exported: unknown = await import(resolve(root, path));
            return { exported, path };
        }),
    );
    return modules.flatMap(({ exported, path }) =>
        Object.values(typeof exported === 'object' && exported !== null ? exported : {})
            .filter((value) => isDefinition(value))
            .map((definition) => ({ definition, path })),
    );
}

/**
 * What is out of place about one definition, a sentence each: a setup is
 * named for its folder and an action for the folder `actionFolders` gives
 * it; a setup or an action is tested beside its module, unless a kind of
 * `siblingless-kinds.ts` claims that module; a setup names a
 * `<folder>.port.ts` exactly when it arms an engine.
 */
export function straysOf(
    root: string,
    { definition, path }: { definition: Definition; path: string },
    actionFolders: Readonly<Record<string, string>>,
): string[] {
    const folder = basename(dirname(path));
    const owner = definition.kind === 'action' ? actionFolders[definition.name] : definition.name;
    const found: string[] = [];
    if (owner !== folder) {
        found.push(`${path}: ${definition.name} is not ${folder}'s`);
    }
    if (
        definition.kind !== 'context' &&
        !existsSync(resolve(root, path.replace(/\.ts$/u, '.test.ts'))) &&
        !SIBLINGLESS_KINDS.some((kind) => kind.claims(path))
    ) {
        found.push(`${path}: ${definition.name} has no test beside it`);
    }
    const ported = existsSync(resolve(root, dirname(path), `${folder}.port.ts`));
    if (definition.kind === 'setup' && ported !== (definition.arm !== undefined)) {
        found.push(
            `${path}: ${definition.name} ${ported ? 'arms no engine, yet has' : 'arms an engine, yet has no'} ${folder}.port.ts`,
        );
    }
    return found;
}
