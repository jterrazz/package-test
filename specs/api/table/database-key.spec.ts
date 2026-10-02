import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('database-key', () => {
    test('table details — queries a specific database by key', async () => {
        // Given - seed analytics directly
        const result = await api
            .seed(file('../_seeds/two-events.sql'), { database: 'analyticsDb' })
            .get('/events');

        // Then - multi-column check on analytics-db
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_created', '{"name":"Alice"}', '{{iso8601}}'],
            [2, 'user_created', '{"name":"Bob"}', '{{iso8601}}'],
        ]);
    });

    test('with two databases, a table read that names none is refused, listing the keys it may name', async () => {
        // Given - a run against the api, whose specification declares two databases
        const result = await api.get('/events');

        // Then - the read is refused before any query: which database is not guessed
        // checker-disable-next-line database-named-only-when-several -- the run-time twin of the rule is the subject: the omission is written to be refused
        expect(() => result.table('events')).toThrow(
            [
                'found: table() names no database, and 2 databases are declared ("analyticsDb", "db")',
                'why: With two SQL databases or more, a seed or a table names the `database:` it reads, and with exactly one it names none.',
                "fix: pass the database it reads: { database: 'analyticsDb' }, or another declared key",
                'read: docs/19-linting.md#database-named-only-when-several-at-runtime',
            ].join('\n'),
        );
    });
});
