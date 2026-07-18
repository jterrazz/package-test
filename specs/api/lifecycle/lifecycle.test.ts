import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('lifecycle', () => {
    test('resets all databases before each spec', async () => {
        // Given - data in both databases from a previous spec
        await api
            .seed('one-user.sql', { database: 'db' })
            .seed('one-event.sql', { database: 'analyticsDb' })
            .get('/users');

        // When - new spec resets all databases
        const result = await api.get('/users');

        // Then - both databases are clean
        await expect(result.table('users', { database: 'db' })).toBeEmpty();
        await expect(result.table('events', { database: 'analyticsDb' })).toBeEmpty();
    });

    test('seeding one database leaves the other empty', async () => {
        // Given - only seed analytics-db
        const result = await api.seed('one-event.sql', { database: 'analyticsDb' }).get('/users');

        // Then - default db is empty, analytics has data
        await expect(result.table('users', { database: 'db' })).toBeEmpty();
        await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
            columns: ['type'],
            rows: [['user_created']],
        });
    });
});
