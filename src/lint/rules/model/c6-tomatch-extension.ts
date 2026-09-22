import { memberPropertyName, stringValue } from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/**
 * CONVENTIONS C6 — the extension is part of a golden file's path and mandatory
 * in `toMatchFile` (`'./expected/help.txt'`, never `'./expected/help'`). A tree
 * is `toMatchDirectory`, whose path ends in `/` — out of this rule's reach.
 */
export const c6ToMatchExtension: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        const { inSpecs, role } = roleOf(file);
        if (!isTestRole(role) || !inSpecs) {
            return {};
        }
        return {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                if (callee === undefined || memberPropertyName(callee) !== 'toMatchFile') {
                    return;
                }
                const argument = (node.arguments as AstNode[] | undefined)?.[0];
                const name = stringValue(argument);
                if (name === undefined || name.length === 0) {
                    return;
                }
                const base = name.split('/').at(-1) ?? '';
                if (base.includes('.')) {
                    return;
                }
                context.report({ data: { name }, messageId: 'missingExtension', node: argument });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c6-tomatch-extension'],
        messages: {
            missingExtension:
                'toMatchFile("{{name}}") is missing its extension — the extension is part of the golden\'s path ("./expected/help.txt", never "./expected/help"); a tree is toMatchDirectory("./expected/<name>/").',
        },
        type: 'problem',
    },
};
