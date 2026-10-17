import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, walk } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { MAX_SPEC_LINES } from '../../../kit/project/specs-modules.js';
import { isTestCallee, testName } from '../../../kit/project/test-calls.js';
import { consumerRows } from '../../catalogue/manifest.js';

const GROUPS_SHOWN = 5;

// invariant: what stands before ` — ` or `:`, else the first word.
function titlePrefix(title: string): string {
    const head = title.split(/ — |: /u)[0] ?? title;
    // Stryker disable next-line Regex: only the first word is kept, wherever the run of spaces ends
    return head === title ? (title.split(/\s+/u)[0] ?? title) : head;
}

/** `rejects (6), accepts (3), ...`, largest first. */
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

const row = rowNamed(consumerRows, 'spec-file-within-line-limit');

export const specFileWithinLineLimit = defineRule(
    {
        docs: row,
        messages: {
            tooLong: {
                found: 'a spec file of {{lines}} lines, over {{max}}',
                fix: 'cut it along its tests’ groups — {{groups}} — one aspect per file',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => identityOf(context).role === 'spec',
                Program(program: AstNode) {
                    // Stryker disable next-line StringLiteral: what replaces the last newline holds none
                    const lines = context.sourceCode.text.replace(/\n$/u, '').split('\n').length;
                    if (lines <= MAX_SPEC_LINES) {
                        return;
                    }
                    // Stryker disable next-line ArrayDeclaration: the report is only ever read for its groups
                    const titles: string[] = [];
                    walk(program, (node) => {
                        // Stryker disable next-line ConditionalExpression,LogicalOperator: only a call has a test callee
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
    },
);
