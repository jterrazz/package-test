import type { Comment } from '@oxlint/plugins';

import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    nodeStart,
    stringField,
    stringValue,
} from './ast.js';
import type { AstNode } from './ast.js';

const TEST_IDENTIFIERS = new Set(['it', 'test']);

/** Handles `test.only(...)`, `test.concurrent(...)` and the call-returning `test.skipIf(cond)(...)` / `test.each(...)(...)`. */
export function isTestCallee(callee: AstNode | undefined): boolean {
    if (callee === undefined) {
        return false;
    }
    if (callee.type === 'Identifier') {
        return TEST_IDENTIFIERS.has(stringField(callee, 'name') ?? '');
    }
    if (callee.type === 'MemberExpression') {
        return isTestCallee(child(callee, 'object'));
    }
    if (callee.type === 'CallExpression') {
        return isTestCallee(child(callee, 'callee'));
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
            testCalleeHasModifier(child(callee, 'object'), modifier)
        );
    }
    if (callee.type === 'CallExpression') {
        return testCalleeHasModifier(child(callee, 'callee'), modifier);
    }
    return false;
}

export function findTestCallback(args: AstNode[]): AstNode | undefined {
    return args.find(
        (arg) => arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression',
    );
}

export function testName(callNode: AstNode): string | undefined {
    const args = childList(callNode, 'arguments');
    return stringValue(args[0]);
}

export const MARKERS = ['Given', 'When', 'Then'] as const;

export type Marker = (typeof MARKERS)[number];

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

export function isDescribeCallee(callee: AstNode | undefined): boolean {
    if (callee?.type === 'Identifier') {
        return identifierName(callee) === 'describe';
    }
    if (callee?.type === 'MemberExpression') {
        return isDescribeCallee(child(callee, 'object'));
    }
    return callee?.type === 'CallExpression' && isDescribeCallee(child(callee, 'callee'));
}

export function calleeOf(statement: AstNode): AstNode | undefined {
    const expression = child(statement, 'expression');
    return expression?.type === 'CallExpression' ? child(expression, 'callee') : undefined;
}

export function firstArgumentOf(statement: AstNode): AstNode | undefined {
    return childList(child(statement, 'expression'), 'arguments')[0];
}

export function groupBodyOf(group: AstNode): AstNode | undefined {
    if (identifierName(calleeOf(group)) !== 'describe') {
        return undefined;
    }
    const run = childList(child(group, 'expression'), 'arguments')[1];
    const body = child(run, 'body');
    return body?.type === 'BlockStatement' ? body : undefined;
}

export function escapedFor(title: AstNode, text: string): string {
    const raw = typeof title.raw === 'string' ? title.raw : "'";
    const delimiter = title.type === 'TemplateLiteral' ? '`' : raw.charAt(0);
    const escaped = text.replaceAll('\\', String.raw`\\`).replaceAll(delimiter, `\\${delimiter}`);
    return delimiter === '`' ? escaped.replaceAll('${', '\\${') : escaped;
}

export function isGroup(statement: AstNode): boolean {
    return isDescribeCallee(calleeOf(statement));
}

export function isTest(statement: AstNode): boolean {
    return isTestCallee(calleeOf(statement));
}
