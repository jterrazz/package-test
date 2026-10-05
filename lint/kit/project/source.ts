import { GROUND_FOLDERS, treeEntries } from '@jterrazz/typescript/rules';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';

import type { Spotted } from '../checker/registry.js';
import { child, childList, isNode, nodeStart, stringValue, walk } from './ast.js';
import type { AstNode } from './ast.js';
import { parseProgram } from './module-parser.js';

const GROUND = new Set<string>(GROUND_FOLDERS);

export type Listed = { directory: boolean; path: string };

/** Read off the tree git does not ignore; a root with no `src/` holds nothing to judge. */
export function listed(dir: string, at: string): Listed[] {
    if (!existsSync(dir)) {
        return [];
    }
    const paths: Listed[] = [];
    for (const entry of treeEntries(dir)) {
        const path = `${at}/${entry.name}`;
        paths.push({ directory: entry.isDirectory(), path });
        if (entry.isDirectory()) {
            paths.push(...listed(join(dir, entry.name), path));
        }
    }
    return paths;
}

export function inGround(path: string): boolean {
    return path.split('/').some((segment) => GROUND.has(segment));
}

export function specificationOf(path: string): string | undefined {
    const [source, tree, specification, below] = path.split('/');
    return source === 'src' && tree === 'specifications' && below !== undefined
        ? specification
        : undefined;
}

const AT_ITS_TOP = { column: 1, line: 1 };

export function finding<PassId extends string>(
    rule: PassId,
    path: string,
    teaching: Pick<Spotted, 'fix' | 'found'>,
    at: { column: number; line: number } = AT_ITS_TOP,
): Spotted<PassId> {
    return { ...teaching, ...at, path, rule };
}

export function byPosition(one: Spotted, other: Spotted): number {
    return (
        one.path.localeCompare(other.path) ||
        one.line - other.line ||
        (one.column ?? 1) - (other.column ?? 1)
    );
}

export const TEST_SUFFIX = /\.(?:test|test-d|fixtures)\.tsx?$/u;

export function isProduction(path: string): boolean {
    return /\.tsx?$/u.test(path) && !TEST_SUFFIX.test(path) && !inGround(path);
}

type Reference = { column: number; line: number; specifier: string };

function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, Math.max(index, 0));
    return { column: index - before.lastIndexOf('\n'), line: before.split('\n').length };
}

function referencesOf(path: string): Reference[] {
    const text = readFileSync(path, 'utf8');
    const program = parseProgram(path, text);
    if (!isNode(program)) {
        return [];
    }
    const found: Reference[] = [];
    const add = (node: AstNode, specifier: string | undefined): void => {
        if (specifier !== undefined) {
            found.push({ ...positionOf(text, nodeStart(node)), specifier });
        }
    };
    for (const statement of childList(program, 'body')) {
        add(statement, stringValue(child(statement, 'source')));
    }
    walk(program, (node) => {
        if (node.type === 'ImportExpression') {
            add(node, stringValue(child(node, 'source')));
        }
    });
    return found;
}

/** Its `.js` read as the `.ts` it is built from. */
export function targetOf(from: string, specifier: string): string {
    return posix.normalize(posix.join(posix.dirname(from), specifier)).replace(/\.js$/u, '.ts');
}

export function productionReferences(root: string): { from: string; reference: Reference }[] {
    return [...listed(resolve(root, 'src'), 'src'), ...listed(resolve(root, 'lint'), 'lint')]
        .filter(({ directory, path }) => !directory && isProduction(path))
        .flatMap(({ path: from }) =>
            referencesOf(resolve(root, from)).map((reference) => ({ from, reference })),
        );
}
