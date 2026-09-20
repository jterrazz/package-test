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
import type { AstNode } from './types.js';

/**
 * What a `vitest.config.*` states about the projects it runs — read once, for
 * the three rules that judge a config against the filesystem (E4w's naming,
 * E7w's dead prefix, E8's literate door).
 *
 * Only the LITERAL form is read. A project produced by a helper (`api()`,
 * `unit({ include })`) already carries the canonical name and include from the
 * framework, so there is nothing for a rule to disagree with; a rule that
 * guessed at a helper's arguments would be judging the framework's own answer.
 */

/** The six facet folders — a first-level name under `specs/` that IS a constructor. */
export const FACETS = new Set(['api', 'cli', 'integration', 'jobs', 'mobile', 'website']);

/** A string literal and the node that carries it, for the diagnostic. */
export type LiteralString = { node: AstNode; value: string };

/** A project literal: what it is called, and what it collects. */
export type ProjectLiteral = {
    include: LiteralString[];
    name?: LiteralString;
    node: AstNode;
};

/** Read a property's string literal, when it is one. */
function literalOf(property: AstNode | undefined): LiteralString | undefined {
    const value = stringValue(child(property, 'value'));
    return property === undefined || value === undefined ? undefined : { node: property, value };
}

/** Read an array-of-strings property, skipping whatever is not a literal. */
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

/** Read one candidate object as a project, when it states an `include`. */
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

/**
 * Every project literal in the config — an object under `test` or in a
 * `projects` array that states its own `include`.
 *
 * The two keys are what makes an `include` a PROJECT's. Vite and Vitest spell
 * several other options with that word — `optimizeDeps.include`,
 * `deps.optimizer.web.include`, a coverage filter — and every one of them lists
 * package specifiers rather than globs over a tree, so an object read by its
 * `include` alone told an author that `react-dom/client` was a folder that does
 * not exist.
 */
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

/** Every character a glob gives a meaning to — a segment holding one is not a path. */
const WILDCARD = /[*?{[(!]/u;

/**
 * The part of a glob that is a PATH — every segment before the first one
 * carrying a wildcard. `specs/api/**\/*.spec.ts` → `specs/api`.
 */
export function staticPrefix(glob: string): string {
    const parts = glob.split('/');
    const wildcard = parts.findIndex((part) => WILDCARD.test(part));
    return (wildcard === -1 ? parts.slice(0, -1) : parts.slice(0, wildcard)).join('/');
}

/**
 * Where an include lands inside the specs tree that owns the config — the
 * segments below the anchor, or `undefined` when it collects outside every
 * tree.
 *
 * The glob is read RELATIVE to the config, and the config's own position is
 * read by the one package-bounded anchor (`specsAnchor`). A checkout that
 * happens to live under a directory named `specs` is not a specs tree, and a
 * config that sits INSIDE one (spwn's `specs/vitest.config.ts`) collects with
 * the tree's root already behind it.
 */
export function collectedSegments(configFile: string, glob: string): string[] | undefined {
    const prefix = staticPrefix(glob)
        .split('/')
        .filter((part) => part !== '' && part !== '.');
    // A glob climbing out of the package belongs to no facet of this tree.
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

/**
 * Does any file under `directory` match this glob?
 *
 * A prefix that exists is not a suite that runs: a glob left naming `.test.ts`
 * after a rename to `.spec.ts` collects NOTHING, the run stays green with
 * fewer files, and the only trace is a number nobody compares. The walk stops
 * at the first match and never enters a package's or a tool's own tree.
 */
export function collectsAFile(directory: string, glob: string): boolean {
    const matcher = globMatcher(glob);
    const walk = (dir: string, depth: number): boolean => {
        if (depth > GLOB_DEPTH) {
            return false;
        }
        for (const name of listDirectory(dir) ?? []) {
            if (SKIPPED_WALK.has(name)) {
                continue;
            }
            const path = join(dir, name);
            if (isDirectory(path)) {
                if (walk(path, depth + 1)) {
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
    return walk(directory, 0);
}

/** Directories a glob walk never enters. */
const SKIPPED_WALK = new Set(['.git', 'dist', 'node_modules']);

/** How deep below an include's prefix the walk looks for one matching file. */
const GLOB_DEPTH = 12;

/**
 * A glob as a regular expression over the tail of a path — `**` crosses
 * separators, `*` and `?` do not, and `{a,b}` is an alternation.
 */
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

/** The facet those segments name, when the first one is a constructor. */
export function facetOfSegments(segments: string[] | undefined): string | undefined {
    const first = segments?.[0];
    return first !== undefined && FACETS.has(first) ? first : undefined;
}

/** Every `literate` block's `specification` literal in the config. */
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
