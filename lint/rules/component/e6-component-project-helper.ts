import { child, identifierName, propertyKeyName, walk } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';

/** Is this property the RUNNER's browser block, rather than a key that shares its name? */
function isRunnerBrowserBlock(node: AstNode): boolean {
    for (
        let current = child(node, 'parent');
        current !== undefined;
        current = child(current, 'parent')
    ) {
        if (current.type === 'Property' && propertyKeyName(current) === 'test') {
            return true;
        }
    }
    return false;
}

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
        if (identityOf(context).role !== 'config') {
            return {};
        }
        return {
            Program(node: AstNode) {
                walk(node, (candidate: AstNode) => {
                    if (candidate.type !== 'Property' || propertyKeyName(candidate) !== 'browser') {
                        return;
                    }
                    // A `browser` key somewhere else in a config — a `define`
                    // Flag, an env record — is not a project's browser block.
                    // The runner's sits under `test`.
                    if (!isRunnerBrowserBlock(candidate)) {
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
        messages: lessons('e6-component-project-helper', {
            handRolled: {
                found: 'a hand-rolled `browser:` block in a vitest config',
                fix: "replace it with `component({ vite: './vite.config.ts' })`, which sets the provider, the worker and the pipeline",
            },
        }),
        type: 'problem',
    },
};
