import { isDirectory, listDirectory } from '@jterrazz/typescript/rules';
import { join } from 'node:path';

import { child, childList, findProperty, propertyKeyName, stringValue, walk } from './ast.js';
import type { AstNode } from './ast.js';
import { SPECIFICATIONS } from './specifications.js';
import { specsAnchor } from './specs-anchor.js';

/** Only the literal form is read: a project a helper builds carries the framework's canonical include, with nothing to disagree with. */

export type LiteralString = { node: AstNode; value: string };

function literalOf(property: AstNode | undefined): LiteralString | undefined {
    const value = stringValue(child(property, 'value'));
    // Stryker disable next-line ConditionalExpression: a property that is absent has no value either
    return property === undefined || value === undefined ? undefined : { node: property, value };
}

/** Only under `test` or in `projects`, listed or keyed: `optimizeDeps.include` and its kin list package specifiers, not globs over a tree. */
export function includedGlobs(program: AstNode): LiteralString[] {
    const globs: LiteralString[] = [];
    walk(program, (node) => {
        const key = propertyKeyName(node);
        if (key !== 'projects' && key !== 'test') {
            return;
        }
        const value = child(node, 'value');
        // invariant: `projects` is a vitest list in a vitest config, a record keyed by specification in `jterrazz.config.ts`.
        const projects =
            key === 'test'
                ? [value]
                : [
                      ...childList(value, 'elements'),
                      ...childList(value, 'properties').map((property) => child(property, 'value')),
                  ];
        for (const project of projects) {
            const include = child(findProperty(project, 'include'), 'value');
            for (const element of childList(include, 'elements')) {
                const text = stringValue(element);
                if (text !== undefined) {
                    globs.push({ node: element, value: text });
                }
            }
        }
    });
    return globs;
}

const WILDCARD = /[*?{[(!]/u;

const SKIPPED_WALK = new Set(['.git', 'dist', 'node_modules']);

const GLOB_DEPTH = 12;

/** `specs/api/**\/*.spec.ts` gives `specs/api`. */
export function staticPrefix(glob: string): string {
    const parts = glob.split('/');
    // invariant: a glob with no wildcard finds -1, which drops its file name
    return parts
        .slice(
            0,
            parts.findIndex((part) => WILDCARD.test(part)),
        )
        .join('/');
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

const GLOB_SYNTAX: Readonly<Record<string, string>> = {
    '*': '[^/]*',
    '**': '.*',
    ',': '|',
    '?': '[^/]',
    '{': '(',
    '}': ')',
};

// outside: `**` crosses separators, `*` and `?` do not, `{a,b}` alternates.
function globMatcher(glob: string): RegExp {
    const source = glob.replaceAll(
        /\*\*|[*?{},]|[.+^$()|[\]\\]/gu,
        (token) => GLOB_SYNTAX[token] ?? `\\${token}`,
    );
    // Stryker disable next-line StringLiteral: a glob's syntax is ASCII, which reads alike with or without the unicode flag
    return new RegExp(`(?:^|/)${source}$`, 'u');
}

export function specificationOfSegments(segments: string[] | undefined): string | undefined {
    const first = segments?.[0];
    return (SPECIFICATIONS as ReadonlySet<unknown>).has(first) ? first : undefined;
}

export function literateRunners(program: AstNode): LiteralString[] {
    const found: LiteralString[] = [];
    walk(program, (node) => {
        if (propertyKeyName(node) !== 'literate') {
            return;
        }
        const runner = literalOf(findProperty(child(node, 'value'), 'runner'));
        if (runner !== undefined) {
            found.push(runner);
        }
    });
    return found;
}
