import { Hono } from 'hono';
import { describe, expect, test } from 'vitest';

import { type ApiSpecification, specification } from '../../../src/index.js';
import { api } from '../api.specification.js';

// ── Critical paths — both node and compose ──

describe('seeding', () => {
    test('loads a single seed file', async () => {
        // Given - one user seeded
        const result = await api.seed('one-user.sql', { database: 'db' }).get('/users');

        // Then - user is in the database
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name', 'email'],
            rows: [['Alice', 'alice@test.com']],
        });
    });

    test('loads multiple seed files in order', async () => {
        // Given - two seed files applied sequentially
        const result = await api
            .seed('one-user.sql', { database: 'db' })
            .seed('third-user.sql', { database: 'db' })
            .get('/users');

        // Then - both seeds applied
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name'],
            rows: [['Alice'], ['Charlie']],
        });
    });
});

// ── Multi-database + edge cases ──

describe('seeding details', () => {
    test('seeds a specific database with database option', async () => {
        // Given - seed events in analytics-db
        const result = await api.seed('one-event.sql', { database: 'analyticsDb' }).get('/events');

        // Then - event appears in analytics database
        await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
            columns: ['type', 'payload'],
            rows: [['user_created', '{"name":"Alice"}']],
        });
    });

    test('seeds both databases independently', async () => {
        // Given - seed users in default db and events in analytics-db
        const result = await api
            .seed('two-users.sql', { database: 'db' })
            .seed('two-events.sql', { database: 'analyticsDb' })
            .get('/users');

        // Then - users in default db
        await expect(result.table('users', { database: 'db' })).toMatchRows({
            columns: ['name'],
            rows: [['Alice'], ['Bob']],
        });

        // Then - events in analytics db
        await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
            columns: ['type'],
            rows: [['user_created'], ['user_created']],
        });
    });

    test('requires the database option when several databases are declared', () => {
        // Given - a spec with two postgres handles (db + analytics)
        // Then - .seed() without a database option violates A7, synchronously
        // Checker-disable-next-line a7 -- negative spec: the omitted database is the behaviour under test (runtime channel)
        expect(() => api.seed('one-user.sql')).toThrow(
            'seed(): 2 databases are declared ("analyticsDb", "db") — pass { database: <key> } to target one of them.',
        );
    });

    test('throws on nonexistent seed file', async () => {
        // Given - reference to nonexistent seed
        // Then - the chain rejects with ENOENT
        // oxlint-disable-next-line jterrazz/c8-referenced-fixture-exists -- negative spec: the missing file IS the behaviour under test
        await expect(api.seed('nonexistent.sql', { database: 'db' }).get('/users')).rejects.toThrow(
            'ENOENT',
        );
    });

    test('throws on unknown database key', async () => {
        // Given - reference to nonexistent database service (bypass the typed keys on purpose)
        const untypedApi = api as ApiSpecification<string>;

        // Then - the chain rejects naming the unknown key
        await expect(
            untypedApi.seed('one-user.sql', { database: 'nonexistent-db' }).get('/users'),
        ).rejects.toThrow('seed() targets database "nonexistent-db" but it was not found');
    });

    // Node-only: in compose mode the databases are auto-detected from the
    // Compose file, so a "zero databases" runner cannot exist there.
    test.runIf(process.env.TEST_MODE !== 'compose')(
        'seed() without any declared SQL database fails with a clear error',
        async () => {
            // Given - an api runner whose services record declares no database
            // oxlint-disable-next-line jterrazz/a1-specification-file, jterrazz/a3-no-destructure-alias -- negative-path runner: it exists only to fail .seed(), and aliasing avoids shadowing the module-level `api`
            const { api: bareApi, cleanup: stop } = await specification.api({
                server: () => new Hono(),
            });

            try {
                // Then - the chain fails because nothing can execute the SQL
                await expect(bareApi.seed('one-user.sql').get('/')).rejects.toThrow(
                    'seed() requires a database adapter',
                );
            } finally {
                await stop();
            }
        },
    );
});
