import type { Context } from '@oxlint/plugins';

import { specificationMember, stringValue, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** A path segment that marks a third-party package's installed binary. */
const THIRD_PARTY_BIN = /node_modules[/\\]\.bin[/\\]/u;

/** Does any string literal reachable from `root` resolve into a `.bin` dir? */
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

/**
 * CONVENTIONS B9 (warning) — a spec exercises the product's REAL commands, not
 * the third-party binaries underneath it.
 *
 * When the binary handed to `specification.cli(<bin>, …)` resolves into a
 * dependency's `node_modules/.bin/`, the spec is testing the tool directly
 * rather than the product command that composes it. Detects the literal both
 * inline (`specification.cli('…/node_modules/.bin/oxlint')`, or wrapped in a
 * `resolve(...)`) and via a local `const BIN = resolve(…, '…/.bin/oxlint')`
 * hoisted out of the call — the idiom real specs use. Advisory: it may be
 * legitimately suppressed with a reason when the product genuinely IS that
 * binary (e.g. a package whose product is a lint plugin driving oxlint).
 *
 * It reads a specification file alone: A1 refuses a runner created anywhere
 * else, so a `specification.cli(…)` elsewhere is A1's finding, not this one's.
 */
export const b9wProductCommand: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => identityOf(context).role === 'specification',
            Program(program: AstNode) {
                // Local `const X = …/.bin/…` bindings whose value is a bin path.
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
        docs: RULE_DOCS['b9w-product-command'],
        messages: lessons('b9w-product-command', {
            thirdPartyBinary: {
                found: '`specification.cli()` points at a third-party binary under `node_modules/.bin`',
                fix: "point it at the product's own command (`bin/<product>`), or suppress with a reason when the product genuinely is this binary",
            },
        }),
        type: 'suggestion',
    },
};
