import type { Context, Fix, Fixer, FixFn } from '@oxlint/plugins';

import {
    child,
    childList,
    identifierName,
    isTestCallee,
    nodeEnd,
    nodeStart,
    stringValue,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';
import { testTitle } from '../../test-title.js';

/** Is this callee `describe`, or one of its modifiers (`describe.skip`, `describe.each(…)`)? */
function isDescribeCallee(callee: AstNode | undefined): boolean {
    if (callee?.type === 'Identifier') {
        return identifierName(callee) === 'describe';
    }
    if (callee?.type === 'MemberExpression') {
        return isDescribeCallee(child(callee, 'object'));
    }
    return callee?.type === 'CallExpression' && isDescribeCallee(child(callee, 'callee'));
}

/** The callee of the call a top-level statement makes, when it is one. */
function calleeOf(statement: AstNode): AstNode | undefined {
    const expression = child(statement, 'expression');
    return expression?.type === 'CallExpression' ? child(expression, 'callee') : undefined;
}

/** The first argument of the call a top-level statement makes. */
function firstArgumentOf(statement: AstNode): AstNode | undefined {
    return childList(child(statement, 'expression'), 'arguments')[0];
}

/** The statements of the block a group's function runs, when it is a plain `describe` with one. */
function groupBodyOf(group: AstNode): AstNode | undefined {
    if (identifierName(calleeOf(group)) !== 'describe') {
        return undefined;
    }
    const run = childList(child(group, 'expression'), 'arguments')[1];
    const body = child(run, 'body');
    return body?.type === 'BlockStatement' ? body : undefined;
}

/** A title written in quotes or backticks, escaped for its own delimiter. */
function escapedFor(title: AstNode, text: string): string {
    const raw = typeof title.raw === 'string' ? title.raw : "'";
    const delimiter = title.type === 'TemplateLiteral' ? '`' : raw.charAt(0);
    const escaped = text.replaceAll('\\', String.raw`\\`).replaceAll(delimiter, `\\${delimiter}`);
    return delimiter === '`' ? escaped.replaceAll('${', '\\${') : escaped;
}

/** A group's tests, each title prefixed with the group's (C33's grouping), or `undefined` when it holds anything else. */
function flattenedGroup(source: string, group: AstNode, named: string): string | undefined {
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

/**
 * The text replacing the run from the first member (a group or a test) to the
 * last: the statements between them kept at module scope above, then one
 * `describe` titled `named` holding every test. `undefined` when a group cannot flatten.
 */
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
    return `${hoisted}describe('${named}', () => {\n${grouped.trim()}\n});`;
}

/** The edit that brings `describe` into its `vitest` import, else a line of its own on top. */
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

/** Is this top-level statement a group — `describe(…)` or one of its forms? */
function isGroup(statement: AstNode): boolean {
    return isDescribeCallee(calleeOf(statement));
}

/** Is this top-level statement a test? */
function isTest(statement: AstNode): boolean {
    return isTestCallee(calleeOf(statement));
}

/** How a file's top level falls short of one group holding every test, and where it shows. */
function runFinding(members: AstNode[]): undefined | { messageId: string; node: AstNode } {
    const [only, second] = members.filter((statement) => isGroup(statement));
    const stray = members.find((statement) => isTest(statement));
    if (only === undefined) {
        return stray === undefined ? undefined : { messageId: 'noDescribe', node: stray };
    }
    if (second !== undefined) {
        return { messageId: 'severalDescribes', node: second };
    }
    return stray === undefined ? undefined : { messageId: 'testOutside', node: stray };
}

/**
 * The finding on the one group's title when it is not the file's name, with
 * its fix: a plain group's renamed; a table's — `describe.each(…)(…)`, run
 * once per row — prefixed so what names its rows stays, unless it is computed.
 */
function titleFinding(
    group: AstNode,
    named: string,
): undefined | { fix?: FixFn; messageId: string; node: AstNode } {
    const title = firstArgumentOf(group);
    const said = stringValue(title);
    const parametrised = calleeOf(group)?.type === 'CallExpression';
    if (
        title === undefined ||
        said === named ||
        (parametrised && said?.startsWith(`${named} — `) === true)
    ) {
        return undefined;
    }
    const messageId = parametrised ? 'tableTitle' : 'wrongTitle';
    if (!parametrised) {
        const fix: FixFn = (fixer) =>
            fixer.replaceTextRange([nodeStart(title), nodeEnd(title)], `'${named}'`);
        return { fix, messageId, node: title };
    }
    if (title.type !== 'Literal' && title.type !== 'TemplateLiteral') {
        return { messageId, node: title };
    }
    const at = nodeStart(title) + 1;
    const fix: FixFn = (fixer) =>
        fixer.insertTextBeforeRange([at, at], escapedFor(title, `${named} — `));
    return { fix, messageId, node: title };
}

/** The fix that merges `members` into one describe, when the merge is mechanical. */
function mergeFix(
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

/**
 * CONVENTIONS C31 — a test file holds ONE top-level `describe`, titled with
 * a spec's aspect or a colocated test's subject ({@link testTitle}), so the
 * report's first word, `<name> > …`, names the file a failure came from. A
 * `describe.each` names its rows: its title starts with the name,
 * `'pagination — page %s'`.
 *
 * `--fix` renames a title that says something else (a table's by prefixing
 * the name), wraps the tests of a file that has no `describe` in one, and
 * merges several groups, or a test beside the one, into one — a group's
 * tests titled `<group> — <test>`, one level deep as J10 wants. The
 * statements between the tests stay at module scope, above the `describe`. A
 * group that holds anything but tests, or runs per row, is left to its
 * author: its hooks and its table are a scope the merge would change.
 */
export const c31DescribeNamesFile: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
            Program(program: AstNode) {
                const statements = childList(program, 'body');
                const members = statements.filter((node) => isGroup(node) || isTest(node));
                if (members.length === 0) {
                    return;
                }
                const { named, what } = testTitle(context.filename, identityOf(context).role);
                const finding = runFinding(members);
                if (finding !== undefined) {
                    const source = context.sourceCode.text;
                    const fix = mergeFix(source, statements, members, named);
                    context.report({ ...finding, ...(fix && { fix }), data: { named, what } });
                    return;
                }
                const [only] = members;
                const title = only === undefined ? undefined : titleFinding(only, named);
                if (title !== undefined) {
                    const said = stringValue(firstArgumentOf(only ?? program));
                    context.report({
                        ...title,
                        data: { named, title: said ?? 'a computed title', what },
                    });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c31-describe-names-file'],
        fixable: 'code',
        messages: lessons('c31-describe-names-file', {
            noDescribe: {
                found: 'the tests of this file stand in no `describe`',
                fix: "wrap them in `describe('{{named}}', () => { … })` — `make fix` does it",
            },
            severalDescribes: {
                found: 'a second top-level `describe` in a file about one {{what}}',
                fix: "merge the groups under `describe('{{named}}', …)`, each test titled `<group> — <test>` — `make fix` does it when every group holds tests alone — or move this one to a file of its own {{what}}",
            },
            tableTitle: {
                found: 'the file’s `describe.each` is titled "{{title}}"',
                fix: "start its title with the file's {{what}}, '{{named}} — …', keeping what names its rows — `make fix` prefixes it",
            },
            testOutside: {
                found: 'a test beside the `describe` of the file',
                fix: "move it inside `describe('{{named}}', …)` — `make fix` does it when the group holds tests alone",
            },
            wrongTitle: {
                found: 'the file’s `describe` is titled "{{title}}"',
                fix: "title it '{{named}}', the file's {{what}} — `make fix` renames it",
            },
        }),
        type: 'suggestion',
    },
};
