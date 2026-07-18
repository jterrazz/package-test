import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { a5ModeWithServer } from './a5-mode-with-server.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('a5-mode-with-server', a5ModeWithServer as unknown as OxlintRule, {
    invalid: [
        // Hardcoded mode next to a server.
        {
            code: 'await specification.api({ mode: "compose", server: () => app });',
            errors: 1,
        },
        {
            code: 'await specification.api({ mode: "node", server: () => app, services: {} });',
            errors: 1,
        },
    ],
    valid: [
        // The sanctioned non-Node exception: no server, compose is permanent.
        { code: 'await specification.api({ mode: "compose", services: {} });' },
        // No mode at all — the switch lives in vitest.config.ts.
        { code: 'await specification.api({ server: () => app });' },
        // Other constructors have no mode.
        { code: 'await specification.cli("./bin", { mode: "compose" });' },
    ],
});
