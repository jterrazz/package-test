import {
    child,
    childList,
    findTestCallback,
    isTestCallee,
    markerComments,
    markerOf,
    nodeStart,
} from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestRole, roleOf } from '../role.js';
import type { AstNode, Comment, LintRule, RuleContext } from '../types.js';

/**
 * A directive, not prose — a tool's instruction that happens to be a comment.
 *
 * A suppression written under a marker is not a wrapped sentence: folding it
 * into the marker line would DISABLE it, and reporting it would tell the author
 * to do exactly that. The one place the two shapes meet is here, so the list
 * lives here.
 */
const DIRECTIVE =
    /^(?:oxlint|eslint|checker|prettier|biome|dprint)-(?:disable|enable)|^@ts-|^(?:v8|c8|node|istanbul) ignore|^type-coverage:/u;

/** Is the comment an instruction to a tool rather than a sentence to a reader? */
function isDirective(comment: Comment): boolean {
    return DIRECTIVE.test(comment.value.trim());
}

/** Where a line starts, for the offset given. */
function lineStartAt(text: string, offset: number): number {
    return text.lastIndexOf('\n', offset - 1) + 1;
}

/** Where the line holding the offset ends (the newline, or the end of file). */
function lineEndAt(text: string, offset: number): number {
    const newline = text.indexOf('\n', offset);
    return newline === -1 ? text.length : newline;
}

/**
 * CONVENTIONS B11 — a marker is exactly one line.
 *
 * The narration is a SENTENCE about the subject, and a sentence that runs onto
 * a second comment line stops being one: the reader meets a paragraph where the
 * dialect promised a line, and the second line is invisible to every tool that
 * reads the marker (B4's order, the catalogue, a reviewer skimming). The
 * criterion is mechanical — a marker comment with another `//` comment directly
 * below it at the same indentation — and so is the fix: fold the continuation
 * into the sentence, or separate the two with a blank line so the second is a
 * comment of its own.
 */
export const b11MarkerOneLine: LintRule = {
    create(context: RuleContext) {
        if (!isTestRole(roleOf(context.filename).role)) {
            return {};
        }
        const { text } = context.sourceCode;
        return {
            CallExpression(node: AstNode) {
                if (!isTestCallee(child(node, 'callee'))) {
                    return;
                }
                const callback = findTestCallback(childList(node, 'arguments'));
                if (callback === undefined) {
                    return;
                }
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
        messages: {
            wrapped:
                'A marker is exactly one line: fold the continuation into the sentence or separate it with a blank line.',
        },
        type: 'problem',
    },
};
