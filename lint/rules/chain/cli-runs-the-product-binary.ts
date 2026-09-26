import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { specificationMember, stringValue, walk } from '../../reading/ast.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintRule } from '../rule.js';

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

/** Reads the hoisted `const BIN = resolve(…, '…/.bin/oxlint')` idiom too. A runner created outside a specification file is `runner-in-specification-file`'s finding. */
export const cliRunsTheProductBinary: LintRule = {
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
    meta: {
        docs: rowOf('cli-runs-the-product-binary'),
        messages: lessons('cli-runs-the-product-binary', {
            thirdPartyBinary: {
                found: '`specification.cli()` points at a third-party binary under `node_modules/.bin`',
                fix: "point it at the product's own command (`bin/<product>`), or suppress with a reason when the product genuinely is this binary",
            },
        }),
        type: 'suggestion',
    },
};
