import type { Fix, Fixer, FixFn } from '@oxlint/plugins';

import {
    child,
    childList,
    identifierName,
    isTestCallee,
    nodeEnd,
    nodeStart,
    stringValue,
} from '../../../engine/project/ast.js';
import type { AstNode } from '../../../engine/project/ast.js';

function isDescribeCallee(callee: AstNode | undefined): boolean {
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

/** `undefined` when the group holds anything but tests. */
export function flattenedGroup(source: string, group: AstNode, named: string): string | undefined {
    const body = groupBodyOf(group);
    const title = stringValue(firstArgumentOf(group));
    const statements = childList(body, 'body');
    if (body === undefined || title === undefined) {
        return undefined;
    }
    let text = '';
    let from = nodeStart(body) + 1;
    for (const statement of statements) {
        const its = firstArgumentOf(statement);
        const written = its?.type === 'Literal' || its?.type === 'TemplateLiteral';
        if (!isTestCallee(calleeOf(statement)) || its === undefined || !written) {
            return undefined;
        }
        if (title !== named) {
            const at = nodeStart(its) + 1;
            text += `${source.slice(from, at)}${escapedFor(its, `${title} — `)}`;
            from = at;
        }
    }
    return text + source.slice(from, nodeEnd(body) - 1);
}

/** The statements between the members stay at module scope above the one describe; `undefined` when a group cannot flatten. */
function mergedText(
    source: string,
    statements: AstNode[],
    members: Set<AstNode>,
    named: string,
): string | undefined {
    const inRun = statements.filter(
        (statement) =>
            nodeStart(statement) >= nodeStart([...members][0]) &&
            nodeEnd(statement) <= nodeEnd([...members].at(-1)),
    );
    let hoisted = '';
    let grouped = '';
    let previous: number | undefined;
    for (const statement of inRun) {
        const lead = previous === undefined ? '' : source.slice(previous, nodeStart(statement));
        previous = nodeEnd(statement);
        const own = source.slice(nodeStart(statement), nodeEnd(statement));
        if (!members.has(statement)) {
            hoisted += `${lead.trimStart()}${own}\n`;
        } else if (isDescribeCallee(calleeOf(statement))) {
            const flattened = flattenedGroup(source, statement, named);
            if (flattened === undefined) {
                return undefined;
            }
            grouped += `${lead}${flattened.trim()}`;
        } else {
            grouped += `${lead}${own}`;
        }
    }
    const beforeDescribe = hoisted === '' ? '' : `${hoisted}\n`;
    return `${beforeDescribe}describe('${named}', () => {\n${grouped.trim()}\n});`;
}

function importDescribe(fixer: Fixer, statements: AstNode[]): Fix | undefined {
    const vitest = statements.find(
        (statement) =>
            statement.type === 'ImportDeclaration' &&
            stringValue(child(statement, 'source')) === 'vitest',
    );
    const specifiers = childList(vitest, 'specifiers');
    if (
        specifiers.some((specifier) => identifierName(child(specifier, 'imported')) === 'describe')
    ) {
        return undefined;
    }
    const [first] = specifiers;
    if (first?.type === 'ImportSpecifier') {
        return fixer.insertTextBeforeRange([nodeStart(first), nodeStart(first)], 'describe, ');
    }
    const [top] = statements;
    return top === undefined
        ? undefined
        : fixer.insertTextBeforeRange(
              [nodeStart(top), nodeStart(top)],
              "import { describe } from 'vitest';\n",
          );
}

export function isGroup(statement: AstNode): boolean {
    return isDescribeCallee(calleeOf(statement));
}

export function isTest(statement: AstNode): boolean {
    return isTestCallee(calleeOf(statement));
}

export function mergeFix(
    source: string,
    statements: AstNode[],
    members: AstNode[],
    named: string,
): FixFn | undefined {
    const text = mergedText(source, statements, new Set(members), named);
    const [first] = members;
    const last = members.at(-1);
    if (text === undefined || first === undefined || last === undefined) {
        return undefined;
    }
    const described = members.some((statement) => isGroup(statement));
    return (fixer) =>
        [
            described ? undefined : importDescribe(fixer, statements),
            fixer.replaceTextRange([nodeStart(first), nodeEnd(last)], text),
        ].filter((edit) => edit !== undefined);
}
