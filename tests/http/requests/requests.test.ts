import { describe, expect, test } from 'vitest';

import { httpSpec } from '../../setup/http.specification.js';

// ── Critical paths — both integration and e2e ──

describe('requests', () => {
    test('sends GET request', async () => {
        // Given - seeded data
        const result = await httpSpec('GET').seed('two-users.sql').get('/users').run();

        // Then - 200 OK
        expect(result.status).toBe(200);
    });

    test('sends POST with body from file', async () => {
        // Given - request body loaded from requests/create-user.json
        const result = await httpSpec('POST').post('/users', 'create-user.json').run();

        // Then - 201 Created
        expect(result.status).toBe(201);
    });

    test('sends POST that writes to multiple databases', async () => {
        // Given - create a user (app writes to both databases)
        const result = await httpSpec('cross-db write').post('/users', 'create-user.json').run();

        // Then - user in default db and event in analytics db
        expect(result.status).toBe(201);
        await result.table('users').toMatch({
            columns: ['name', 'email'],
            rows: [['Charlie', 'charlie@test.com']],
        });
        await result.table('events', { service: 'analytics-db' }).toMatch({
            columns: ['type'],
            rows: [['user_created']],
        });
    });

    test('sends DELETE request', async () => {
        // Given - non-existent resource
        const result = await httpSpec('DELETE').delete('/users/999').run();

        // Then - 404 Not Found
        expect(result.status).toBe(404);
    });
});

// ── Edge cases — integration only ──

describe('integration — request errors', () => {
    test('throws when run() called without a request method', async () => {
        // Given - seed but no .get()/.post()/.delete()
        try {
            await httpSpec('no request').seed('one-user.sql').run();
            expect.fail('should have thrown');
        } catch (error: any) {
            // Then - descriptive error with spec label
            expect(error.message).toBe(
                'Specification "no request": no action defined. Call .get(), .post(), .exec(), .job(), etc. before .run()',
            );
        }
    });

    test('throws on nonexistent request body file', async () => {
        // Given - reference to nonexistent body file
        await expect(httpSpec('bad body').post('/users', 'nonexistent.json').run()).rejects.toThrow(
            'ENOENT',
        );
    });
});
