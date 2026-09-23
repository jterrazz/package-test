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
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, Fix, LintRule, RuleContext, RuleFixer, Visitor } from '../../oxlint-api.js';
import { baseNameOf, roleOf } from '../../role.js';

/** The aspect a spec file names: `pagination.spec.ts` → `pagination`. */
export function aspectOf(filename: string): string {
    return baseNameOf(filename).replace(/\.spec\.ts$/u, '');
}

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

/**
 * The edit that brings `describe` into the file: into its `vitest` import when
 * it has one naming other hooks, else a line of its own above everything.
 */
function importDescribe(fixer: RuleFixer, statements: AstNode[]): Fix | undefined {
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
    if (first !== undefined && first.type === 'ImportSpecifier') {
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

/**
 * CONVENTIONS C31 — a spec file holds ONE top-level `describe`, titled with
 * the file's aspect: `pagination.spec.ts` → `describe('pagination', …)`. The
 * runner's report reads `pagination > …` for every test, so a reader finds
 * the file a failure came from by its first word.
 *
 * `--fix` renames a title that says something else, and wraps the tests of a
 * file that has no `describe` in one, `describe` imported with them; a file
 * with several, or with a test beside its one, is left to its author —
 * merging groups is a reading.
 */
export const c31DescribeNamesFile: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.filename).role !== 'spec') {
            return {};
        }
        const aspect = aspectOf(context.filename);
        return {
            Program(program: AstNode) {
                const statements = childList(program, 'body');
                const describes = statements.filter((statement) =>
                    isDescribeCallee(calleeOf(statement)),
                );
                const tests = statements.filter((statement) => isTestCallee(calleeOf(statement)));
                const [only, second] = describes;
                const [first] = tests;
                const last = tests.at(-1);
                if (only === undefined) {
                    if (first !== undefined && last !== undefined) {
                        context.report({
                            data: { aspect },
                            fix: (fixer) =>
                                [
                                    importDescribe(fixer, statements),
                                    fixer.insertTextBeforeRange(
                                        [nodeStart(first), nodeStart(first)],
                                        `describe('${aspect}', () => {\n`,
                                    ),
                                    fixer.insertTextAfterRange(
                                        [nodeEnd(last), nodeEnd(last)],
                                        '\n});',
                                    ),
                                ].filter((edit) => edit !== undefined),
                            messageId: 'noDescribe',
                            node: first,
                        });
                    }
                    return;
                }
                if (second !== undefined) {
                    context.report({
                        data: { aspect },
                        messageId: 'severalDescribes',
                        node: second,
                    });
                    return;
                }
                if (first !== undefined) {
                    context.report({ data: { aspect }, messageId: 'testOutside', node: first });
                }
                const title = firstArgumentOf(only);
                if (title !== undefined && stringValue(title) !== aspect) {
                    context.report({
                        data: { aspect, title: stringValue(title) ?? 'a computed title' },
                        fix: (fixer) =>
                            fixer.replaceTextRange(
                                [nodeStart(title), nodeEnd(title)],
                                `'${aspect}'`,
                            ),
                        messageId: 'wrongTitle',
                        node: title,
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
                fix: "wrap them in `describe('{{aspect}}', () => { … })` — `make fix` does it",
            },
            severalDescribes: {
                found: 'a second top-level `describe` in a file about one aspect',
                fix: "merge the groups under `describe('{{aspect}}', …)`, or move this one to a file of its own aspect",
            },
            testOutside: {
                found: 'a test beside the `describe` of the file',
                fix: "move it inside `describe('{{aspect}}', …)`",
            },
            wrongTitle: {
                found: 'the file’s `describe` is titled "{{title}}"',
                fix: "title it '{{aspect}}', the file's aspect — `make fix` renames it",
            },
        }),
        type: 'suggestion',
    },
};
