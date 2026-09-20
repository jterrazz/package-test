import { basename, dirname, join } from 'node:path';

import { isFile } from './fs-cache.js';
import type { AstNode, Comment } from './types.js';

/**
 * Shared AST helpers for the rule files. Everything here is pure and
 * structural: rules narrow nodes by `type` and read fields defensively, so the
 * layer stays decoupled from oxlint's internal (alpha) typings.
 */

/** Split a path into its non-empty segments (posix or win separators). */
export function segments(path: string): string[] {
    return path.split(/[/\\]/u).filter(Boolean);
}

/** Where a file sits relative to the `specs/` tree that owns it. */
export type SpecsAnchor = {
    /** The anchoring `specs` directory itself. */
    directory: string;
    /** Segments from the anchor down to the file — `[facet, domain, basename]`. */
    relative: string[];
};

/**
 * The `specs/` directory a file belongs to: the NEAREST ancestor named `specs`,
 * searched no higher than the nearest `package.json`. `undefined` when the file
 * is not under one.
 *
 * One anchor for every specs-aware rule. Rules used to hand-roll the search and
 * disagreed with each other — `lastIndexOf('specs')` (C1) took the innermost
 * match, `indexOf('specs')` (F3) the outermost, so one nested tree read as two
 * different facets. And any bare "is `specs` a segment of this path" test
 * matched directories that have nothing to do with the project: a checkout
 * living under `~/specs/` turned the whole repository into a specs tree, which
 * silently disabled F2's protection of production code. The package boundary
 * makes the search stop where the project does.
 */
export function specsAnchor(filename: string): SpecsAnchor | undefined {
    const relative = [basename(filename)];
    let directory = dirname(filename);
    for (;;) {
        if (basename(directory) === 'specs') {
            return { directory, relative };
        }
        if (isFile(join(directory, 'package.json'))) {
            return undefined; // The package root, and no `specs/` under it.
        }
        const parent = dirname(directory);
        if (parent === directory) {
            return undefined;
        }
        relative.unshift(basename(directory));
        directory = parent;
    }
}

/** Is this file inside a `specs/` tree? — the predicate form of {@link specsAnchor}. */
export function isUnderSpecs(filename: string): boolean {
    return specsAnchor(filename) !== undefined;
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
        const onlyQuasi = quasis?.[0];
        if (expressions?.length === 0 && quasis?.length === 1 && onlyQuasi !== undefined) {
            return (onlyQuasi.value as undefined | { cooked?: string })?.cooked;
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

/** Anything the source positions a rule can ask about — a node or a comment. */
type Positioned = AstNode | Comment;

/** The source start offset of a node or comment (oxlint `start`, else `range[0]`). */
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

/** Is this value an AST node — an object carrying a `type` string? */
export function isNode(value: unknown): value is AstNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        typeof value.type === 'string'
    );
}

/**
 * A node's child by key, or `undefined` when the key holds something else.
 *
 * Every rule reaches for `node.parent`, `node.id`, `node.value`; the node shape
 * types them as `unknown`, so each reach was an assertion of its own. One
 * guarded read is the same answer, checked once.
 */
export function child(node: AstNode | undefined, key: string): AstNode | undefined {
    const value = node?.[key];
    return isNode(value) ? value : undefined;
}

/**
 * A node's child LIST by key — the nodes of it, and nothing else.
 *
 * `arguments`, `declarations`, `body`: every rule reaches for one of them, and
 * the node shape types them as `unknown`, so each reach was an assertion of its
 * own. One guarded read answers them all.
 */
export function childList(node: AstNode | undefined, key: string): AstNode[] {
    const value = node?.[key];
    return Array.isArray(value) ? value.filter((item) => isNode(item)) : [];
}

/** The name of an identifier node, or `undefined` for anything else. */
export function identifierName(node: AstNode | undefined): string | undefined {
    if (node?.type !== 'Identifier') {
        return undefined;
    }
    const { name } = node;
    return typeof name === 'string' ? name : undefined;
}

/** The source end offset of a node or comment (oxlint `end`, else `range[1]`). */
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

/** The three words a test narrates with, in the order they may appear. */
export const MARKERS = ['Given', 'When', 'Then'] as const;

/** One of the three narration words. */
export type Marker = (typeof MARKERS)[number];

/**
 * The marker a comment opens on, or `undefined` for an ordinary comment.
 *
 * One reader for the three rules that judge the narration (B4's presence and
 * order, B10's `When`, B11's one line, B12's placement): the shape `// Given -`
 * is a fact about the dialect, and a second copy of it would be a second
 * dialect the day someone widened one of them.
 */
export function markerOf(comment: Comment): Marker | undefined {
    const text = comment.value.trimStart();
    return MARKERS.find((marker) => text.startsWith(`${marker} -`));
}

/** A marker comment and where it sits in the source. */
export type MarkerComment = { comment: Comment; marker: Marker; start: number };

/**
 * Every marker comment among `comments`, in source order.
 *
 * A comment whose offset this oxlint build does not expose keeps its place in
 * the list with `start: -1`: PRESENCE is readable without offsets, and only the
 * ordering passes need them — a marker dropped for want of a number would read
 * as a marker the author never wrote.
 */
export function markerComments(comments: Comment[]): MarkerComment[] {
    const found: MarkerComment[] = [];
    for (const comment of comments) {
        const marker = markerOf(comment);
        if (marker !== undefined) {
            found.push({ comment, marker, start: nodeStart(comment) });
        }
    }
    return found.toSorted((a, b) => a.start - b.start);
}

/** Is the marker written at all? */
export function hasMarker(markers: MarkerComment[], marker: Marker): boolean {
    return markers.some((found) => found.marker === marker);
}

/** The first offset a marker appears at, or `-1` when it is absent or unplaced. */
export function firstMarkerAt(markers: MarkerComment[], marker: Marker): number {
    const found = markers.find((entry) => entry.marker === marker && entry.start >= 0);
    return found?.start ?? -1;
}

/** Is this an `expect(…)` call — the bare identifier callee, no chain? */
export function isExpectCall(node: AstNode | undefined): boolean {
    if (node?.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    return callee?.type === 'Identifier' && callee.name === 'expect';
}

/** An assertion taken apart: what was asserted, how, and through which modifiers. */
export type Assertion = {
    /** The matcher name — `toBe`, `toMatch`, `toHaveBeenCalledWith`… */
    matcher: string;
    /** The modifiers between `expect(…)` and the matcher, outermost last. */
    modifiers: string[];
    /** The `expect(…)` argument, when there is one. */
    subject: AstNode | undefined;
};

/** The modifier members an assertion may pass through before its matcher. */
const MODIFIERS = new Set(['element', 'not', 'rejects', 'resolves']);

/**
 * Read a call as an assertion — `expect(x).not.toBe(y)` → subject `x`, matcher
 * `toBe`, modifiers `['not']`.
 *
 * Four rules judge the SHAPE of an assertion (what it reads, what it proves,
 * how many of them stand on one subject), and each of them was going to walk
 * the same chain. `undefined` for anything that is not an assertion.
 */
export function assertionOf(node: AstNode): Assertion | undefined {
    if (node.type !== 'CallExpression') {
        return undefined;
    }
    const callee = child(node, 'callee');
    if (callee?.type !== 'MemberExpression') {
        return undefined;
    }
    const matcher = memberPropertyName(callee);
    if (matcher === undefined) {
        return undefined;
    }
    const modifiers: string[] = [];
    let current = child(callee, 'object');
    while (current?.type === 'MemberExpression') {
        const name = memberPropertyName(current);
        if (name === undefined || !MODIFIERS.has(name)) {
            return undefined;
        }
        modifiers.unshift(name);
        current = child(current, 'object');
    }
    if (!isExpectCall(current)) {
        return undefined;
    }
    return { matcher, modifiers, subject: childList(current, 'arguments')[0] };
}

/**
 * The dotted path of a member chain, as a reader would write it —
 * `result.stdout` , `result.meta()`. `undefined` for a computed access or
 * anything that is not rooted in an identifier: two subjects a rule cannot
 * SPELL are two subjects it must not equate.
 */
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

/**
 * Is this a value SAMPLED from the machine — the clock, the entropy source?
 *
 * `new Date()` with an argument is a pinned instant and not one of these; the
 * zero-argument form, `Date.now()`, `performance.now()`, `Math.random()` and
 * `randomUUID()` all answer differently on the next run.
 */
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
