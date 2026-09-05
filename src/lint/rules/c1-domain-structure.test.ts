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
        // The default is explicit-equivalent: stating it changes nothing.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/api/responses/responses.test.ts',
            options: [{ depth: 'facet-domain' }],
        },
    ],
});

ruleTester.run('c1-domain-structure (depth: mirror)', c1DomainStructure as unknown as OxlintRule, {
    invalid: [
        // A test loose at the specs root mirrors nothing.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testAtSpecsRoot' }],
            filename: '/repo/specs/logs.test.ts',
            options: [{ depth: 'mirror' }],
        },
        // A test not named after the directory holding it.
        {
            code: 'const x = 1;',
            errors: [{ messageId: 'testNotMirroringDirectory' }],
            filename: '/repo/specs/posts/add/creation.test.ts',
            options: [{ depth: 'mirror' }],
        },
    ],
    valid: [
        // One directory deep — a top-level leaf.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/logs/logs.test.ts',
            options: [{ depth: 'mirror' }],
        },
        // Two deep — a leaf under a namespace.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/infrastructure/pods/pods.test.ts',
            options: [{ depth: 'mirror' }],
        },
        // Three deep — the mirror has no maximum, unlike facet-domain.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/a/b/c/c.test.ts',
            options: [{ depth: 'mirror' }],
        },
        // A mirror has no facet level, so specification files are unconstrained.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/cli.specification.ts',
            options: [{ depth: 'mirror' }],
        },
        {
            code: 'const x = 1;',
            filename: '/repo/specs/posts/add/add.specification.ts',
            options: [{ depth: 'mirror' }],
        },
        // Still out of scope under src/.
        {
            code: 'const x = 1;',
            filename: '/repo/src/core/matching/match.test.ts',
            options: [{ depth: 'mirror' }],
        },
    ],
});

ruleTester.run('c1-domain-structure (depth: off)', c1DomainStructure as unknown as OxlintRule, {
    invalid: [],
    valid: [
        // Everything the other modes reject is accepted: the tree's shape is
        // Declared to be guarded somewhere else entirely.
        {
            code: 'const x = 1;',
            filename: '/repo/specs/jobs/jobs.test.ts',
            options: [{ depth: 'off' }],
        },
        {
            code: 'const x = 1;',
            filename: '/repo/specs/cli/check/linter/linter.test.ts',
            options: [{ depth: 'off' }],
        },
        {
            code: 'const x = 1;',
            filename: '/repo/specs/api/intercepts/intercepts.specification.ts',
            options: [{ depth: 'off' }],
        },
    ],
});
