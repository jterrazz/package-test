import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import {
    findProperty,
    memberPropertyName,
    specificationMember,
    stringValue,
} from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { TOKEN_KINDS } from '../../../engine/project/tokens.js';
import { consumerRows } from '../../catalogue/manifest.js';

const KNOWN_TOKEN_LITERAL = new RegExp(
    `^\\{\\{(?:${TOKEN_KINDS.join('|')})(?:#[\\w.-]+)?\\}\\}$`,
    'u',
);

/** Every replacement must be a string literal that is exactly a known `{{token}}`. */
function isTokenEquivalentTransform(fn: AstNode): boolean {
    if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') {
        return false;
    }
    let expression = fn.body as AstNode | undefined;
    if (expression?.type === 'BlockStatement') {
        const statements = (expression.body as AstNode[] | undefined) ?? [];
        const [only] = statements;
        if (statements.length !== 1 || only?.type !== 'ReturnStatement') {
            return false;
        }
        expression = only.argument as AstNode | undefined;
    }
    let sawReplace = false;
    while (expression?.type === 'CallExpression') {
        const callee = expression.callee as AstNode | undefined;
        if (callee === undefined || memberPropertyName(callee) !== 'replace') {
            return false;
        }
        const replacement = stringValue((expression.arguments as AstNode[] | undefined)?.[1]);
        if (replacement === undefined || !KNOWN_TOKEN_LITERAL.test(replacement)) {
            return false;
        }
        sawReplace = true;
        expression = callee.object as AstNode | undefined;
    }
    return sawReplace && expression?.type === 'Identifier';
}

export const noTransformDuplicatingTokens: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            CallExpression(node: AstNode) {
                if (specificationMember(node) === undefined) {
                    return;
                }
                for (const argument of (node.arguments as AstNode[] | undefined) ?? []) {
                    const transform = findProperty(argument, 'transform');
                    const fn = transform?.value as AstNode | undefined;
                    if (fn !== undefined && isTokenEquivalentTransform(fn)) {
                        context.report({ messageId: 'tokenEquivalent', node: transform ?? node });
                    }
                }
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'no-transform-duplicating-tokens'),
        messages: lessonsAt(rowNamed(consumerRows, 'no-transform-duplicating-tokens'), {
            tokenEquivalent: {
                found: 'a `transform` that only rewrites output into token literals',
                fix: 'delete the transform and write the tokens in the expectation; `transform` is for noise no token covers',
            },
        }),
        type: 'suggestion',
    },
};
