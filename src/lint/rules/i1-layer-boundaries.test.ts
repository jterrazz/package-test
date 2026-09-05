import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { i1LayerBoundaries } from './i1-layer-boundaries.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

/** This package's own architecture — the map its `oxlint.config.ts` declares. */
const FRAMEWORK_LAYERS = {
    core: {
        imports: ['core/', 'integrations/docker/', 'integrations/hono/', 'vitest/matchers'],
        seams: {
            'core/specification/shared/builder.ts': ['integrations/msw/'],
        },
    },
    integrations: {
        folders: { postgres: ['pg'], redis: ['redis'] },
        imports: ['core/'],
    },
    lint: { imports: ['lint/', 'core/specification/shared/binding'] },
    vitest: {
        imports: ['core/', 'vitest/', 'integrations/docker/'],
        packages: ['vitest', 'vitest-mock-extended', 'mockdate'],
    },
};

const framework = [{ layers: FRAMEWORK_LAYERS }];

ruleTester.run('i1-layer-boundaries (a declared map)', i1LayerBoundaries as unknown as OxlintRule, {
    invalid: [
        // A layer that declares no packages imports none.
        {
            code: 'import { Client } from "pg";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: '/repo/src/core/matching/match.ts',
            options: framework,
        },
        // A folder only imports its own declared dependency.
        {
            code: 'import { Client } from "pg";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: '/repo/src/integrations/redis/redis.ts',
            options: framework,
        },
        // Cross-folder imports are outside the declared edges.
        {
            code: 'import { postgres } from "../postgres/postgres.js";',
            errors: [{ messageId: 'crossLayer' }],
            filename: '/repo/src/integrations/redis/redis.ts',
            options: framework,
        },
        // A seam is open for ONE module, not for the layer.
        {
            code: 'import { registerIntercepts } from "../../../integrations/msw/intercept.js";',
            errors: [{ messageId: 'crossLayer' }],
            filename: '/repo/src/core/specification/shared/orchestrator.ts',
            options: framework,
        },
        // A layer whose imports list names only pure helpers.
        {
            code: 'import { SpecificationBuilder } from "../../core/specification/shared/builder.js";',
            errors: [{ messageId: 'crossLayer' }],
            filename: '/repo/src/lint/rules/some-rule.ts',
            options: framework,
        },
        {
            code: 'import { z } from "zod";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: '/repo/src/lint/rules/some-rule.ts',
            options: framework,
        },
    ],
    valid: [
        // Node builtins are allowed everywhere.
        {
            code: 'import { join } from "node:path";',
            filename: '/repo/src/core/specification/shared/fixtures.ts',
            options: framework,
        },
        // In-layer relative imports.
        {
            code: 'import { TOKEN_KINDS } from "./match.js";',
            filename: '/repo/src/core/matching/structural.ts',
            options: framework,
        },
        // A declared prefix edge.
        {
            code: 'import { ContainerAccessor } from "../../../integrations/docker/container-accessor.js";',
            filename: '/repo/src/core/specification/cli/result.ts',
            options: framework,
        },
        // A declared EXACT module edge (not a prefix).
        {
            code: 'import { registerMatchers } from "../../../vitest/matchers.js";',
            filename: '/repo/src/core/specification/cli/start-cli.ts',
            options: framework,
        },
        // The seam, from the module that owns it.
        {
            code: 'import type { InterceptRegistration } from "../../../integrations/msw/intercept.js";',
            filename: '/repo/src/core/specification/shared/builder.ts',
            options: framework,
        },
        // A folder importing its own dependency, and the layer's imports.
        {
            code: 'import { Client } from "pg";',
            filename: '/repo/src/integrations/postgres/postgres.ts',
            options: framework,
        },
        {
            code: 'import type { DatabasePort } from "../../core/ports/database.port.js";',
            filename: '/repo/src/integrations/postgres/postgres.ts',
            options: framework,
        },
        // A layer that declares its packages.
        {
            code: 'import { expect } from "vitest";',
            filename: '/repo/src/vitest/matchers.ts',
            options: framework,
        },
        // An exact-module edge reached with its extension.
        {
            code: 'import { toKebabCase } from "../../core/specification/shared/binding.js";',
            filename: '/repo/src/lint/rules/a6w-redundant-compose-service.ts',
            options: framework,
        },
        // Module tests are exempt (F2/I4 govern them).
        {
            code: 'import { describe } from "vitest";',
            filename: '/repo/src/core/matching/match.test.ts',
            options: framework,
        },
        // A file under no declared layer is out of scope — here, the
        // Composition root, which lives above the layers.
        {
            code: 'import { registerIntercepts } from "./integrations/msw/intercept.js";',
            filename: '/repo/src/index.ts',
            options: framework,
        },
    ],
});

ruleTester.run('i1-layer-boundaries (no map)', i1LayerBoundaries as unknown as OxlintRule, {
    invalid: [],
    valid: [
        // Given no declared architecture, the rule says nothing: an
        // Architecture is the project's to state, not the linter's to assume.
        // A consumer whose directories HAPPEN to be named like the framework's
        // Was judged against a map describing a different package.
        { code: 'import { Client } from "pg";', filename: '/app/src/core/orders/order.ts' },
        {
            code: 'import { stripe } from "stripe";',
            filename: '/app/src/integrations/billing/billing.ts',
        },
        {
            code: 'import { helper } from "../../elsewhere/helper.js";',
            filename: '/app/src/vitest/setup.ts',
            options: [{}],
        },
        {
            code: 'import { Client } from "pg";',
            filename: '/app/src/core/orders/order.ts',
            options: [{ layers: {} }],
        },
        // A map that names OTHER layers leaves this file alone.
        {
            code: 'import { Client } from "pg";',
            filename: '/app/src/core/orders/order.ts',
            options: [{ layers: { domain: { imports: ['domain/'] } } }],
        },
    ],
});

ruleTester.run(
    'i1-layer-boundaries (any architecture)',
    i1LayerBoundaries as unknown as OxlintRule,
    {
        invalid: [
            // A consumer's own layering, in its own vocabulary.
            {
                code: 'import { Client } from "pg";',
                errors: [{ messageId: 'foreignDependency' }],
                filename: '/app/src/domain/order.ts',
                options: [{ layers: { domain: { imports: ['domain/'] } } }],
            },
            {
                code: 'import { repository } from "../infrastructure/repository.js";',
                errors: [{ messageId: 'crossLayer' }],
                filename: '/app/src/domain/order.ts',
                options: [{ layers: { domain: { imports: ['domain/'] } } }],
            },
        ],
        valid: [
            {
                code: 'import { order } from "../domain/order.js";',
                filename: '/app/src/application/place-order.ts',
                options: [
                    {
                        layers: {
                            application: { imports: ['application/', 'domain/'] },
                            domain: { imports: ['domain/'] },
                        },
                    },
                ],
            },
        ],
    },
);
