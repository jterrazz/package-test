import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { i1LayerBoundaries } from './i1-layer-boundaries.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('i1-layer-boundaries', i1LayerBoundaries as unknown as OxlintRule, {
    invalid: [
        // Core imports nothing external.
        {
            code: 'import { Client } from "pg";',
            errors: [{ messageId: 'coreExternal' }],
            filename: '/repo/src/core/matching/match.ts',
        },
        // An integrations folder only imports its own dependency.
        {
            code: 'import { Client } from "pg";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: '/repo/src/integrations/redis/redis.ts',
        },
        // Cross-integration imports are banned.
        {
            code: 'import { postgres } from "../postgres/postgres.js";',
            errors: [{ messageId: 'crossLayer' }],
            filename: '/repo/src/integrations/redis/redis.ts',
        },
        // Core may not reach arbitrary integrations.
        {
            code: 'import { registerIntercepts } from "../../../integrations/msw/intercept.js";',
            errors: [{ messageId: 'crossLayer' }],
            filename: '/repo/src/core/specification/shared/orchestrator.ts',
        },
        // The lint layer imports no framework runtime.
        {
            code: 'import { SpecificationBuilder } from "../../core/specification/shared/builder.js";',
            errors: [{ messageId: 'lintRuntime' }],
            filename: '/repo/src/lint/rules/some-rule.ts',
        },
        // The lint layer has zero external dependencies.
        {
            code: 'import { z } from "zod";',
            errors: [{ messageId: 'lintRuntime' }],
            filename: '/repo/src/lint/rules/some-rule.ts',
        },
    ],
    valid: [
        // Node builtins are allowed everywhere.
        {
            code: 'import { join } from "node:path";',
            filename: '/repo/src/core/specification/shared/fixtures.ts',
        },
        // In-layer relative imports.
        {
            code: 'import { TOKEN_KINDS } from "./match.js";',
            filename: '/repo/src/core/matching/structural.ts',
        },
        // Sanctioned core → integrations/docker edge.
        {
            code: 'import { ContainerAccessor } from "../../../integrations/docker/container-accessor.js";',
            filename: '/repo/src/core/specification/cli/result.ts',
        },
        // Sanctioned core → vitest/matchers edge (vitest reached dynamically there).
        {
            code: 'import { registerMatchers } from "../../../vitest/matchers.js";',
            filename: '/repo/src/core/specification/cli/start-cli.ts',
        },
        // Sanctioned lazy seam: builder → integrations/msw.
        {
            code: 'import type { InterceptRegistration } from "../../../integrations/msw/intercept.js";',
            filename: '/repo/src/core/specification/shared/builder.ts',
        },
        // An integrations folder importing its own dependency and core.
        {
            code: 'import { Client } from "pg";',
            filename: '/repo/src/integrations/postgres/postgres.ts',
        },
        {
            code: 'import type { DatabasePort } from "../../core/ports/database.port.js";',
            filename: '/repo/src/integrations/postgres/postgres.ts',
        },
        // The vitest layer owns the runner coupling.
        {
            code: 'import { expect } from "vitest";',
            filename: '/repo/src/vitest/matchers.ts',
        },
        // The lint layer reaching the pure core helpers.
        {
            code: 'import { toKebabCase } from "../../core/specification/shared/binding.js";',
            filename: '/repo/src/lint/rules/a6w-redundant-compose-service.ts',
        },
        // Module tests are exempt (F2/I4 govern them).
        {
            code: 'import { describe } from "vitest";',
            filename: '/repo/src/core/matching/match.test.ts',
        },
        // The composition root lives above the layers.
        {
            code: 'import { registerIntercepts } from "./integrations/msw/intercept.js";',
            filename: '/repo/src/index.ts',
        },
    ],
});
