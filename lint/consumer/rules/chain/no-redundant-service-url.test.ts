import { ruleTester } from '../../../engine/testing/rule-tester.js';
import { noRedundantServiceUrl } from './no-redundant-service-url.js';

ruleTester().run('no-redundant-service-url', noRedundantServiceUrl, {
    invalid: [
        // The standard alias, hand-wired.
        {
            code: 'cli.env({ DATABASE_URL: db.connectionString });',
            errors: [{ column: 10, line: 1, messageId: 'redundant' }],
        },
        // Any *_URL key fed from a connectionString is the injection re-done.
        {
            code: 'cli.env({ ANALYTICS_DB_URL: analyticsDb.connectionString });',
            errors: [{ column: 10, line: 1, messageId: 'redundant' }],
        },
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
