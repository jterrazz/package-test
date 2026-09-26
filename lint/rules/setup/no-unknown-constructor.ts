import type { Context } from '@oxlint/plugins';

import { lessons } from '../../catalogue/lesson.js';
import { RULE_DOCS } from '../../catalogue/manifest.js';
import { memberPropertyName } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import type { LintRule, Visitor } from '../rule.js';

const KNOWN_CONSTRUCTORS = new Set(['api', 'cli', 'integration', 'job', 'mobile', 'website']);

export const a2KnownConstructors: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            MemberExpression(node: AstNode) {
                const object = node.object as AstNode | undefined;
                if (object?.type !== 'Identifier' || object.name !== 'specification') {
                    return;
                }
                const member = memberPropertyName(node);
                if (member !== undefined && !KNOWN_CONSTRUCTORS.has(member)) {
                    context.report({ data: { member }, messageId: 'unknownConstructor', node });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['a2-known-constructors'],
        messages: lessons('a2-known-constructors', {
            unknownConstructor: {
                found: '`specification.{{member}}` is no constructor',
                fix: 'call `specification.api()`, `.job()`, `.cli(bin)`, `.integration()`, `.website()` or `.mobile()` — a rendered unit is the `component` chain',
            },
        }),
        type: 'problem',
    },
};
