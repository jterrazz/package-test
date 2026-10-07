import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('reset', () => {
    // RUNTIME sequence-expressed-by-seeding — a sequence is expressed by SEEDING the state the second run would have found: every chain starts on databases the framework reset.
    test('resets all databases before each spec', async () => {
        // Given - data in both databases from a previous spec
        await api
            .seed(file('../__seeds__/one-user.sql'), { database: 'db' })
            .seed(file('./__seeds__/one-event.sql'), { database: 'analyticsDb' })
            .get('/users');

        // When - new spec resets all databases
        const result = await api.get('/users');

        // Then - both databases are clean
        await expect(result.table('users', { database: 'db' })).toBeEmpty();
        await expect(result.table('events', { database: 'analyticsDb' })).toBeEmpty();
    });

    test('seeding one database leaves the other empty', async () => {
        // Given - only seed analytics-db
        const result = await api
            .seed(file('./__seeds__/one-event.sql'), { database: 'analyticsDb' })
            .get('/users');

        // Then - default db is empty, analytics has data
        await expect(result.table('users', { database: 'db' })).toBeEmpty();
        await expect(result.table('events', { database: 'analyticsDb' })).toMatch([
            [1, 'user_created', '{{string}}', '{{iso8601}}'],
        ]);
    });
});
