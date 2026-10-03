import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Comment, Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList, nodeStart } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import {
    findTestCallback,
    isTestCallee,
    markerComments,
    markerOf,
} from '../../../kit/project/test-calls.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** Folding a suppression into the marker line would disable it: `-disable`/`-enable`, and the formatters' `-ignore` (`oxfmt-ignore` is the estate's). */
const DIRECTIVE =
    /^(?:oxlint|eslint|checker|prettier|biome|dprint)-(?:disable|enable)|^(?:prettier|oxfmt|biome|dprint)-ignore|^@ts-|^(?:v8|c8|node|istanbul) ignore|^type-coverage:/u;

function isDirective(comment: Comment): boolean {
    return DIRECTIVE.test(comment.value.trim());
}

function lineStartAt(text: string, offset: number): number {
    // Stryker disable next-line ArithmeticOperator: a comment's offset and the one after it are both `/`, never a newline
    return text.lastIndexOf('\n', offset - 1) + 1;
}

function lineEndAt(text: string, offset: number): number {
    const newline = text.indexOf('\n', offset);
    // Stryker disable next-line ConditionalExpression,UnaryOperator: a comment inside a test's callback always has the callback's close on a line below
    return newline === -1 ? text.length : newline;
}

const row = rowNamed(consumerRows, 'marker-on-one-line');

/** The criterion is a marker comment with another `//` comment directly below it at the same indentation. */
export const markerOnOneLine = defineRule(
    {
        docs: row,
        messages: {
            wrapped: {
                found: 'a marker continued on the comment line under it',
                fix: "fold the continuation into the marker's one line, or separate the two with a blank line",
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
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
                        .filter((comment) => comment.type === 'Line');
                    for (const found of markerComments(comments)) {
                        const { start } = found;
                        // Stryker disable next-line ConditionalExpression,EqualityOperator: a marker found inside a comment always has its offset
                        if (start < 0) {
                            continue;
                        }
                        const indent = text.slice(lineStartAt(text, start), start);
                        // invariant: a marker trailing code is out of this rule's reach.
                        if (indent.trim() !== '') {
                            continue;
                        }
                        const nextLineStart = lineEndAt(text, start) + 1;
                        const continuation = comments.find((comment: Comment) => {
                            const at = nodeStart(comment);
                            return (
                                // Stryker disable next-line EqualityOperator: a comment never starts on a line's newline
                                at >= nextLineStart &&
                                // Stryker disable next-line EqualityOperator: a comment never starts on a line's newline
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
    },
);
