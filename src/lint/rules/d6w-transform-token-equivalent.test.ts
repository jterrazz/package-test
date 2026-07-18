import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { d6wTransformTokenEquivalent } from './d6w-transform-token-equivalent.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run(
    'd6w-transform-token-equivalent',
    d6wTransformTokenEquivalent as unknown as OxlintRule,
    {
        invalid: [
            // Expression-bodied arrow, single token-equivalent replace.
            {
                code: `await specification.cli("./bin", {
                    transform: (text) => text.replace(/[0-9a-f-]{36}/g, "{{uuid}}"),
                });`,
                errors: 1,
            },
            // Chained token-equivalent replaces, block body with one return.
            {
                code: `await specification.cli("./bin", {
                    transform: (text) => {
                        return text.replace(/[0-9a-f-]{36}/g, "{{uuid}}").replace(/\\d+ms/g, "{{duration}}");
                    },
                });`,
                errors: 1,
            },
            // Captured token literals count too.
            {
                code: `await specification.cli("./bin", {
                    transform: (text) => text.replace(/run-\\d+/g, "{{int#run}}"),
                });`,
                errors: 1,
            },
        ],
        valid: [
            // Real applicative noise — not expressible as tokens.
            {
                code: `await specification.cli("./bin", {
                    transform: (text) => text.replace(/^\\[worker-\\d+\\] /gm, ""),
                });`,
            },
            // Mixed logic is beyond the heuristic — silent.
            {
                code: `await specification.cli("./bin", {
                    transform: (text) => {
                        const cleaned = text.trim();
                        return cleaned.replace(/x/g, "{{uuid}}");
                    },
                });`,
            },
            // Unknown pseudo-token literal is not a standard-token equivalence.
            {
                code: `await specification.cli("./bin", {
                    transform: (text) => text.replace(/x/g, "{{custom}}"),
                });`,
            },
        ],
    },
);
