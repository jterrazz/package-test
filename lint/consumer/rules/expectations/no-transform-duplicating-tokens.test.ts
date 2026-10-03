import { ruleTester } from '@jterrazz/test';

import { noTransformDuplicatingTokens } from './no-transform-duplicating-tokens.js';

ruleTester().run('no-transform-duplicating-tokens', noTransformDuplicatingTokens, {
    invalid: [
        {
            name: 'Expression-bodied arrow, single token-equivalent replace.',
            code: `await specification.cli("./bin", {
                    transform: (text) => text.replace(/[0-9a-f-]{36}/g, "{{uuid}}"),
                });`,
            errors: [{ column: 20, line: 2, messageId: 'tokenEquivalent' }],
        },
        {
            name: 'Chained token-equivalent replaces, block body with one return.',
            code: `await specification.cli("./bin", {
                    transform: (text) => {
                        return text.replace(/[0-9a-f-]{36}/g, "{{uuid}}").replace(/\\d+ms/g, "{{duration}}");
                    },
                });`,
            errors: [{ column: 20, line: 2, messageId: 'tokenEquivalent' }],
        },
        {
            name: 'Captured token literals count too.',
            code: `await specification.cli("./bin", {
                    transform: (text) => text.replace(/run-\\d+/g, "{{int#run}}"),
                });`,
            errors: [{ column: 20, line: 2, messageId: 'tokenEquivalent' }],
        },
    ],
    valid: [
        {
            name: 'Real applicative noise — not expressible as tokens.',
            code: `await specification.cli("./bin", {
                    transform: (text) => text.replace(/^\\[worker-\\d+\\] /gm, ""),
                });`,
        },
        {
            name: 'Mixed logic is beyond the heuristic — silent.',
            code: `await specification.cli("./bin", {
                    transform: (text) => {
                        const cleaned = text.trim();
                        return cleaned.replace(/x/g, "{{uuid}}");
                    },
                });`,
        },
        {
            name: 'Unknown pseudo-token literal is not a standard-token equivalence.',
            code: `await specification.cli("./bin", {
                    transform: (text) => text.replace(/x/g, "{{custom}}"),
                });`,
        },
    ],
});
