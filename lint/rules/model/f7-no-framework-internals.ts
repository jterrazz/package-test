import type { Context } from '@oxlint/plugins';

import { importSourceVisitor } from '../../ast.js';
import { lessonsAt } from '../../lesson.js';
import { specsAnchorOf } from '../../linted-file.js';
import type { LintRule, Visitor } from '../../rule-shape.js';
import { SELF_CHAPTER, SELF_RULE_DOCS, selfRowOf } from '../../self-manifest.js';

/** These segment names are the framework's layers in this repository alone; a spec importing its own app (`../../src/app.js`) names none of them. */
const FRAMEWORK_LAYERS = new Set([
    'elements',
    'expectations',
    'facets',
    'kernel',
    'vitest',
    'world',
]);

/** A `self` rule: the folder names mean the framework's layers only here. */
export const f7NoFrameworkInternals: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => specsAnchorOf(context) !== undefined,
            ...importSourceVisitor(({ node, source }) => {
                const marker = source.indexOf('/src/');
                if (marker === -1 && !source.startsWith('src/')) {
                    return;
                }
                const internal = marker === -1 ? source.slice(4) : source.slice(marker + 5);
                const layer = internal.split('/')[0] ?? '';
                if (!FRAMEWORK_LAYERS.has(layer)) {
                    return;
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
