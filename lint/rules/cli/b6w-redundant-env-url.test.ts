import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { b6wRedundantEnvUrl } from './b6w-redundant-env-url.js';

RuleTester.describe = describe;
RuleTester.it = it;

// Boundary cast: oxlint does not export its `Rule` type, and our structural
// `LintRule` is intentionally decoupled from its internal (alpha) typings.
type OxlintRule = Parameters<RuleTester['run']>[1];

const ruleTester = new RuleTester();

ruleTester.run('b6w-redundant-env-url', b6wRedundantEnvUrl as unknown as OxlintRule, {
    invalid: [
        // The standard alias, hand-wired.
        { code: 'cli.env({ DATABASE_URL: db.connectionString });', errors: 1 },
        // Any *_URL key fed from a connectionString is the injection re-done.
        { code: 'cli.env({ ANALYTICS_DB_URL: analyticsDb.connectionString });', errors: 1 },
    ],
    valid: [
        // Non-URL keys.
        { code: 'cli.env({ HOME: "$WORKDIR" });' },
        // A URL key fed from something else (a literal override is a real override).
        { code: 'cli.env({ DATABASE_URL: "postgres://other-host/db" });' },
        // Removing an injected variable is the documented escape.
        { code: 'cli.env({ DATABASE_URL: null });' },
    ],
});
