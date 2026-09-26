import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import { specificationMember } from '../../reading/ast.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import { identityOf } from '../../reading/linted-file.js';
import type { LintRule } from '../rule.js';

/** A `wrap` written in JSX needs the `x`. */
const SPECIFICATION_SUFFIXES = ['.specification.ts', '.specification.tsx'];

/** A file whose source never says it cannot hold the call the visitor looks for. */
const MEMBER_CALL = 'specification.';

/** Out of reach of a `component`-role file: a rendered unit has no runner to create. This repository's own constructor tests disable the rule by a config override. */
export const runnerInSpecificationFile: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () =>
                context.sourceCode.text.includes(MEMBER_CALL) &&
                !SPECIFICATION_SUFFIXES.some((suffix) => context.filename.endsWith(suffix)) &&
                identityOf(context).role !== 'component',
            CallExpression(node: AstNode) {
                const member = specificationMember(node);
                if (member !== undefined) {
                    context.report({ data: { member }, messageId: 'outsideSpecification', node });
                }
            },
        };
    },
    meta: {
        docs: rowOf('runner-in-specification-file'),
        messages: lessons('runner-in-specification-file', {
            outsideSpecification: {
                found: '`specification.{{member}}()` called outside a `*.specification.ts` file',
                fix: 'move the call into `specs/{{member}}/{{member}}.specification.ts` and import the handle it exports',
            },
        }),
        type: 'problem',
    },
};
