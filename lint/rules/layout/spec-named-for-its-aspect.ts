import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import type { AstNode } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import { aspectOf } from '../../reading/test-title.js';
import type { LintRule, Visitor } from '../rule.js';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const GENERIC_ASPECTS = new Set([
    'basic',
    'edge-cases',
    'general',
    'main',
    'misc',
    'more',
    'other',
    'tests',
]);

export const specNamedForItsAspect: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => identityOf(context).role === 'spec',
            Program(program: AstNode) {
                const aspect = aspectOf(context.filename);
                if (!KEBAB.test(aspect)) {
                    context.report({
                        data: {
                            aspect,
                            kebab: aspect
                                .replaceAll(
                                    /(?<lower>[a-z0-9])(?<upper>[A-Z])/gu,
                                    '$<lower>-$<upper>',
                                )
                                .toLowerCase()
                                .replaceAll(/[^a-z0-9]+/gu, '-')
                                .replaceAll(/^-|-$/gu, ''),
                        },
                        messageId: 'notKebab',
                        node: program,
                    });
                    return;
                }
                if (GENERIC_ASPECTS.has(aspect)) {
                    context.report({ data: { aspect }, messageId: 'generic', node: program });
                }
            },
        };
    },
    meta: {
        docs: rowOf('spec-named-for-its-aspect'),
        messages: lessons('spec-named-for-its-aspect', {
            generic: {
                found: 'the aspect "{{aspect}}" names no question about the subject',
                fix: 'rename the file for what its tests ask — `pagination`, `filters`, `validation`, `not-found`, `auth`, `shape` — and split it when they ask several',
            },
            notKebab: {
                found: 'the aspect "{{aspect}}" is not kebab-case',
                fix: 'rename the file `{{kebab}}.spec.ts`',
            },
        }),
        type: 'suggestion',
    },
};
