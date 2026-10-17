import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    specificationMember,
    stringField,
    stringValue,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { consumerRows } from '../../catalogue/manifest.js';

const THIRD_PARTY_BIN = /node_modules[/\\]\.bin[/\\]/u;

function embedsThirdPartyBin(root: AstNode | null | undefined): boolean {
    // Stryker disable next-line ConditionalExpression,LogicalOperator: the plugin hands a missing child as undefined, never null
    if (root === null || root === undefined) {
        return false;
    }
    let found = false;
    walk(root, (node) => {
        // Stryker disable next-line ConditionalExpression: once found, the walk only spares itself the rest
        if (found) {
            return;
        }
        const value = stringValue(node);
        // Stryker disable next-line ConditionalExpression: no string matches no path
        if (value !== undefined && THIRD_PARTY_BIN.test(value)) {
            found = true;
        }
    });
    return found;
}

const row = rowNamed(consumerRows, 'cli-runs-the-product-binary');

/** Reads the hoisted `const BIN = resolve(..., '.../.bin/oxlint')` idiom too. A runner created outside a specification file is `runner-in-specification-file`'s finding. */
export const cliRunsTheProductBinary = defineRule(
    {
        docs: row,
        messages: {
            thirdPartyBinary: {
                found: '`specification.cli()` points at a third-party binary under `node_modules/.bin`',
                fix: "point it at the product's own command (`bin/<product>`), or suppress with a reason when the product genuinely is this binary",
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => identityOf(context).role === 'specification',
                Program(program: AstNode) {
                    const binVars = new Set<string>();
                    walk(program, (node) => {
                        // Stryker disable next-line ConditionalExpression,BlockStatement: only a declarator has both an id and an init
                        if (node.type !== 'VariableDeclarator') {
                            return;
                        }
                        const id = child(node, 'id');
                        const init = child(node, 'init');
                        // Stryker disable next-line ConditionalExpression,LogicalOperator,OptionalChaining: a pattern binds no name a runner is handed
                        if (id?.type === 'Identifier' && embedsThirdPartyBin(init)) {
                            binVars.add(stringField(id, 'name') ?? '');
                        }
                    });

                    walk(program, (node) => {
                        // Stryker disable next-line ConditionalExpression,LogicalOperator: specificationMember reads no member from a non-call
                        if (node.type !== 'CallExpression' || specificationMember(node) !== 'cli') {
                            return;
                        }
                        const arg = childList(node, 'arguments')[0];
                        if (arg === undefined) {
                            return;
                        }
                        const flagged =
                            embedsThirdPartyBin(arg) ||
                            // Stryker disable next-line ConditionalExpression: only an identifier has a name
                            (arg.type === 'Identifier' &&
                                binVars.has(stringField(arg, 'name') ?? ''));
                        if (flagged) {
                            context.report({ messageId: 'thirdPartyBinary', node });
                        }
                    });
                },
            };
        },
    },
);
