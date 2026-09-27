import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { child, childList, isNode, stringValue, walk } from '../../engine/project/ast.js';
import type { AstNode } from '../../engine/project/ast.js';
import { parseProgram } from '../../engine/project/module-parser.js';
import { SIBLINGLESS_KINDS } from './siblingless-kinds.js';

export function modulesOf(root: string, tree: string, suffix: string): string[] {
    return readdirSync(resolve(root, 'src', tree), { recursive: true, withFileTypes: true })
        .filter(
            (entry) =>
                entry.isFile() && entry.name.endsWith(suffix) && !entry.name.endsWith('.test.ts'),
        )
        .map((entry) => relative(root, join(entry.parentPath, entry.name)))
        .toSorted();
}

/** Only `import type`/`export type` is erased: under `verbatimModuleSyntax` an all-inline-typed import still compiles to `import {} from '…'`, which loads its module. */
function typeOnly(declaration: AstNode): boolean {
    return declaration.importKind === 'type' || declaration.exportKind === 'type';
}

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

/** The rules kit serves a page the half that reads no disk, under its `browser` condition, and the browser build bundles it. */
const LOADS_IN_A_PAGE: ReadonlySet<string> = new Set(['@jterrazz/typescript/rules']);

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
                } else if (!LOADS_IN_A_PAGE.has(specifier)) {
                    found.push(`${relative(root, path)} imports ${specifier}, a package`);
                }
            }
        }
    }
    return found.toSorted();
}

export type Definition = { arm?: unknown; kind: string; name: string };

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

export function straysOf(
    root: string,
    { definition, path }: { definition: Definition; path: string },
    actionModules: Readonly<Record<string, string>>,
): string[] {
    const module = basename(path).replace(/\.(?:capability|action)\.ts$/u, '');
    const owner = definition.kind === 'action' ? actionModules[definition.name] : definition.name;
    const found: string[] = [];
    if (owner !== module) {
        found.push(`${path}: ${definition.name} is not ${module}'s`);
    }
    if (
        definition.kind !== 'context' &&
        !existsSync(resolve(root, path.replace(/\.ts$/u, '.test.ts'))) &&
        !SIBLINGLESS_KINDS.some((kind) => kind.claims(path))
    ) {
        found.push(`${path}: ${definition.name} has no test beside it`);
    }
    const ported = existsSync(resolve(root, dirname(path), `${module}.port.ts`));
    if (definition.kind === 'setup' && ported !== (definition.arm !== undefined)) {
        found.push(
            `${path}: ${definition.name} ${ported ? 'arms no adapter, yet has' : 'arms an adapter, yet has no'} ${module}.port.ts`,
        );
    }
    return found;
}
