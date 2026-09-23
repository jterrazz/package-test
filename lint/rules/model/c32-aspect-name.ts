import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';
import { roleOf } from '../../role.js';
import { aspectOf } from './c31-describe-names-file.js';

/** An aspect is lowercase words joined by single hyphens. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** The names that say a file holds what did not fit elsewhere — no aspect at all. */
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

/**
 * CONVENTIONS C32 — a spec file's name is its aspect: kebab-case, and never a
 * name that says the file holds what fit nowhere else (`misc`, `other`,
 * `edge-cases`, …). The folder already says WHAT is specified; the name says
 * which question about it the file answers.
 */
export const c32AspectName: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.filename).role !== 'spec') {
            return {};
        }
        const aspect = aspectOf(context.filename);
        return {
            Program(program: AstNode) {
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
        docs: RULE_DOCS['c32-aspect-name'],
        messages: lessons('c32-aspect-name', {
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
