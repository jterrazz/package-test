import { child, propertyKeyName, stringValue, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** The two simulated DOMs. */
const SIMULATED = new Set(['happy-dom', 'jsdom']);

/**
 * CONVENTIONS E5b — the same ban, where a project states it for a whole tree.
 *
 * The pragma (E5) is one file's; `environment: 'happy-dom'` in a config is
 * every file the project collects, which is how a repository ends up with a
 * simulated DOM nobody ever chose per test. `'node'` and `'edge-runtime'` are
 * out of reach: they name a real runtime, not a drawing of one.
 */
export const e5bNoSimulatedDomConfig: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.physicalFilename).role !== 'config') {
            return {};
        }
        return {
            Program(node: AstNode) {
                walk(node, (candidate: AstNode) => {
                    if (
                        candidate.type !== 'Property' ||
                        propertyKeyName(candidate) !== 'environment'
                    ) {
                        return;
                    }
                    const environment = stringValue(child(candidate, 'value'));
                    if (environment !== undefined && SIMULATED.has(environment)) {
                        context.report({
                            data: { environment },
                            messageId: 'configured',
                            node: candidate,
                        });
                    }
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e5b-no-simulated-dom-config'],
        messages: {
            configured:
                "`environment: '{{environment}}'` gives every file of this project a drawing of a browser — a rendered thing is a `.test.tsx` beside its component, collected by `component()` (E5b — docs/13-linting.md#e5b-no-simulated-dom-config).",
        },
        type: 'problem',
    },
};
