import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { childList, stringValue } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { calleeOf, firstArgumentOf, isGroup, isTest } from '../../../kit/project/test-calls.js';
import { reachedBy, testBaseOf, testTitle } from '../../../kit/project/test-title.js';
import { consumerRows } from '../../catalogue/manifest.js';
import { mergeFix, restatesSubject } from './one-describe-per-file.merge.js';
import type { FileSubject } from './one-describe-per-file.merge.js';

function runFinding(members: AstNode[]): undefined | { messageId: string; node: AstNode } {
    const [only, second] = members.filter((statement) => isGroup(statement));
    const stray = members.find((statement) => isTest(statement));
    if (only === undefined) {
        // Stryker disable next-line ConditionalExpression: a member that is no group is a test
        return stray === undefined ? undefined : { messageId: 'noDescribe', node: stray };
    }
    if (second !== undefined) {
        return { messageId: 'severalDescribes', node: second };
    }
    return stray === undefined ? undefined : { messageId: 'testOutside', node: stray };
}

type TitleFinding = { messageId: string; node: AstNode };

// invariant: a title the author wrote is never rewritten: it is reported, and the author retitles it. A title that states the file's subject in other words (its name read with spaces, 'cli reference' for `cli-reference.spec.ts`) is the subject all the same.
function titleFinding(group: AstNode, subject: FileSubject): TitleFinding | undefined {
    const { named } = subject;
    const title = firstArgumentOf(group);
    const said = stringValue(title);
    // Stryker disable next-line OptionalChaining: a group is a call, which has a callee
    const parametrised = calleeOf(group)?.type === 'CallExpression';
    if (
        title === undefined ||
        // Stryker disable next-line ConditionalExpression: a title equal to the subject restates it, which `restatesSubject` answers alike
        said === named ||
        (said !== undefined && restatesSubject(said, subject)) ||
        (parametrised && said?.startsWith(`${named} — `) === true)
    ) {
        return undefined;
    }

    return { messageId: parametrised ? 'tableTitle' : 'wrongTitle', node: title };
}

const row = rowNamed(consumerRows, 'one-describe-per-file');

/** A group holding anything but tests, or running per row, is left to its author: the merge would change the scope of its hooks and table. */
export const oneDescribePerFile = defineRule(
    {
        docs: row,
        fixable: 'code',
        messages: {
            noDescribe: {
                found: 'the tests of this file stand in no `describe`',
                fix: "wrap them in `describe('{{named}}', () => { ... })`; `typescript fix` does it",
            },
            severalDescribes: {
                found: 'a second top-level `describe` in a file about one {{what}}',
                fix: "merge the groups under `describe('{{named}}', ...)`, every test keeping its title (`typescript fix` does it when every group holds tests alone and no two tests share a title), or move this one to a file of its own {{what}}",
            },
            tableTitle: {
                found: 'the file\'s `describe.each` is titled "{{title}}"',
                fix: "start its title with the file's {{what}}, '{{named}} — ...', keeping what names its rows",
            },
            testOutside: {
                found: 'a test beside the `describe` of the file',
                fix: "move it inside `describe('{{named}}', ...)`; `typescript fix` does it when the group holds tests alone",
            },
            wrongTitle: {
                found: 'the file\'s `describe` is titled "{{title}}"',
                fix: "title it '{{named}}', the file's {{what}}, or in the words of the file's name: 'cli reference' for `cli-reference.spec.ts`",
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => isTestRole(identityOf(context).role),
                Program(program: AstNode) {
                    const statements = childList(program, 'body');
                    const members = statements.filter((node) => isGroup(node) || isTest(node));
                    // Stryker disable next-line ConditionalExpression,BlockStatement: no member yields no finding below
                    if (members.length === 0) {
                        return;
                    }
                    const { named, what } = testTitle(context.filename, identityOf(context).role);
                    const subject = {
                        base: testBaseOf(context.filename),
                        named,
                        reached: reachedBy(context.filename, context.sourceCode.text),
                    };
                    const finding = runFinding(members);
                    if (finding !== undefined) {
                        const source = context.sourceCode.text;
                        const fix = mergeFix(source, statements, members, subject);
                        context.report({ ...finding, ...(fix && { fix }), data: { named, what } });
                        return;
                    }
                    const [only] = members;
                    // Stryker disable ConditionalExpression: a member is always there
                    const title = only === undefined ? undefined : titleFinding(only, subject);
                    // Stryker restore ConditionalExpression
                    if (title !== undefined) {
                        // Stryker disable next-line LogicalOperator: a member is always there
                        const said = stringValue(firstArgumentOf(only ?? program));
                        context.report({
                            ...title,
                            data: { named, title: said ?? 'a computed title', what },
                        });
                    }
                },
            };
        },
    },
);
