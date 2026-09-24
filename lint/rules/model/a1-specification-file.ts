import type { Context } from '@oxlint/plugins';

import { specificationMember } from '../../ast.js';
import { lessons } from '../../lesson.js';
import { identityOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** Both suffixes a specification wears — a `wrap` written in JSX needs the `x`. */
const SPECIFICATION_SUFFIXES = ['.specification.ts', '.specification.tsx'];

/** What a `specification.<member>(…)` call always writes — absent, the file has none to find. */
const MEMBER_CALL = 'specification.';

/**
 * CONVENTIONS A1 — a runner is created in a `*.specification.ts(x)` file under
 * `specs/`. Any `specification.<member>(…)` call in a file that is not a
 * specification file is flagged. The `.tsx` spelling is the same file with a
 * `wrap` written in JSX.
 *
 * Framework-internal unit tests of the constructors themselves (this repo's
 * `src/**\/*.test.ts`) disable the rule via a config override — for consumers
 * the rule is universal.
 *
 * The A family does not reach a `component`-role file. A rendered unit has no
 * runner to create: no server to start, no database to isolate, no binary to
 * find — which is why the component facet has no constructor and no
 * specification file for A1 to point at.
 *
 * No role narrows the rule the way B9w's does: it reads every file but a
 * specification. The text pre-check does instead — a file whose source never
 * says `specification.` cannot hold the member call the visitor looks for.
 */
export const a1SpecificationFile: LintRule = {
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
        docs: RULE_DOCS['a1-specification-file'],
        messages: lessons('a1-specification-file', {
            outsideSpecification: {
                found: '`specification.{{member}}()` called outside a `*.specification.ts` file',
                fix: 'move the call into `specs/{{member}}/{{member}}.specification.ts` and import the handle it exports',
            },
        }),
        type: 'problem',
    },
};
