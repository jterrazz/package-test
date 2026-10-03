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
            name: 'A block that returns nothing, or more than its return, another method, no replace at all, a member receiver, and no specification are none of this rule’s.',
            code: `await specification.cli("./bin", { transform: (text) => {} });
                await specification.cli("./bin", { transform: (text) => { text.replace(/x/g, "{{uuid}}"); } });
                await specification.cli("./bin", { transform: (text) => { throw text.replace(/x/g, "{{uuid}}"); } });
                await specification.cli("./bin", { transform: (text) => { return text.replace(/x/g, "{{uuid}}"); other(); } });
                await specification.cli("./bin", { transform: (text) => text.replaceAll("x", "{{uuid}}") });
                await specification.cli("./bin", { transform: (text) => text });
                await specification.cli("./bin", { transform: (text) => this.text.replace(/x/g, "{{uuid}}") });
                await other.cli("./bin", { transform: (text) => text.replace(/x/g, "{{uuid}}") });`,
        },
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
