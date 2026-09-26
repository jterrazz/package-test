import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import { memberPropertyName, propertyKeyName } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

const URL_KEY = /^[A-Z0-9]+(?:_[A-Z0-9]+)*_URL$/u;

export const noRedundantServiceUrl: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                if (callee === undefined || memberPropertyName(callee) !== 'env') {
                    return;
                }
                const argument = (node.arguments as AstNode[] | undefined)?.[0];
                if (argument?.type !== 'ObjectExpression') {
                    return;
                }
                for (const property of (argument.properties as AstNode[] | undefined) ?? []) {
                    const key = propertyKeyName(property);
                    if (key === undefined || !URL_KEY.test(key)) {
                        continue;
                    }
                    const value = property.value as AstNode | undefined;
                    if (
                        value?.type === 'MemberExpression' &&
                        memberPropertyName(value) === 'connectionString'
                    ) {
                        context.report({ data: { key }, messageId: 'redundant', node: property });
                    }
                }
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'no-redundant-service-url'),
        messages: lessonsAt(rowNamed(consumerRows, 'no-redundant-service-url'), {
            redundant: {
                found: '`.env({ {{key}}: ….connectionString })` restates what the framework injects',
                fix: 'delete the `{{key}}` entry — the service record key already injects `<KEY>_URL`, and `DATABASE_URL`/`REDIS_URL` when unambiguous',
            },
        }),
        type: 'suggestion',
    },
};
