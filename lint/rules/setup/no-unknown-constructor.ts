import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { memberPropertyName } from '../../reading/ast.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import type { LintRule } from '../rule.js';

const KNOWN_CONSTRUCTORS = new Set(['api', 'cli', 'integration', 'job', 'mobile', 'website']);

export const noUnknownConstructor: LintRule = {
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
        docs: rowOf('no-unknown-constructor'),
        messages: lessons('no-unknown-constructor', {
            unknownConstructor: {
                found: '`specification.{{member}}` is no constructor',
                fix: 'call `specification.api()`, `.job()`, `.cli(bin)`, `.integration()`, `.website()` or `.mobile()` — a rendered unit is the `component` chain',
            },
        }),
        type: 'problem',
    },
};
