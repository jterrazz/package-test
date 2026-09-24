import { resolve } from 'node:path';
import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { checkoutUnder, repositoryUnder } from '../../rule-tester.fixtures.js';
import { i1LayerBoundaries } from './i1-layer-boundaries.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: a `LintRule` reads every node as an `AstNode`, where oxlint
// types each handler with its node's interface.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

/** This package's own architecture — the map its `oxlint.config.ts` declares. */
const FRAMEWORK_LAYERS = {
    facets: {
        imports: ['facets/', 'model/'],
        seams: { 'facets/api/api.handle.ts': ['seams/hono/'] },
    },
    lint: { imports: ['lint/', 'model/chain/binding'] },
    model: {
        imports: ['model/', 'seams/docker/', 'facets/cli/cli.result'],
        seams: {
            'model/chain/builder.ts': ['seams/msw/'],
        },
    },
    runner: {
        imports: ['model/', 'runner/', 'seams/docker/'],
        packages: ['vitest', 'vitest-mock-extended'],
    },
    seams: {
        folders: { postgres: ['pg'], redis: ['redis'] },
        imports: ['model/'],
    },
};

const framework = [{ layers: FRAMEWORK_LAYERS }];

/** This repository's root: a `lint/` beside a `src/`, the spine the rule reads. */
const SPINE = resolve(import.meta.dirname, '../../..');

/** The same spine, checked out under a folder named `src/`. */
const UNDER_SRC = checkoutUnder('src', ['src']);

/** A spine no package holds — a repository alone — checked out under a folder named `src/`. */
const REPOSITORY_UNDER_SRC = repositoryUnder('src', ['src']);

ruleTester.run('i1-layer-boundaries (a declared map)', i1LayerBoundaries as unknown as OxlintRule, {
    invalid: [
        // A layer that declares no packages imports none.
        {
            code: 'import { Client } from "pg";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: '/repo/src/model/matching/match.ts',
            options: framework,
        },
        // An edge is an edge in every form a module names another.
        {
            code: 'const { Client } = require("pg");',
            errors: [{ messageId: 'foreignDependency' }],
            filename: '/repo/src/model/matching/match.ts',
            options: framework,
        },
        // A folder only imports its own declared dependency.
        {
            code: 'import { Client } from "pg";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: '/repo/src/seams/redis/redis.ts',
            options: framework,
        },
        // Cross-folder imports are outside the declared edges.
        {
            code: 'import { postgres } from "../postgres/postgres.js";',
            errors: [{ messageId: 'crossLayer' }],
            filename: '/repo/src/seams/redis/redis.ts',
            options: framework,
        },
        // A seam is open for ONE module, not for the layer.
        {
            code: 'import { registerContracts } from "../../seams/msw/server.js";',
            errors: [{ messageId: 'crossLayer' }],
            filename: '/repo/src/model/chain/orchestrator.ts',
            options: framework,
        },
        // A layer whose imports list names only pure helpers.
        {
            code: 'import { SpecificationBuilder } from "../../src/model/chain/builder.js";',
            errors: [{ messageId: 'crossLayer' }],
            filename: `${SPINE}/lint/rules/some-rule.ts`,
            options: framework,
        },
        {
            code: 'import { z } from "zod";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: `${SPINE}/lint/rules/some-rule.ts`,
            options: framework,
        },
        // A `src` folder above the package is the machine's: the map reads the checkout's own `lint/`.
        {
            code: 'import { z } from "zod";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: `${UNDER_SRC}/lint/rules/some-rule.ts`,
            options: framework,
        },
        // Outside every package, the map reads below the repository root.
        {
            code: 'import { z } from "zod";',
            errors: [{ messageId: 'foreignDependency' }],
            filename: `${REPOSITORY_UNDER_SRC}/lint/rules/some-rule.ts`,
            options: framework,
        },
    ],
    valid: [
        // Node builtins are allowed everywhere.
        {
            code: 'import { join } from "node:path";',
            filename: '/repo/src/model/chain/fixtures.ts',
            options: framework,
        },
        // In-layer relative imports.
        {
            code: 'import { TOKEN_KINDS } from "./match.js";',
            filename: '/repo/src/model/matching/structural.ts',
            options: framework,
        },
        // A declared prefix edge.
        {
            code: 'import { ContainerAccessor } from "../../seams/docker/container-accessor.js";',
            filename: '/repo/src/model/result/result.ts',
            options: framework,
        },
        // A declared EXACT module edge (not a prefix).
        {
            code: 'import { HonoAdapter } from "../../seams/hono/hono.adapter.js";',
            filename: '/repo/src/facets/api/api.handle.ts',
            options: framework,
        },
        // The seam, from the module that owns it.
        {
            code: 'import type { ContractRegistration } from "../../seams/msw/server.js";',
            filename: '/repo/src/model/chain/builder.ts',
            options: framework,
        },
        // A folder importing its own dependency, and the layer's imports.
        {
            code: 'import { Client } from "pg";',
            filename: '/repo/src/seams/postgres/postgres.ts',
            options: framework,
        },
        {
            code: 'import type { DatabasePort } from "../../model/ports/database.port.js";',
            filename: '/repo/src/seams/postgres/postgres.ts',
            options: framework,
        },
        // A layer that declares its packages.
        {
            code: 'import { expect } from "vitest";',
            filename: '/repo/src/runner/preset.ts',
            options: framework,
        },
        // An exact-module edge reached with its extension.
        {
            code: 'import { toKebabCase } from "../../src/model/chain/binding.js";',
            filename: `${SPINE}/lint/rules/b8-kebab-trigger.ts`,
            options: framework,
        },
        // A `lint/` with no `src/` beside it is no spine, and no layer.
        {
            code: 'import { z } from "zod";',
            filename: '/nowhere/lint/rules/some-rule.ts',
            options: framework,
        },
        // Module tests are exempt (F2/I4 govern them).
        {
            code: 'import { describe } from "vitest";',
            filename: '/repo/src/model/matching/match.test.ts',
            options: framework,
        },
        // So is everything else that is not a production module: a spec under
        // `src/`, and ground a module test stands on.
        {
            code: 'import { describe } from "vitest";',
            filename: '/repo/src/model/matching/match.spec.ts',
            options: framework,
        },
        {
            code: 'import { Client } from "pg";',
            filename: '/repo/src/model/matching/fixtures/app.ts',
            options: framework,
        },
        // A file under no declared layer is out of scope — here, the
        // Composition root, which lives above the layers.
        {
            code: 'import { registerContracts } from "./seams/msw/server.js";',
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
        { code: 'import { Client } from "pg";', filename: '/app/src/model/orders/order.ts' },
        {
            code: 'import { stripe } from "stripe";',
            filename: '/app/src/integrations/billing/billing.ts',
        },
        {
            code: 'import { helper } from "../../elsewhere/helper.js";',
            filename: '/app/src/runner/setup.ts',
            options: [{}],
        },
        {
            code: 'import { Client } from "pg";',
            filename: '/app/src/model/orders/order.ts',
            options: [{ layers: {} }],
        },
        // A map that names OTHER layers leaves this file alone.
        {
            code: 'import { Client } from "pg";',
            filename: '/app/src/model/orders/order.ts',
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
