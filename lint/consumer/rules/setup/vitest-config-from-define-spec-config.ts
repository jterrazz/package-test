import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { child, childList, identifierName, walk } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const PRESET = 'defineSpecConfig';

const MERGE = 'mergeConfig';

const ANNOTATIONS = new Set(['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression']);

function unwrap(node: AstNode | undefined): AstNode | undefined {
    let current = node;
    while (current !== undefined && ANNOTATIONS.has(current.type)) {
        current = child(current, 'expression');
    }
    return current;
}

function initialiserOf(program: AstNode, name: string): AstNode | undefined {
    let found: AstNode | undefined;
    walk(program, (node) => {
        if (
            node.type === 'VariableDeclarator' &&
            identifierName(child(node, 'id')) === name &&
            found === undefined
        ) {
            found = unwrap(child(node, 'init'));
        }
    });
    return found;
}

/** Followed one argument deep: a preset under two merges is a config a reader can no longer place. */
function startsFromThePreset(node: AstNode | undefined): boolean {
    if (node?.type !== 'CallExpression') {
        return false;
    }
    const callee = identifierName(child(node, 'callee'));
    if (callee === PRESET) {
        return true;
    }
    if (callee !== MERGE) {
        return false;
    }
    return childList(node, 'arguments').some(
        (argument) => identifierName(child(unwrap(argument), 'callee')) === PRESET,
    );
}

const row = rowNamed(consumerRows, 'vitest-config-from-define-spec-config');

/** `export default <Identifier>` and a `satisfies`/`as` annotation both resolve. */
export const vitestConfigFromDefineSpecConfig = defineRule(
    {
        docs: row,
        messages: {
            offPreset: {
                found: 'a vitest config that does not default-export `defineSpecConfig(…)`',
                fix: "wrap it: `export default defineSpecConfig({ … })`, from `@jterrazz/test/vitest` — the budgets, the artefact directory and the ground exclusion are the preset's",
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => identityOf(context).role === 'config',
                Program(program: AstNode) {
                    walk(program, (node) => {
                        if (node.type !== 'ExportDefaultDeclaration') {
                            return;
                        }
                        let exported = unwrap(child(node, 'declaration'));
                        const name = identifierName(exported);
                        if (name !== undefined) {
                            exported = initialiserOf(program, name);
                        }
                        if (startsFromThePreset(exported)) {
                            return;
                        }
                        context.report({ messageId: 'offPreset', node });
                    });
                },
            };
        },
    },
);
