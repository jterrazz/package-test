import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { f3SpecsPublicEntry } from './f3-specs-public-entry.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('f3-specs-public-entry', f3SpecsPublicEntry as unknown as OxlintRule, {
    invalid: [
        // Deep core import from a spec.
        {
            code: 'import { match } from "../../src/core/matching/match.js";',
            errors: 1,
            filename: '/repo/specs/cli/tokens/tokens.test.ts',
        },
        // Integration deep import from OUTSIDE specs/integrations.
        {
            code: 'import { postgres } from "../../src/integrations/postgres/postgres.js";',
            errors: 1,
            filename: '/repo/specs/api/seeding/seeding.test.ts',
        },
        // The vitest layer is internal too.
        {
            code: 'import { registerMatchers } from "../../src/vitest/matchers.js";',
            errors: 1,
            filename: '/repo/specs/cli/tokens/tokens.test.ts',
        },
        // A non-oxlint framework subpath (overlaps F1, kept specs-specific).
        {
            code: 'import { match } from "@jterrazz/test/core";',
            errors: 1,
            filename: '/repo/specs/cli/tokens/tokens.test.ts',
        },
    ],
    valid: [
        // The public entry (composition root).
        {
            code: 'import { specification } from "../../src/index.js";',
            filename: '/repo/specs/cli/tokens/tokens.test.ts',
        },
        // Consumer's OWN app source — the documented pattern
        // (`server: () => createApp()` importing ../../src). Not a framework layer.
        {
            code: 'import { createApp } from "../../src/app.js";',
            filename: '/repo/specs/api/health/health.test.ts',
        },
        // A deeper own-app path is still fine — no framework layer segment.
        {
            code: 'import { widget } from "../../src/domain/widget.js";',
            filename: '/repo/specs/app/widget/widget.test.ts',
        },
        // Sanctioned: integration specs deep-import the adapter they cover.
        {
            code: 'import { redis } from "../../../src/integrations/redis/redis.js";',
            filename: '/repo/specs/integrations/redis/redis.test.ts',
        },
        // The sanctioned tool-facing subpath.
        {
            code: 'import plugin from "@jterrazz/test/oxlint";',
            filename: '/repo/specs/setup/api.specification.ts',
        },
        // Outside specs/ the rule is inert.
        {
            code: 'import { match } from "../core/matching/match.js";',
            filename: '/repo/src/vitest/matchers.ts',
        },
        // Consumer form — package imports carry no src path.
        {
            code: 'import { specification } from "@jterrazz/test";',
            filename: '/repo/specs/setup/api.specification.ts',
        },
    ],
});
