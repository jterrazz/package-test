import { join } from 'node:path';

import {
    child,
    childList,
    findProperty,
    propertyKeyName,
    specsAnchor,
    stringValue,
    walk,
} from './ast.js';
import { isDirectory, listDirectory } from './fs-cache.js';
import type { AstNode } from './rule-shape.js';

/** Only the literal form is read: a project a helper builds carries the framework's canonical name and include, with nothing to disagree with. */

export const FACETS = new Set(['api', 'cli', 'integration', 'job', 'mobile', 'website']);

export type LiteralString = { node: AstNode; value: string };

export type ProjectLiteral = {
    include: LiteralString[];
    name?: LiteralString;
    node: AstNode;
};

function literalOf(property: AstNode | undefined): LiteralString | undefined {
    const value = stringValue(child(property, 'value'));
    return property === undefined || value === undefined ? undefined : { node: property, value };
}

function literalsOf(property: AstNode | undefined): LiteralString[] {
    const value = child(property, 'value');
    if (value?.type !== 'ArrayExpression') {
        return [];
    }
    const found: LiteralString[] = [];
    for (const element of childList(value, 'elements')) {
        const text = stringValue(element);
        if (text !== undefined) {
            found.push({ node: element, value: text });
        }
    }
    return found;
}

function projectOf(node: AstNode | undefined): ProjectLiteral | undefined {
    if (node?.type !== 'ObjectExpression') {
        return undefined;
    }
    const includeProperty = findProperty(node, 'include');
    if (includeProperty === undefined) {
        return undefined;
    }
    const name = literalOf(findProperty(node, 'name'));
    return {
        include: literalsOf(includeProperty),
        node,
        ...(name === undefined ? {} : { name }),
    };
}

/** Only under `test` or in `projects`: `optimizeDeps.include` and its kin list package specifiers, not globs over a tree. */
export function projectLiterals(program: AstNode): ProjectLiteral[] {
    const projects: ProjectLiteral[] = [];
    walk(program, (node) => {
        if (node.type !== 'Property') {
            return;
        }
        const key = propertyKeyName(node);
        const value = child(node, 'value');
        const candidates =
            key === 'projects'
                ? childList(value, 'elements')
                : key === 'test'
                  ? [value]
                  : ([] as (AstNode | undefined)[]);
        for (const candidate of candidates) {
            const project = projectOf(candidate);
            if (project !== undefined) {
                projects.push(project);
            }
        }
    });
    return projects;
}

const WILDCARD = /[*?{[(!]/u;

const SKIPPED_WALK = new Set(['.git', 'dist', 'node_modules']);

const GLOB_DEPTH = 12;

/** `specs/api/**\/*.spec.ts` → `specs/api`. */
export function staticPrefix(glob: string): string {
    const parts = glob.split('/');
    const wildcard = parts.findIndex((part) => WILDCARD.test(part));
    return (wildcard === -1 ? parts.slice(0, -1) : parts.slice(0, wildcard)).join('/');
}

/** The glob is read relative to the config, whose own position comes from the package-bounded `specsAnchor`: a config inside a tree (`specs/vitest.config.ts`) collects with the root already behind it. */
export function collectedSegments(configFile: string, glob: string): string[] | undefined {
    const prefix = staticPrefix(glob)
        .split('/')
        .filter((part) => part !== '' && part !== '.');
    if (prefix.includes('..')) {
        return undefined;
    }
    const specs = prefix.lastIndexOf('specs');
    if (specs !== -1) {
        return prefix.slice(specs + 1);
    }
    const anchor = specsAnchor(configFile);
    if (anchor === undefined) {
        return undefined;
    }
    return [...anchor.relative.slice(0, -1), ...prefix];
}

/** A prefix that exists is not a suite that runs: a glob left naming `.test.ts` after a rename collects nothing and the run stays green. */
export function collectsAFile(directory: string, glob: string): boolean {
    const matcher = globMatcher(glob);
    const search = (dir: string, depth: number): boolean => {
        if (depth > GLOB_DEPTH) {
            return false;
        }
        for (const name of listDirectory(dir) ?? []) {
            if (SKIPPED_WALK.has(name)) {
                continue;
            }
            const path = join(dir, name);
            if (isDirectory(path)) {
                if (search(path, depth + 1)) {
                    return true;
                }
                continue;
            }
            if (matcher.test(path)) {
                return true;
            }
        }
        return false;
    };
    return search(directory, 0);
}

/** `**` crosses separators, `*` and `?` do not, `{a,b}` alternates. */
function globMatcher(glob: string): RegExp {
    let source = '';
    for (let index = 0; index < glob.length; index += 1) {
        const character = glob[index] ?? '';
        if (character === '*') {
            const double = glob[index + 1] === '*';
            source += double ? '.*' : '[^/]*';
            index += double ? 1 : 0;
            continue;
        }
        source +=
            character === '?'
                ? '[^/]'
                : character === '{'
                  ? '('
                  : character === '}'
                    ? ')'
                    : character === ','
                      ? '|'
                      : character.replaceAll(/[.+^$()|[\]\\]/gu, String.raw`\$&`);
    }
    return new RegExp(`(?:^|/)${source}$`, 'u');
}

export function facetOfSegments(segments: string[] | undefined): string | undefined {
    const first = segments?.[0];
    return first !== undefined && FACETS.has(first) ? first : undefined;
}

export function literateSpecifications(program: AstNode): LiteralString[] {
    const found: LiteralString[] = [];
    walk(program, (node) => {
        if (node.type !== 'Property' || propertyKeyName(node) !== 'literate') {
            return;
        }
        const value = child(node, 'value');
        if (value === undefined) {
            return;
        }
        const specification = literalOf(findProperty(value, 'specification'));
        if (specification !== undefined) {
            found.push(specification);
        }
    });
    return found;
}
