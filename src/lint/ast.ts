import type { AstNode } from './types.js';

/**
 * Shared AST helpers for the rule files. Everything here is pure and
 * structural: rules narrow nodes by `type` and read fields defensively, so the
 * layer stays decoupled from oxlint's internal (alpha) typings.
 */

/** Split a path into its non-empty segments (posix or win separators). */
export function segments(path: string): string[] {
    return path.split(/[/\\]/).filter(Boolean);
}

/** The string value of a plain string literal (or a template with no holes). */
export function stringValue(node: AstNode | undefined): string | undefined {
    if (node === undefined) {
        return undefined;
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    if (node.type === 'TemplateLiteral') {
        const expressions = node.expressions as AstNode[] | undefined;
        const quasis = node.quasis as AstNode[] | undefined;
        if (expressions?.length === 0 && quasis?.length === 1) {
            return (quasis[0].value as undefined | { cooked?: string })?.cooked;
        }
    }
    return undefined;
}

/** The property name of a non-computed member expression, if identifiable. */
export function memberPropertyName(node: AstNode): string | undefined {
    if (node.type !== 'MemberExpression' || node.computed === true) {
        return undefined;
    }
    const property = node.property as AstNode | undefined;
    return property?.type === 'Identifier' ? (property.name as string) : undefined;
}

/**
 * The root identifier name of a member/call chain:
 * `dockerCli.fixture(x).exec(y)` → `dockerCli`.
 */
export function chainRootName(node: AstNode | undefined): string | undefined {
    let current = node;
    while (current !== undefined) {
        if (current.type === 'Identifier') {
            return current.name as string;
        }
        if (current.type === 'MemberExpression') {
            current = current.object as AstNode | undefined;
        } else if (current.type === 'CallExpression') {
            current = current.callee as AstNode | undefined;
        } else if (current.type === 'AwaitExpression' || current.type === 'ChainExpression') {
            current = (current.argument ?? current.expression) as AstNode | undefined;
        } else {
            return undefined;
        }
    }
    return undefined;
}

/**
 * Is this call `specification.<member>(…)`? Returns the member name when the
 * callee is a non-computed member on the `specification` identifier.
 */
export function specificationMember(callNode: AstNode): string | undefined {
    const callee = callNode.callee as AstNode | undefined;
    if (callee?.type !== 'MemberExpression') {
        return undefined;
    }
    const object = callee.object as AstNode | undefined;
    if (object?.type !== 'Identifier' || object.name !== 'specification') {
        return undefined;
    }
    return memberPropertyName(callee);
}

/** Find a named, non-computed property in an ObjectExpression. */
export function findProperty(objectNode: AstNode, name: string): AstNode | undefined {
    if (objectNode.type !== 'ObjectExpression') {
        return undefined;
    }
    const properties = (objectNode.properties as AstNode[] | undefined) ?? [];
    return properties.find((property) => propertyKeyName(property) === name);
}

/** The name of a property key (Identifier or string literal), if identifiable. */
export function propertyKeyName(property: AstNode): string | undefined {
    if (property.type !== 'Property' || property.computed === true) {
        return undefined;
    }
    const key = property.key as AstNode | undefined;
    if (key?.type === 'Identifier') {
        return key.name as string;
    }
    if (key?.type === 'Literal') {
        return String(key.value);
    }
    return undefined;
}

/**
 * Depth-first walk over every node reachable from `root`, calling `visit` on
 * each. Used by rules that need a whole-file view from the `Program` handler
 * (oxlint runs visitors per node type; cross-node analyses walk manually).
 */
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

function isNode(value: unknown): value is AstNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { type?: unknown }).type === 'string'
    );
}

/** The source start offset of a node or comment (oxlint `start`, else `range[0]`). */
export function nodeStart(node: undefined | { range?: unknown; start?: unknown }): number {
    if (node === undefined) {
        return -1;
    }
    if (typeof node.start === 'number') {
        return node.start;
    }
    const range = node.range as number[] | undefined;
    return Array.isArray(range) && typeof range[0] === 'number' ? range[0] : -1;
}

/** Bare identifiers that introduce a test. */
const TEST_IDENTIFIERS = new Set(['it', 'test']);

/**
 * Is `callee` a `test` / `it` invocation? Handles the modifier forms used across
 * the specs: bare `test(...)`, member `test.only(...)` / `test.concurrent(...)`,
 * and the call-returning wrappers `test.skipIf(cond)(...)` / `test.each(...)(...)`.
 * Shared by B4 / J3 / J4.
 */
export function isTestCallee(callee: AstNode | undefined): boolean {
    if (callee === undefined) {
        return false;
    }
    if (callee.type === 'Identifier') {
        return TEST_IDENTIFIERS.has(callee.name as string);
    }
    if (callee.type === 'MemberExpression') {
        return isTestCallee(callee.object as AstNode | undefined);
    }
    if (callee.type === 'CallExpression') {
        return isTestCallee(callee.callee as AstNode | undefined);
    }
    return false;
}

/** Does the test callee chain carry a modifier member with the given name? */
export function testCalleeHasModifier(callee: AstNode | undefined, modifier: string): boolean {
    if (callee === undefined) {
        return false;
    }
    if (callee.type === 'MemberExpression') {
        return (
            memberPropertyName(callee) === modifier ||
            testCalleeHasModifier(callee.object as AstNode | undefined, modifier)
        );
    }
    if (callee.type === 'CallExpression') {
        return testCalleeHasModifier(callee.callee as AstNode | undefined, modifier);
    }
    return false;
}

/** The callback argument of a test call (arrow or function expression), if any. */
export function findTestCallback(args: AstNode[]): AstNode | undefined {
    return args.find(
        (arg) => arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression',
    );
}

/** The static string name of a test call (`test('name', …)`), if a literal. */
export function testName(callNode: AstNode): string | undefined {
    const args = (callNode.arguments as AstNode[] | undefined) ?? [];
    return stringValue(args[0]);
}

/** All static + dynamic import/export sources in a file, with their nodes. */
export type ImportSource = { node: AstNode; source: string };

/**
 * Visitor fragment collecting every import-like source: static imports,
 * dynamic `import()`, and re-exports. Rules spread this into their visitor.
 */
export function importSourceVisitor(
    onSource: (entry: ImportSource) => void,
): Record<string, (node: AstNode) => void> {
    const fromSourceField = (node: AstNode): void => {
        // `source` is null on local export declarations (`export { x };`).
        const source = (node.source ?? undefined) as AstNode | undefined;
        const value = stringValue(source);
        if (value !== undefined) {
            onSource({ node: source ?? node, source: value });
        }
    };
    return {
        ExportAllDeclaration: fromSourceField,
        ExportNamedDeclaration: fromSourceField,
        ImportDeclaration: fromSourceField,
        ImportExpression: fromSourceField,
    };
}
