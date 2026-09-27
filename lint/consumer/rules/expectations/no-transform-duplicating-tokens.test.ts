import { asOxlintRule, ruleTester } from '../../../engine/testing/rule-tester.fixtures.js';
import { noTransformDuplicatingTokens } from './no-transform-duplicating-tokens.js';

ruleTester().run('no-transform-duplicating-tokens', asOxlintRule(noTransformDuplicatingTokens), {
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
});
