import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { noFrameworkInternals } from './no-framework-internals.js';

ruleTester().run('no-framework-internals', asOxlintRule(noFrameworkInternals), {
    invalid: [
        // Deep specification-layer import from a spec.
        {
            code: 'import { match } from "../../src/expectations/tokens/match.js";',
            errors: 1,
            filename: '/repo/specs/cli/tokens/tokens.test.ts',
        },
        // The world layer is internal — from any spec, no exception.
        {
            code: 'import { postgres } from "../../src/world/services/postgres/postgres.adapter.js";',
            errors: 1,
            filename: '/repo/specs/api/seeding/seeding.test.ts',
        },
        // Not even from a spec whose subject IS the adapter: that probe is a
        // module test beside its module.
        {
            code: 'import { redis } from "../../src/world/services/redis/redis.adapter.js";',
            errors: 1,
            filename: '/repo/specs/integration/redis/redis.test.ts',
        },
        // The expectations layer is internal too.
        {
            code: 'import { registerMatchers } from "../../src/expectations/goldens/matchers.js";',
            errors: 1,
            filename: '/repo/specs/cli/tokens/tokens.test.ts',
        },
        // A terminal action's module is internal.
        {
            code: 'import { runSpecDocument } from "../../src/facets/cli/documents/literate.js";',
            errors: 1,
            filename: '/repo/specs/cli/run/document.spec.ts',
        },
        // A capability's module and a stub builder's are internal: a spec reaches both through the entry.
        {
            code: 'import { interceptThrough } from "../../src/world/stubs/intercept/intercept.js";',
            errors: 1,
            filename: '/repo/specs/api/intercept/exhausted.spec.ts',
        },
        {
            code: 'import { http } from "../../src/world/stubs/kinds/http.js";',
            errors: 1,
            filename: '/repo/specs/api/intercept/exhausted.spec.ts',
        },
        // What a terminal action hands back is internal: a spec reads it off the result.
        {
            code: 'import { TextAccessor } from "../../src/expectations/text/text.js";',
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
        // A seam probe reaches its adapter through the public entry, which
        // re-exports it — that is the whole point of the entry.
        {
            code: 'import { redis } from "../../index.js";',
            filename: '/repo/specs/integration/redis/redis.test.ts',
        },
        // An unpublished subpath is `no-unpublished-subpath`'s, from any file: `no-framework-internals` does not report it twice.
        {
            code: 'import { match } from "@jterrazz/test/core";',
            filename: '/repo/specs/cli/tokens/tokens.test.ts',
        },
        // Every subpath the package's own `exports` map publishes is exempt.
        {
            code: 'import plugin from "@jterrazz/test/oxlint";',
            filename: '/repo/specs/api/api.specification.ts',
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
            code: 'import { match } from "../matching/match.js";',
            filename: '/repo/src/model/goldens/matchers.ts',
        },
        // Consumer form — the ROOT entry is what `no-framework-internals` points a spec at.
        {
            code: 'import { specification } from "@jterrazz/test";',
            filename: '/repo/specs/api/api.specification.ts',
        },
    ],
});
