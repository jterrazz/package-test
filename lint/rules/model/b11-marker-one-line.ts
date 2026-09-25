import type { Comment, Context } from '@oxlint/plugins';

import {
    child,
    childList,
    findTestCallback,
    isTestCallee,
    markerComments,
    markerOf,
    nodeStart,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole } from '../../role.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** Folding a suppression into the marker line would disable it: `-disable`/`-enable`, and the formatters' `-ignore` (`oxfmt-ignore` is the estate's). */
const DIRECTIVE =
    /^(?:oxlint|eslint|checker|prettier|biome|dprint)-(?:disable|enable)|^(?:prettier|oxfmt|biome|dprint)-ignore|^@ts-|^(?:v8|c8|node|istanbul) ignore|^type-coverage:/u;

function isDirective(comment: Comment): boolean {
    return DIRECTIVE.test(comment.value.trim());
}

function lineStartAt(text: string, offset: number): number {
    return text.lastIndexOf('\n', offset - 1) + 1;
}

function lineEndAt(text: string, offset: number): number {
    const newline = text.indexOf('\n', offset);
    return newline === -1 ? text.length : newline;
}

/** The criterion is a marker comment with another `//` comment directly below it at the same indentation. */
export const b11MarkerOneLine: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => isTestRole(identityOf(context).role),
            CallExpression(node: AstNode) {
                if (!isTestCallee(child(node, 'callee'))) {
                    return;
                }
                const callback = findTestCallback(childList(node, 'arguments'));
                if (callback === undefined) {
                    return;
                }
                const { text } = context.sourceCode;
                const comments = context.sourceCode
                    .getCommentsInside(callback)
                    .filter((comment) => comment.type === 'Line' && nodeStart(comment) >= 0)
                    .toSorted((a, b) => nodeStart(a) - nodeStart(b));
                for (const found of markerComments(comments)) {
                    const { start } = found;
                    if (start < 0) {
                        continue;
                    }
                    const indent = text.slice(lineStartAt(text, start), start);
                    // A marker trailing code is A9's business, not this rule's.
                    if (indent.trim() !== '') {
                        continue;
                    }
                    const nextLineStart = lineEndAt(text, start) + 1;
                    const continuation = comments.find((comment: Comment) => {
                        const at = nodeStart(comment);
                        return (
                            at >= nextLineStart &&
                            at <= lineEndAt(text, nextLineStart) &&
                            text.slice(lineStartAt(text, at), at) === indent &&
                            markerOf(comment) === undefined &&
                            !isDirective(comment)
                        );
                    });
                    if (continuation !== undefined) {
                        context.report({ messageId: 'wrapped', node: found.comment });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['b11-marker-one-line'],
        messages: lessons('b11-marker-one-line', {
            wrapped: {
                found: 'a marker continued on the comment line under it',
                fix: "fold the continuation into the marker's one line, or separate the two with a blank line",
            },
        }),
        type: 'problem',
    },
};
