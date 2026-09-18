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
        // Deep specification-layer import from a spec.
        {
            code: 'import { match } from "../../src/specification/matching/match.js";',
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
        // An UNPUBLISHED framework subpath (overlaps F1, kept specs-specific).
        {
            code: 'import { match } from "@jterrazz/test/core";',
            errors: 1,
            filename: '/repo/specs/cli/tokens/tokens.test.ts',
        },
        // A subpath the exports map does not publish, even when it names a layer.
        {
            code: 'import { registerMatchers } from "@jterrazz/test/specification";',
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
        // Every subpath the package's own `exports` map publishes is exempt.
        {
            code: 'import plugin from "@jterrazz/test/oxlint";',
            filename: '/repo/specs/setup/api.specification.ts',
        },
        // `/vitest` — what a specs-tree vitest.config.ts imports the preset from.
        {
            code: 'import { defineSpecConfig } from "@jterrazz/test/vitest";',
            filename: '/repo/specs/cli/_fixtures/app/vitest.config.ts',
        },
        // `/schema` — the published JSON schema of a <case>.spec.yaml document.
        {
            code: 'import schema from "@jterrazz/test/schema" with { type: "json" };',
            filename: '/repo/specs/cli/literate/literate.test.ts',
        },
        // Outside specs/ the rule is inert.
        {
            code: 'import { match } from "../specification/matching/match.js";',
            filename: '/repo/src/vitest/matchers.ts',
        },
        // Consumer form — the ROOT entry is what F3 points a spec at.
        {
            code: 'import { specification } from "@jterrazz/test";',
            filename: '/repo/specs/setup/api.specification.ts',
        },
    ],
});
