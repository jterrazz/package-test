import type { Fix, Fixer, FixFn } from '@oxlint/plugins';

import {
    child,
    childList,
    identifierName,
    nodeEnd,
    nodeStart,
    stringValue,
} from '../../../kit/project/ast.js';
import type { AstNode } from '../../../kit/project/ast.js';
import {
    calleeOf,
    escapedFor,
    firstArgumentOf,
    groupBodyOf,
    isDescribeCallee,
    isGroup,
    isTestCallee,
} from '../../../kit/project/test-calls.js';

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
        if (!isTestCallee(calleeOf(statement))) {
            return undefined;
        }
        // Stryker disable next-line ConditionalExpression,BlockStatement: a test titled by nothing is titled by no literal, which the next check refuses
        if (its === undefined) {
            return undefined;
        }
        if (!written) {
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
            // Stryker disable next-line ConditionalExpression: only an import names vitest as its source
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
    // Stryker disable next-line ConditionalExpression: a file with a test to wrap has a first statement
    return top === undefined
        ? undefined
        : fixer.insertTextBeforeRange(
              [nodeStart(top), nodeStart(top)],
              "import { describe } from 'vitest';\n",
          );
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
    // Stryker disable next-line ConditionalExpression: a merge always has a first and a last member
    if (text === undefined || first === undefined || last === undefined) {
        return undefined;
    }
    const described = members.some((statement) => isGroup(statement));
    return (fixer) => {
        const edits = [
            described ? undefined : importDescribe(fixer, statements),
            fixer.replaceTextRange([nodeStart(first), nodeEnd(last)], text),
        ];
        // Stryker disable next-line MethodExpression,ConditionalExpression: the fixer skips an edit that is not there
        return edits.filter((edit) => edit !== undefined);
    };
}
