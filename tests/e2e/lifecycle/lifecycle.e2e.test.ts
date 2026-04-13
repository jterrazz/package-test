import { describe, test } from 'vitest';

import { runners } from '../../setup/runners.js';

describe.each(runners)('$name — lifecycle', ({ spec }) => {
    test('resets database before each spec', async () => {
        // Given — data from a previous spec
        await spec('seed first').seed('two-users.sql').get('/users').run();

        // When — new spec without seeding
        const result = await spec('verify clean').get('/users').run();

        // Then — table is empty
        await result.table('users').toMatch({ columns: ['name'], rows: [] });
    });

    test('resets all databases before each spec', async () => {
        // Given — data in both databases from a previous spec
        await spec('populate both')
            .seed('one-user.sql')
            .seed('one-event.sql', { service: 'analytics-db' })
            .get('/users')
            .run();

        // When — new spec resets all databases
        const result = await spec('after reset').get('/users').run();

        // Then — both databases are clean
        await result.table('users').toMatch({ columns: ['name'], rows: [] });
        await result
            .table('events', { service: 'analytics-db' })
            .toMatch({ columns: ['type'], rows: [] });
    });

    test('seeding one database leaves the other empty', async () => {
        // Given — only seed analytics-db
        const result = await spec('only analytics')
            .seed('one-event.sql', { service: 'analytics-db' })
            .get('/users')
            .run();

        // Then — default db is empty, analytics has data
        await result.table('users').toMatch({ columns: ['name'], rows: [] });
        await result.table('events', { service: 'analytics-db' }).toMatch({
            columns: ['type'],
            rows: [['user_created']],
        });
    });
});
