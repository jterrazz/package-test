import { ruleTester } from '@jterrazz/test';

import { noRedundantServiceUrl } from './no-redundant-service-url.js';

ruleTester().run('no-redundant-service-url', noRedundantServiceUrl, {
    invalid: [
        {
            name: 'The standard alias, hand-wired.',
            code: 'cli.env({ DATABASE_URL: db.connectionString });',
            errors: [{ column: 10, line: 1, messageId: 'redundant' }],
        },
        {
            name: 'Any *_URL key fed from a connectionString is the injection re-done.',
            code: 'cli.env({ ANALYTICS_DB_URL: analyticsDb.connectionString });',
            errors: [{ column: 10, line: 1, messageId: 'redundant' }],
        },
    ],
    valid: [
        { name: 'Non-URL keys.', code: 'cli.env({ HOME: "$WORKDIR" });' },
        {
            name: 'A URL key fed from something else (a literal override is a real override).',
            code: 'cli.env({ DATABASE_URL: "postgres://other-host/db" });',
        },
        {
            name: 'Removing an injected variable is the documented escape.',
            code: 'cli.env({ DATABASE_URL: null });',
        },
    ],
});
