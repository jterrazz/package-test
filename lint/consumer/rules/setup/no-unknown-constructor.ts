import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { memberPropertyName } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

const KNOWN_CONSTRUCTORS = new Set([
    'api',
    'cli',
    'integration',
    'job',
    'lint',
    'mobile',
    'website',
]);

const row = rowNamed(consumerRows, 'no-unknown-constructor');

export const noUnknownConstructor = defineRule(
    {
        docs: row,
        messages: {
            unknownConstructor: {
                found: '`specification.{{member}}` is no constructor',
                fix: 'call `specification.api()`, `.job()`, `.cli(bin)`, `.integration()`, `.website()`, `.mobile()` or `.lint()` — a rendered unit is the `component` chain',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
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
    },
);
