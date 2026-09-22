import { specificationMember } from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/** Both suffixes a specification wears — a `wrap` written in JSX needs the `x`. */
const SPECIFICATION_SUFFIXES = ['.specification.ts', '.specification.tsx'];

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
 */
export const a1SpecificationFile: LintRule = {
    create(context: RuleContext): Visitor {
        if (
            SPECIFICATION_SUFFIXES.some((suffix) => context.filename.endsWith(suffix)) ||
            roleOf(context.physicalFilename).role === 'component'
        ) {
            return {};
        }
        return {
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
        messages: {
            outsideSpecification:
                'specification.{{member}}() must be called from a `*.specification.ts` file under specs/.',
        },
        type: 'problem',
    },
};
