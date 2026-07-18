import { segments } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext } from '../types.js';

const TEST_SUFFIX = '.test.ts';
const SPECIFICATION_SUFFIX = '.specification.ts';

/**
 * CONVENTIONS C1' — facet-root specifications, domain-nested tests.
 *
 * A facet (`specs/<facet>/` — api, jobs, cli, integrations, lint, …) is the
 * master folder. It carries its runner(s) at its ROOT
 * (`specs/<facet>/<name>.specification.ts`) and holds DOMAIN folders, each a
 * product command/area with one or more `<aspect>.test.ts` files plus their
 * shared asset dirs.
 *
 * Two placement invariants, checked from the filename:
 * - a `*.test.ts` must sit at facet/domain depth — exactly
 *   `specs/<facet>/<domain>/<file>.test.ts`. A test directly at the facet root
 *   (or nested deeper than a domain) is rejected.
 * - a `*.specification.ts` must sit at the facet root — exactly
 *   `specs/<facet>/<file>.specification.ts`, never inside a domain.
 *
 * Module tests under `src/` follow the neighbour rule (I2) and are out of scope.
 */
export const c1DomainStructure: LintRule = {
    create(context: RuleContext) {
        return {
            Program(node: AstNode) {
                const parts = segments(context.filename);
                const base = parts.at(-1) ?? '';
                const specsIndex = parts.lastIndexOf('specs');
                if (specsIndex === -1) {
                    return;
                }
                // Segments strictly between `specs` and the file: [facet, domain, …].
                const depth = parts.length - 1 - (specsIndex + 1);

                if (base.endsWith(TEST_SUFFIX)) {
                    if (depth < 2) {
                        context.report({ messageId: 'testAtFacetRoot', node });
                    } else if (depth > 2) {
                        context.report({ messageId: 'testTooDeep', node });
                    }
                    return;
                }
                if (base.endsWith(SPECIFICATION_SUFFIX)) {
                    if (depth !== 1) {
                        context.report({ messageId: 'specNotAtFacetRoot', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c1-domain-structure'],
        messages: {
            specNotAtFacetRoot:
                'A `*.specification.ts` must sit at the facet root: `specs/<facet>/<name>.specification.ts` (C1 — see docs/10-linting.md).',
            testAtFacetRoot:
                'A `*.test.ts` must live in a domain folder: `specs/<facet>/<domain>/<aspect>.test.ts` — tests directly at the facet root are forbidden (C1 — see docs/10-linting.md).',
            testTooDeep:
                'A `*.test.ts` must sit at facet/domain depth: `specs/<facet>/<domain>/<aspect>.test.ts` — no deeper nesting (C1 — see docs/10-linting.md).',
        },
        type: 'problem',
    },
};
