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

/** `<LocaleNote />`, `locale-note` and `LocaleNote` spell one subject: only letters and digits count, whatever their case. */
function spelling(title: string): string {
    // Stryker disable next-line MethodExpression: both sides of a comparison fold the same way, upper or lower
    return title.replaceAll(/[^\p{L}\d]/gu, '').toLowerCase();
}

/** What the file is about: the title its `describe` takes, and its own base name. */
export interface FileSubject {
    readonly base: string;
    readonly named: string;
}

/** A group titled with the file's subject, or with the file's own base name, in any spelling: its title adds nothing a test should carry. */
function restatesSubject(title: string, { base, named }: FileSubject): boolean {
    return spelling(title) === spelling(named) || spelling(title) === spelling(base);
}

/** `undefined` when the group holds anything but tests. */
export function flattenedGroup(
    source: string,
    group: AstNode,
    subject: FileSubject,
): string | undefined {
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
        if (!restatesSubject(title, subject)) {
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
    subject: FileSubject,
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
            const flattened = flattenedGroup(source, statement, subject);
            if (flattened === undefined) {
                return undefined;
            }
            grouped += `${lead}${flattened.trim()}`;
        } else {
            grouped += `${lead}${own}`;
        }
    }
    const beforeDescribe = hoisted === '' ? '' : `${hoisted}\n`;
    return `${beforeDescribe}describe('${subject.named}', () => {\n${grouped.trim()}\n});`;
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
    subject: FileSubject,
): FixFn | undefined {
    const text = mergedText(source, statements, new Set(members), subject);
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
