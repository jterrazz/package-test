import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context, FixFn } from '@oxlint/plugins';

import {
    calleeOf,
    childList,
    escapedFor,
    firstArgumentOf,
    groupBodyOf,
    isGroup,
    isTest,
    nodeEnd,
    nodeStart,
    stringValue,
} from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import { testTitle } from '../../../engine/project/test-title.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';
import { flattenedGroup, mergeFix } from './one-describe-per-file.merge.js';

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

/** A table's title is prefixed so what names its rows stays, unless it is computed. */
function titleFinding(
    source: string,
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
        const body = groupBodyOf(group);
        const kept = flattenedGroup(source, group, named);
        const fix: FixFn = (fixer) => [
            fixer.replaceTextRange([nodeStart(title), nodeEnd(title)], `'${named}'`),
            ...(body === undefined || kept === undefined
                ? []
                : [fixer.replaceTextRange([nodeStart(body) + 1, nodeEnd(body) - 1], kept)]),
        ];
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

const row = rowNamed(consumerRows, 'one-describe-per-file');

/** A group holding anything but tests, or running per row, is left to its author: the merge would change the scope of its hooks and table. */
export const oneDescribePerFile = defineRule(
    {
        docs: row,
        fixable: 'code',
        messages: {
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
                fix: "title it '{{named}}', the file's {{what}} — `make fix` renames it, keeping the title it said on each of its tests when it holds tests alone",
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
                    const title =
                        only === undefined
                            ? undefined
                            : titleFinding(context.sourceCode.text, only, named);
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
    },
);
