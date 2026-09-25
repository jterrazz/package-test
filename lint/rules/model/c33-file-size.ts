import type { Context } from '@oxlint/plugins';

import { child, isTestCallee, testName, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

export const MAX_SPEC_LINES = 400;

const GROUPS_SHOWN = 5;

/** What stands before ` — ` or `:`, else the first word. */
export function titlePrefix(title: string): string {
    const head = title.split(/ — |: /u)[0] ?? title;
    return head === title ? (title.split(/\s+/u)[0] ?? title) : head;
}

/** `rejects (6), accepts (3), …`, largest first. */
export function groupsOf(titles: string[]): string {
    const counts = new Map<string, number>();
    for (const title of titles) {
        const prefix = titlePrefix(title);
        counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
    const groups = [...counts].toSorted(
        ([a, left], [b, right]) => right - left || a.localeCompare(b),
    );
    const shown = groups.slice(0, GROUPS_SHOWN).map(([prefix, count]) => `"${prefix}" (${count})`);
    return groups.length > GROUPS_SHOWN ? `${shown.join(', ')}, …` : shown.join(', ');
}

export const c33FileSize: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => identityOf(context).role === 'spec',
            Program(program: AstNode) {
                const lines = context.sourceCode.text.replace(/\n$/u, '').split('\n').length;
                if (lines <= MAX_SPEC_LINES) {
                    return;
                }
                const titles: string[] = [];
                walk(program, (node) => {
                    if (node.type === 'CallExpression' && isTestCallee(child(node, 'callee'))) {
                        titles.push(testName(node) ?? '(a computed title)');
                    }
                });
                context.report({
                    data: { groups: groupsOf(titles), lines, max: MAX_SPEC_LINES },
                    messageId: 'tooLong',
                    node: program,
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c33-file-size'],
        messages: lessons('c33-file-size', {
            tooLong: {
                found: 'a spec file of {{lines}} lines, over {{max}}',
                fix: 'cut it along its tests’ groups — {{groups}} — one aspect per file',
            },
        }),
        type: 'suggestion',
    },
};
