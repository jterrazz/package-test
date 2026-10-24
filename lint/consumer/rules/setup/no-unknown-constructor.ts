import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, memberPropertyName } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { consumerRows } from '../../catalogue/manifest.js';

const KNOWN_CONSTRUCTORS = new Set([
    'api',
    'cli',
    'deployment',
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
                fix: 'call `specification.api()`, `.job()`, `.cli(bin)`, `.integration()`, `.website()`, `.deployment()`, `.mobile()` or `.lint()`; a rendered unit is the `component` chain',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                MemberExpression(node: AstNode) {
                    const object = child(node, 'object');
                    // Stryker disable next-line ConditionalExpression,OptionalChaining: a member always has an object, and only an identifier has a name
                    if (object?.type !== 'Identifier' || object.name !== 'specification') {
                        return;
                    }
                    const member = memberPropertyName(node);
                    // Stryker disable next-line ConditionalExpression: a computed member is no name to judge
                    if (member !== undefined && !KNOWN_CONSTRUCTORS.has(member)) {
                        context.report({ data: { member }, messageId: 'unknownConstructor', node });
                    }
                },
            };
        },
    },
);
