import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { child, isTestCallee, testName, walk } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

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

export const specFileWithinLineLimit: LintRule = {
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
        docs: rowNamed(consumerRows, 'spec-file-within-line-limit'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'spec-file-within-line-limit'),
            {
                tooLong: {
                    found: 'a spec file of {{lines}} lines, over {{max}}',
                    fix: 'cut it along its tests’ groups — {{groups}} — one aspect per file',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'suggestion',
    },
};
