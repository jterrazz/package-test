import { lessonsAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { memberPropertyName } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import type { LintRule } from '../../../engine/project/rule.js';
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
        docs: rowNamed(consumerRows, 'no-unknown-constructor'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-unknown-constructor'),
            {
                unknownConstructor: {
                    found: '`specification.{{member}}` is no constructor',
                    fix: 'call `specification.api()`, `.job()`, `.cli(bin)`, `.integration()`, `.website()` or `.mobile()` — a rendered unit is the `component` chain',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
