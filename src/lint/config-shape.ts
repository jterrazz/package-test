import { child, childList, findProperty, propertyKeyName, stringValue, walk } from './ast.js';
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

/** Every project literal in the config — an object stating its own `include`. */
export function projectLiterals(program: AstNode): ProjectLiteral[] {
    const projects: ProjectLiteral[] = [];
    walk(program, (node) => {
        if (node.type !== 'ObjectExpression') {
            return;
        }
        const includeProperty = findProperty(node, 'include');
        if (includeProperty === undefined) {
            return;
        }
        const name = literalOf(findProperty(node, 'name'));
        projects.push({
            include: literalsOf(includeProperty),
            node,
            ...(name === undefined ? {} : { name }),
        });
    });
    return projects;
}

/**
 * The part of a glob that is a PATH — every segment before the first one
 * carrying a wildcard. `specs/api/**\/*.spec.ts` → `specs/api`.
 */
export function staticPrefix(glob: string): string {
    const parts = glob.split('/');
    const wildcard = parts.findIndex((part) => part.includes('*') || part.includes('?'));
    return (wildcard === -1 ? parts.slice(0, -1) : parts.slice(0, wildcard)).join('/');
}

/**
 * The facet a path collects, read the way the tree states it: the segment
 * following the nearest ancestor directory named `specs`.
 */
export function facetOfPath(path: string): string | undefined {
    const parts = path.split(/[/\\]/u).filter(Boolean);
    const specs = parts.lastIndexOf('specs');
    if (specs === -1) {
        return undefined;
    }
    const next = parts[specs + 1];
    return next !== undefined && FACETS.has(next) ? next : undefined;
}

/** Is the path inside a `specs/` tree at all? */
export function underSpecs(path: string): boolean {
    return path.split(/[/\\]/u).includes('specs');
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
