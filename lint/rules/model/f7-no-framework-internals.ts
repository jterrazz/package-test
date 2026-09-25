import type { Context } from '@oxlint/plugins';

import { importSourceVisitor } from '../../ast.js';
import { lessonsAt } from '../../lesson.js';
import { specsAnchorOf } from '../../linted-file.js';
import type { LintRule, Visitor } from '../../rule-shape.js';
import { SELF_CHAPTER, SELF_RULE_DOCS, selfRowOf } from '../../self-manifest.js';

/**
 * The framework's own top-level `src/` layers. Deep-importing any of these from
 * a spec couples the spec to internals the public entry exists to hide. These
 * segment names are the framework's layers in this repository alone — a
 * spec's import of its own app (`server: () => createApp()` importing
 * `../../src/app.js`) names none of them, and stays allowed.
 */
const FRAMEWORK_LAYERS = new Set([
    'actions',
    'capabilities',
    'facets',
    'lint',
    'model',
    'results',
    'runner',
    'seams',
    'stubs',
]);

/**
 * CONVENTIONS F7 — from `specs/`, a relative import resolving inside the
 * framework repo's `src/{model,capabilities,actions,stubs,results,facets,seams,runner,lint}/` is forbidden: a
 * spec of the framework reaches it through the public entry, as a consumer
 * does. A consumer's imports of its OWN app source are always allowed — that
 * is the pattern.
 *
 * A `self` rule: those folder names mean the framework's layers only in
 * this repository, so the rule ships in the self plugin alone. A
 * `@jterrazz/test/<subpath>` import is F1's, from any file.
 */
export const f7NoFrameworkInternals: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => specsAnchorOf(context) !== undefined,
            ...importSourceVisitor(({ node, source }) => {
                // Relative imports that resolve inside a `src/` tree.
                const marker = source.indexOf('/src/');
                if (marker === -1 && !source.startsWith('src/')) {
                    return;
                }
                const internal = marker === -1 ? source.slice(4) : source.slice(marker + 5);
                const layer = internal.split('/')[0] ?? '';
                if (!FRAMEWORK_LAYERS.has(layer)) {
                    return; // Consumer's own app source (e.g. src/app.js) — the pattern.
                }
                context.report({
                    data: { source },
                    messageId: 'deepImport',
                    node,
                });
            }),
        };
    },
    meta: {
        docs: SELF_RULE_DOCS['f7-no-framework-internals'],
        messages: lessonsAt(
            selfRowOf('f7-no-framework-internals'),
            {
                deepImport: {
                    found: 'a spec deep-imports "{{source}}", a framework internal',
                    fix: 'import it from `@jterrazz/test` (`src/index.js` in this repository); a probe of what the entry does not publish is a module test beside its module',
                },
            },
            SELF_CHAPTER,
        ),
        type: 'problem',
    },
};
