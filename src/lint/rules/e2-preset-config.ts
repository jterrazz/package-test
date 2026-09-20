import { child, identifierName, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The helper every vitest config in this vocabulary starts from. */
const PRESET = 'defineSpecConfig';

/** Wrappers that annotate an expression without changing what it IS. */
const ANNOTATIONS = new Set(['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression']);

/** Strip the annotations off an expression. */
function unwrap(node: AstNode | undefined): AstNode | undefined {
    let current = node;
    while (current !== undefined && ANNOTATIONS.has(current.type)) {
        current = child(current, 'expression');
    }
    return current;
}

/** The initialiser of the named const in this file, when it has one. */
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

/**
 * CONVENTIONS E2 — a `vitest.config.*` starts from `defineSpecConfig()`.
 *
 * The preset is where the budgets, the artefact directories, the `_fixtures/`
 * exclusion and the Vitest 5 paths live; a config that starts from `defineConfig`
 * runs the same tests with vitest's five-second budget, writes its attachments
 * at the repository root, and collects the ground its specs stand on as specs.
 * None of that is visible in the file that caused it, which is why it is a rule
 * and not a recommendation.
 *
 * `export default <Identifier>` and a `satisfies`/`as` annotation both resolve:
 * the typed-identifier form is a legitimate spelling of the same config.
 */
export const e2PresetConfig: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.physicalFilename).role !== 'config') {
            return {};
        }
        return {
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
                    if (exported?.type === 'CallExpression') {
                        const callee = identifierName(child(exported, 'callee'));
                        if (callee === PRESET) {
                            return;
                        }
                    }
                    context.report({ messageId: 'offPreset', node });
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e2-preset-config'],
        messages: {
            offPreset:
                "Start from `defineSpecConfig()` — budgets, the artefact dir and the `_fixtures` exclusion are the preset's.",
        },
        type: 'problem',
    },
};
