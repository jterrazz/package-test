import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { specificationMember } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** A `wrap` written in JSX needs the `x`. */
const SPECIFICATION_SUFFIXES = ['.specification.ts', '.specification.tsx'];

/** A file whose source never says it cannot hold the call the visitor looks for. */
const MEMBER_CALL = 'specification.';

const row = rowNamed(consumerRows, 'runner-in-specification-file');

/** Out of reach of a `component`-role file: a rendered unit has no runner to create. This repository's own constructor tests disable the rule by a config override. */
export const runnerInSpecificationFile = defineRule(
    {
        docs: row,
        messages: {
            outsideSpecification: {
                found: '`specification.{{member}}()` called outside a `*.specification.ts` file',
                fix: 'move the call into `specs/{{member}}/{{member}}.specification.ts` and import the handle it exports',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () =>
                    context.sourceCode.text.includes(MEMBER_CALL) &&
                    !SPECIFICATION_SUFFIXES.some((suffix) => context.filename.endsWith(suffix)) &&
                    identityOf(context).role !== 'component',
                CallExpression(node: AstNode) {
                    const member = specificationMember(node);
                    if (member !== undefined) {
                        context.report({
                            data: { member },
                            messageId: 'outsideSpecification',
                            node,
                        });
                    }
                },
            };
        },
    },
);
