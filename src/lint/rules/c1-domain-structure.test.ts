import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { c1DomainStructure } from './c1-domain-structure.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('c1-domain-structure', c1DomainStructure as unknown as OxlintRule, {
    invalid: [
        // A test directly at the facet root — no domain folder.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testAtFacetRoot' }],
            filename: '/repo/specs/jobs/jobs.test.ts',
        },
        // A test nested deeper than facet/domain.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testTooDeep' }],
            filename: '/repo/specs/cli/check/linter/linter.test.ts',
        },
        // A specification inside a domain rather than at the facet root.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'specNotAtFacetRoot' }],
            filename: '/repo/specs/api/intercepts/intercepts.specification.ts',
        },
    ],
    valid: [
        // Tests at facet/domain depth (aspect name is free).
        { code: 'const x = 1;', filename: '/repo/specs/api/responses/responses.test.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/cli/check/linter.test.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/integrations/redis/redis.test.ts' },
        // Specifications at the facet root.
        { code: 'const x = 1;', filename: '/repo/specs/api/api.specification.ts' },
        { code: 'const x = 1;', filename: '/repo/specs/cli/cli.specification.ts' },
        // Module tests under src/ follow the neighbour rule (I2), not C1.
        { code: 'const x = 1;', filename: '/repo/src/core/matching/match.test.ts' },
    ],
});
