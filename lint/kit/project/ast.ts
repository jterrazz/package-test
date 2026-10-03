import { isProjectRoot } from '@jterrazz/typescript/rules';
import type { AfterHook, BeforeHook, Comment, Node } from '@oxlint/plugins';
import { basename, dirname } from 'node:path';

/** A rule reads a node by its `type` and span and every other field defensively, decoupled from the generated ESTree union. The published declarations import `@oxlint/plugins`, so it is a dependency. */

export type AstNode = Node & { type: string; [key: string]: unknown };

export type Visitor = Record<string, (node: AstNode) => void> & {
    after?: AfterHook;
    before?: BeforeHook;
};

export function segments(path: string): string[] {
    return path.split(/[/\\]/u).filter(Boolean);
}

export type SpecsAnchor = {
    directory: string;
    /** `[facet, domain, basename]`. */
    relative: string[];
};

/** The NEAREST `specs` ancestor, never above the project root: a checkout living under `~/specs/` must not read as one whole specs tree. */
export function specsAnchor(filename: string): SpecsAnchor | undefined {
    const relative = [basename(filename)];
    let directory = dirname(filename);
    for (;;) {
        if (basename(directory) === 'specs') {
            return { directory, relative };
        }
        if (isProjectRoot(directory)) {
            return undefined;
        }
        const parent = dirname(directory);
        if (parent === directory) {
            return undefined;
        }
        relative.unshift(basename(directory));
        directory = parent;
    }
}

export function isUnderSpecs(filename: string): boolean {
    return specsAnchor(filename) !== undefined;
}

export function stringValue(node: AstNode | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    if (node.type === 'TemplateLiteral') {
        const expressions = childList(node, 'expressions');
        const quasis = childList(node, 'quasis');
        const [onlyQuasi] = quasis;
        const value = onlyQuasi?.value;
        if (
            expressions.length === 0 &&
            quasis.length === 1 &&
            typeof value === 'object' &&
            value !== null &&
            'cooked' in value
        ) {
            return typeof value.cooked === 'string' ? value.cooked : undefined;
        }
    }
    return undefined;
}

export function memberPropertyName(node: AstNode): string | undefined {
    if (node.type !== 'MemberExpression' || node.computed === true) {
        return undefined;
    }
    const property = child(node, 'property');
    return property?.type === 'Identifier' ? (stringField(property, 'name') ?? '') : undefined;
}

/** `dockerCli.fixture(x).exec(y)` → `dockerCli`. */
export function chainRootName(node: AstNode | undefined): string | undefined {
    let current = node;
    while (current !== undefined) {
        if (current.type === 'Identifier') {
            return stringField(current, 'name') ?? '';
        }
        if (current.type === 'MemberExpression') {
            current = child(current, 'object');
        } else if (current.type === 'CallExpression') {
            current = child(current, 'callee');
        } else if (current.type === 'AwaitExpression' || current.type === 'ChainExpression') {
            current = child(current, 'argument') ?? child(current, 'expression');
        } else {
            return undefined;
        }
    }
    return undefined;
}

export function specificationMember(callNode: AstNode): string | undefined {
    const callee = child(callNode, 'callee');
    if (callee?.type !== 'MemberExpression') {
        return undefined;
    }
    const object = child(callee, 'object');
    if (object?.type !== 'Identifier' || object.name !== 'specification') {
        return undefined;
    }
    return memberPropertyName(callee);
}

export function findProperty(objectNode: AstNode, name: string): AstNode | undefined {
    if (objectNode.type !== 'ObjectExpression') {
        return undefined;
    }
    const properties = childList(objectNode, 'properties');
    return properties.find((property) => propertyKeyName(property) === name);
}

export function propertyKeyName(property: AstNode): string | undefined {
    if (property.type !== 'Property' || property.computed === true) {
        return undefined;
    }
    const key = child(property, 'key');
    if (key?.type === 'Identifier') {
        return stringField(key, 'name') ?? '';
    }
    if (key?.type === 'Literal') {
        return String(key.value);
    }
    return undefined;
}

export function walk(root: AstNode, visit: (node: AstNode) => void): void {
    visit(root);
    for (const key of Object.keys(root)) {
        if (key === 'parent') {
            continue;
        }
        const value = root[key];
        if (Array.isArray(value)) {
            for (const item of value) {
                if (isNode(item)) {
                    walk(item, visit);
                }
            }
        } else if (isNode(value)) {
            walk(value, visit);
        }
    }
}

type Positioned = AstNode | Comment;

export function nodeStart(node: Positioned | undefined): number {
    if (node === undefined) {
        return -1;
    }
    if (typeof node.start === 'number') {
        return node.start;
    }
    const range = node.range as number[] | undefined;
    return Array.isArray(range) && typeof range[0] === 'number' ? range[0] : -1;
}

export function isNode(value: unknown): value is AstNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        typeof value.type === 'string'
    );
}

export function child(node: AstNode | undefined, key: string): AstNode | undefined {
    const value = node?.[key];
    return isNode(value) ? value : undefined;
}

export function childList(node: AstNode | undefined, key: string): AstNode[] {
    const value = node?.[key];
    return Array.isArray(value) ? value.filter((item) => isNode(item)) : [];
}

export function stringField(node: AstNode | undefined, key: string): string | undefined {
    const value = node?.[key];
    return typeof value === 'string' ? value : undefined;
}

export function identifierName(node: AstNode | undefined): string | undefined {
    if (node?.type !== 'Identifier') {
        return undefined;
    }
    const { name } = node;
    return typeof name === 'string' ? name : undefined;
}

export function nodeEnd(node: Positioned | undefined): number {
    if (node === undefined) {
        return -1;
    }
    if (typeof node.end === 'number') {
        return node.end;
    }
    const range = node.range as number[] | undefined;
    return Array.isArray(range) && typeof range[1] === 'number' ? range[1] : -1;
}

/** `result.stdout`, `result.meta()`; `undefined` for a computed access: two subjects a rule cannot spell must never be equated. */
export function memberPath(node: AstNode | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }
    if (node.type === 'Identifier') {
        return identifierName(node);
    }
    if (node.type === 'CallExpression') {
        const callee = memberPath(child(node, 'callee'));
        return callee === undefined || childList(node, 'arguments').length > 0
            ? undefined
            : `${callee}()`;
    }
    if (node.type !== 'MemberExpression') {
        return undefined;
    }
    const object = memberPath(child(node, 'object'));
    const property = memberPropertyName(node);
    return object === undefined || property === undefined ? undefined : `${object}.${property}`;
}

/** `new Date()` with an argument is pinned; its zero-argument form, `Date.now()`, `performance.now()`, `Math.random()` and `randomUUID()` answer differently on the next run. */
export function isSampledValue(node: AstNode): boolean {
    if (node.type === 'NewExpression') {
        return (
            identifierName(child(node, 'callee')) === 'Date' &&
            childList(node, 'arguments').length === 0
        );
    }
    if (node.type !== 'CallExpression') {
        return false;
    }
    const path = memberPath(child(node, 'callee'));
    if (path === undefined) {
        return false;
    }
    return (
        path === 'Date.now' ||
        path === 'performance.now' ||
        path === 'Math.random' ||
        path === 'randomUUID' ||
        path.endsWith('.randomUUID')
    );
}

export function unwrapped(node: AstNode | undefined): AstNode | undefined {
    return node?.type === 'TSAsExpression' ||
        node?.type === 'TSSatisfiesExpression' ||
        node?.type === 'ParenthesizedExpression'
        ? unwrapped(child(node, 'expression'))
        : node;
}

export function isNamedKey(property: AstNode): boolean {
    return propertyKeyName(property) !== undefined;
}

export function isReference(node: AstNode | undefined): boolean {
    const read = unwrapped(node);
    return (
        read?.type === 'Identifier' ||
        (read?.type === 'MemberExpression' &&
            (read.computed !== true || stringValue(child(read, 'property')) !== undefined) &&
            isReference(child(read, 'object')))
    );
}

/** `config.jobs` → `config`. */
export function rootOf(node: AstNode | undefined): string | undefined {
    const read = unwrapped(node);
    return read?.type === 'MemberExpression' ? rootOf(child(read, 'object')) : identifierName(read);
}
