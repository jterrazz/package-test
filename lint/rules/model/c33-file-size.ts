import type { Context } from '@oxlint/plugins';

import { child, isTestCallee, testName, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The most lines a spec file holds. */
export const MAX_SPEC_LINES = 400;

/** How many groups the message lists. */
const GROUPS_SHOWN = 5;

/** The prefix a title groups under: what stands before ` — ` or `:`, else its first word. */
export function titlePrefix(title: string): string {
    const head = title.split(/ — |: /u)[0] ?? title;
    return head === title ? (title.split(/\s+/u)[0] ?? title) : head;
}

/** `rejects (6), accepts (3), …` — the tests grouped by their title's prefix, largest first. */
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

/**
 * CONVENTIONS C33 — a spec file holds at most {@link MAX_SPEC_LINES} lines. A
 * file past it asks several questions of its subject, and a reader looking for
 * one scrolls through the others; the message groups its tests by the prefix
 * of their titles, which is usually where the cut goes. A file that is past it
 * today is recorded on the ratchet and may only shrink.
 */
export const c33FileSize: LintRule = {
    create(context: Context): Visitor {
        if (identityOf(context).role !== 'spec') {
            return {};
        }
        return {
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
