import type { Comment, Node } from '@oxlint/plugins';
import { basename, dirname, join } from 'node:path';

import { isFile, isOnDisk } from './fs-cache.js';

/** A rule reads a node by its `type` and span and every other field defensively, decoupled from the generated ESTree union. The published declarations import `@oxlint/plugins`, so it is a dependency. */

export type AstNode = Node & { type: string; [key: string]: unknown };

export function segments(path: string): string[] {
    return path.split(/[/\\]/u).filter(Boolean);
}

export type SpecsAnchor = {
    directory: string;
    /** `[facet, domain, basename]`. */
    relative: string[];
};

/** A tree no package holds is still a project: a `.git` directory or worktree file marks its root too. */
export function isProjectRoot(directory: string): boolean {
    const git = join(directory, '.git');
    return isFile(join(directory, 'package.json')) || isOnDisk(git);
}

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
        const expressions = node.expressions as AstNode[] | undefined;
        const quasis = node.quasis as AstNode[] | undefined;
        const onlyQuasi = quasis?.[0];
        if (expressions?.length === 0 && quasis?.length === 1 && onlyQuasi !== undefined) {
            return (onlyQuasi.value as undefined | { cooked?: string })?.cooked;
        }
    }
    return undefined;
}

export function memberPropertyName(node: AstNode): string | undefined {
    if (node.type !== 'MemberExpression' || node.computed === true) {
        return undefined;
    }
    const property = node.property as AstNode | undefined;
    return property?.type === 'Identifier' ? (property.name as string) : undefined;
}

/** `dockerCli.fixture(x).exec(y)` → `dockerCli`. */
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

export function findProperty(objectNode: AstNode, name: string): AstNode | undefined {
    if (objectNode.type !== 'ObjectExpression') {
        return undefined;
    }
    const properties = (objectNode.properties as AstNode[] | undefined) ?? [];
    return properties.find((property) => propertyKeyName(property) === name);
}

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

const TEST_IDENTIFIERS = new Set(['it', 'test']);

/** Handles `test.only(...)`, `test.concurrent(...)` and the call-returning `test.skipIf(cond)(...)` / `test.each(...)(...)`. */
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

export function findTestCallback(args: AstNode[]): AstNode | undefined {
    return args.find(
        (arg) => arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression',
    );
}

export function testName(callNode: AstNode): string | undefined {
    const args = (callNode.arguments as AstNode[] | undefined) ?? [];
    return stringValue(args[0]);
}

export type ImportSource = { node: AstNode; source: string };

export function importSourceVisitor(
    onSource: (entry: ImportSource) => void,
): Record<string, (node: AstNode) => void> {
    const fromSourceField = (node: AstNode): void => {
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

export const MARKERS = ['Given', 'When', 'Then'] as const;

export type Marker = (typeof MARKERS)[number];

/** One reader of the `// Given -` shape for B4, B10 and B11, so the dialect has one definition. */
export function markerOf(comment: Comment): Marker | undefined {
    const text = comment.value.trimStart();
    return MARKERS.find((marker) => text.startsWith(`${marker} -`));
}

export type MarkerComment = { comment: Comment; marker: Marker; start: number };

/** A comment whose offset this oxlint build does not expose keeps its place with `start: -1`: presence is still readable, and a dropped marker would read as one never written. */
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

export function hasMarker(markers: MarkerComment[], marker: Marker): boolean {
    return markers.some((found) => found.marker === marker);
}

export function firstMarkerAt(markers: MarkerComment[], marker: Marker): number {
    const found = markers.find((entry) => entry.marker === marker && entry.start >= 0);
    return found?.start ?? -1;
}

const EXPECT_OPENERS = new Set(['poll', 'soft']);

/** `expect.soft(x)` and `expect.poll(() => x)` count: a soft assertion is an assertion. */
export function isExpectCall(node: AstNode | undefined): boolean {
    if (node?.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    if (callee?.type === 'Identifier') {
        return callee.name === 'expect';
    }
    if (callee?.type !== 'MemberExpression') {
        return false;
    }
    const opener = memberPropertyName(callee);
    return (
        identifierName(child(callee, 'object')) === 'expect' &&
        opener !== undefined &&
        EXPECT_OPENERS.has(opener)
    );
}

export type Assertion = {
    matcher: string;
    /** Outermost last. */
    modifiers: string[];
    subject: AstNode | undefined;
};

const MODIFIERS = new Set(['element', 'not', 'rejects', 'resolves']);

/** `expect(x).not.toBe(y)` → subject `x`, matcher `toBe`, modifiers `['not']`. */
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

/** A facet that gains a scenario adds its word here, once: three rules judge inside the callback and a fourth judges how it ends. */
export const SCENARIO_ACTIONS = new Set(['open', 'render', 'visit']);

export function scenarioCallbackOf(node: AstNode): AstNode | undefined {
    const callee = child(node, 'callee');
    const member = callee === undefined ? undefined : memberPropertyName(callee);
    if (member === undefined || !SCENARIO_ACTIONS.has(member)) {
        return undefined;
    }
    const scenario = childList(node, 'arguments').at(-1);
    return scenario?.type === 'ArrowFunctionExpression' || scenario?.type === 'FunctionExpression'
        ? scenario
        : undefined;
}

export type DiskCall = {
    kind: 'directory' | 'file';
    node: AstNode;
    path: string | undefined;
};

/** The bare identifier only, never a result accessor (`result.file(…)`). */
export function diskCallOf(node: AstNode | undefined): DiskCall | undefined {
    if (node?.type !== 'CallExpression') {
        return undefined;
    }
    const kind = identifierName(child(node, 'callee'));
    if (kind !== 'file' && kind !== 'directory') {
        return undefined;
    }
    const argument = childList(node, 'arguments')[0];
    return { kind, node: argument ?? node, path: stringValue(argument) };
}

export function goldenOf(node: AstNode): DiskCall | undefined {
    const callee = child(node, 'callee');
    if (callee === undefined || memberPropertyName(callee) !== 'toMatch') {
        return undefined;
    }
    return diskCallOf(childList(node, 'arguments')[0]);
}
