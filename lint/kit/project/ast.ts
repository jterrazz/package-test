import type { AfterHook, BeforeHook, Comment, Node } from '@oxlint/plugins';

/** A rule reads a node by its `type` and span and every other field defensively, decoupled from the generated ESTree union. The published declarations import `@oxlint/plugins`, so it is a dependency. */

export type AstNode = Node & { type: string; [key: string]: unknown };

export type Visitor = Record<string, (node: AstNode) => void> & {
    after?: AfterHook;
    before?: BeforeHook;
};

function fieldOf(value: unknown, key: string): unknown {
    // Stryker disable next-line ConditionalExpression,LogicalOperator: a template's text is always an object
    return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

export function stringValue(node: AstNode | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }
    // Stryker disable next-line ConditionalExpression: only a literal carries a string value among the nodes a string is read from
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    // Stryker disable next-line ConditionalExpression,BlockStatement: a node that is no template has no text to cook
    if (node.type !== 'TemplateLiteral' || childList(node, 'expressions').length > 0) {
        return undefined;
    }
    const [text] = childList(node, 'quasis');
    return cookedText(text);
}

export function cookedText(quasi: AstNode | undefined): string | undefined {
    // Stryker disable next-line OptionalChaining: a template always has a text around each hole
    const cooked = fieldOf(quasi?.value, 'cooked');
    // Stryker disable next-line ConditionalExpression: an untagged template always cooks its text
    return typeof cooked === 'string' ? cooked : undefined;
}

export function memberPropertyName(node: AstNode | undefined): string | undefined {
    // Stryker disable next-line ConditionalExpression: only a member has a property
    if (node?.type !== 'MemberExpression' || node.computed === true) {
        return undefined;
    }
    const property = child(node, 'property');
    // Stryker disable next-line OptionalChaining: a member always has a property
    return property?.type === 'Identifier' ? (stringField(property, 'name') ?? '') : undefined;
}

const CHAIN_LINKS: Readonly<Record<string, string>> = {
    AwaitExpression: 'argument',
    CallExpression: 'callee',
    ChainExpression: 'expression',
    MemberExpression: 'object',
};

export function chainRootName(node: AstNode | undefined): string | undefined {
    let current = node;
    while (current !== undefined) {
        if (current.type === 'Identifier') {
            return stringField(current, 'name') ?? '';
        }
        const link = CHAIN_LINKS[current.type];
        // Stryker disable next-line ConditionalExpression,BlockStatement: no link reads no child, which ends the chain on undefined all the same
        if (link === undefined) {
            return undefined;
        }
        current = child(current, link);
    }
    return undefined;
}

export function specificationMember(callNode: AstNode): string | undefined {
    const callee = child(callNode, 'callee');
    // Stryker disable next-line ConditionalExpression,OptionalChaining,BlockStatement: a call always has a callee, and only a member has an object
    if (callee?.type !== 'MemberExpression') {
        return undefined;
    }
    const object = child(callee, 'object');
    // Stryker disable next-line ConditionalExpression,OptionalChaining: a member always has an object, and only an identifier has a name
    if (object?.type !== 'Identifier' || object.name !== 'specification') {
        return undefined;
    }
    return memberPropertyName(callee);
}

/** Only an object, among the nodes read here, lists properties. */
export function findProperty(objectNode: AstNode | undefined, name: string): AstNode | undefined {
    return childList(objectNode, 'properties').find(
        (property) => propertyKeyName(property) === name,
    );
}

export function propertyKeyName(property: AstNode): string | undefined {
    // Stryker disable next-line ConditionalExpression: only a property has a key
    if (property.type !== 'Property' || property.computed === true) {
        return undefined;
    }
    const key = child(property, 'key');
    // Stryker disable next-line OptionalChaining: a property always has a key
    if (key?.type === 'Identifier') {
        return stringField(key, 'name') ?? '';
    }
    // Stryker disable next-line ConditionalExpression,OptionalChaining: a property's key is a name, a literal, or computed
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
    return typeof node?.start === 'number' ? node.start : -1;
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
    // Stryker disable next-line ConditionalExpression: an identifier's name is always text
    return typeof name === 'string' ? name : undefined;
}

export function nodeEnd(node: Positioned | undefined): number {
    return typeof node?.end === 'number' ? node.end : -1;
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
    // Stryker disable next-line ConditionalExpression,BlockStatement: only a member has an object
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
    // Stryker disable next-line ConditionalExpression,BlockStatement: only a call has a callee
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

/** `config.jobs` gives `config`. */
export function rootOf(node: AstNode | undefined): string | undefined {
    const read = unwrapped(node);
    return read?.type === 'MemberExpression' ? rootOf(child(read, 'object')) : identifierName(read);
}
