import type { Context, FixFn } from '@oxlint/plugins';

import { childList, nodeEnd, nodeStart, stringValue } from '../../ast.js';
import {
    calleeOf,
    escapedFor,
    firstArgumentOf,
    flattenedGroup,
    groupBodyOf,
    isGroup,
    isTest,
    mergeFix,
} from '../../describe-merge.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';
import { testTitle } from '../../test-title.js';

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
 * its fix: a plain group's renamed, the title it said kept on each of its
 * tests when it holds tests alone; a table's — `describe.each(…)(…)`, run
 * once per row — prefixed so what names its rows stays, unless it is computed.
 */
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
                fix: "title it '{{named}}', the file's {{what}} — `make fix` renames it, keeping the title it said on each of its tests when it holds tests alone",
            },
        }),
        type: 'suggestion',
    },
};
