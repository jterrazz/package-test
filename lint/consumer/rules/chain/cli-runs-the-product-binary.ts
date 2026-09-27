import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { specificationMember, stringValue, walk } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const THIRD_PARTY_BIN = /node_modules[/\\]\.bin[/\\]/u;

function embedsThirdPartyBin(root: AstNode | null | undefined): boolean {
    if (root === null || root === undefined) {
        return false;
    }
    let found = false;
    walk(root, (node) => {
        if (found) {
            return;
        }
        const value = stringValue(node);
        if (value !== undefined && THIRD_PARTY_BIN.test(value)) {
            found = true;
        }
    });
    return found;
}

const row = rowNamed(consumerRows, 'cli-runs-the-product-binary');

/** Reads the hoisted `const BIN = resolve(…, '…/.bin/oxlint')` idiom too. A runner created outside a specification file is `runner-in-specification-file`'s finding. */
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
                        if (node.type !== 'VariableDeclarator') {
                            return;
                        }
                        const id = node.id as AstNode | undefined;
                        const init = node.init as AstNode | null | undefined;
                        if (id?.type === 'Identifier' && embedsThirdPartyBin(init)) {
                            binVars.add(id.name as string);
                        }
                    });

                    walk(program, (node) => {
                        if (node.type !== 'CallExpression' || specificationMember(node) !== 'cli') {
                            return;
                        }
                        const arg = (node.arguments as AstNode[] | undefined)?.[0];
                        if (arg === undefined) {
                            return;
                        }
                        const flagged =
                            embedsThirdPartyBin(arg) ||
                            (arg.type === 'Identifier' && binVars.has(arg.name as string));
                        if (flagged) {
                            context.report({ messageId: 'thirdPartyBinary', node });
                        }
                    });
                },
            };
        },
    },
);
