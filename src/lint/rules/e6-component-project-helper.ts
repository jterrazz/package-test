import { child, identifierName, propertyKeyName, walk } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

/** Is this node inside a call to `component(...)`? */
function insideComponentCall(node: AstNode): boolean {
    for (
        let current = child(node, 'parent');
        current !== undefined;
        current = child(current, 'parent')
    ) {
        if (
            current.type === 'CallExpression' &&
            identifierName(child(current, 'callee')) === 'component'
        ) {
            return true;
        }
    }
    return false;
}

/**
 * CONVENTIONS E6 — a browser project comes from `component()`.
 *
 * A hand-rolled `browser: { … }` block is a project that has to rediscover
 * everything the seam already knows: the provider pinned to the runner's exact
 * version, the service worker served from the framework's own install, the JSX
 * transform the current Vite actually uses, the dependencies a cold cache must
 * pre-bundle, and the artefact directories Browser Mode otherwise leaks at the
 * repository root. Every one of those is a run that fails on the second
 * machine, so the helper owns them and a config states only what is its own.
 */
export const e6ComponentProjectHelper: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.physicalFilename).role !== 'config') {
            return {};
        }
        return {
            Program(node: AstNode) {
                walk(node, (candidate: AstNode) => {
                    if (candidate.type !== 'Property' || propertyKeyName(candidate) !== 'browser') {
                        return;
                    }
                    if (!insideComponentCall(candidate)) {
                        context.report({ messageId: 'handRolled', node: candidate });
                    }
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['e6-component-project-helper'],
        messages: {
            handRolled:
                'Use `component({ vite })` — the provider, the worker and the pipeline are its, and a hand-rolled `browser:` block is the run that passes here and fails on the next machine (E6 — docs/13-linting.md#e6-component-project-helper).',
        },
        type: 'problem',
    },
};
