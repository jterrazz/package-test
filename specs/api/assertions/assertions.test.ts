import { describe, expect, test } from 'vitest';

import { text } from '../../../src/index.js';
import { api } from '../api.specification.js';

/**
 * Run an assertion expected to fail and return the thrown message. Awaits so
 * it works for both sync matchers and the async (SQL-backed) table matchers.
 */
async function catchMessage(assertion: () => unknown): Promise<string> {
    try {
        await assertion();
    } catch (error: any) {
        return error.message;
    }
    throw new Error('expected the assertion to throw, but it passed');
}

// ── Critical path — both node and compose ──

describe('api assertions', () => {
    test('response matches expected file', async () => {
        // Given - seeded data
        const result = await api.seed('two-users.sql', { database: 'db' }).get('/users');

        // Then - status + body match expected/all-users.http
        expect(result.response).toMatch('all-users.http');
    });
});

// ── Edge cases ──

/*
 * These probe the framework's OWN mismatch-diff error messages — the diff
 * formatting IS the product surface under test, so it is goldened in full
 * (expected/*-error.txt) rather than reconstructed line-by-line via probes.
 * The passing paths already assert whole-response correctness via .toMatch('<file>.http').
 */

describe('api assertion details', () => {
    test('toMatch shows diff on body mismatch', async () => {
        // Given - response differs from expected file
        const result = await api.seed('two-users.sql', { database: 'db' }).get('/users');

        // Then - error names the fixture and shows the full -/+ diff of both values
        // Frozen - wrong-body.http is deliberately wrong (its diff IS the subject). The
        // Error golden below legitimately updates, but the wrong fixture must never be rewritten
        const message = await catchMessage(() =>
            expect(result.response).toMatch('wrong-body.http', { frozen: true }),
        );
        expect(text(message)).toMatch('errors/wrong-body-error.txt');
    });

    test('toMatch fails on nonexistent fixture with an update hint', async () => {
        // Given - valid request
        const result = await api.get('/users');

        // Then - clear error pointing at TEST_UPDATE
        // Frozen - the missing fixture is the behaviour under test; under TEST_UPDATE it must still
        // Throw "does not exist" rather than be spuriously created
        // oxlint-disable-next-line jterrazz/c8-referenced-fixture-exists -- negative spec: the missing fixture IS the behaviour under test
        expect(() => expect(result.response).toMatch('nonexistent.http', { frozen: true })).toThrow(
            /does not exist[\s\S]*TEST_UPDATE=1/,
        );
    });
});

// ── Table assertions ──

describe('shared assertions', () => {
    describe('toMatchRows', () => {
        describe('http', () => {
            test('matches single column', async () => {
                // Given - one user seeded
                const result = await api.seed('one-user.sql', { database: 'db' }).get('/users');

                // Then - table matches
                await expect(result.table('users', { database: 'db' })).toMatchRows({
                    columns: ['name'],
                    rows: [['Alice']],
                });
            });

            test('matches multi-column', async () => {
                // Given - one user seeded
                const result = await api.seed('one-user.sql', { database: 'db' }).get('/users');

                // Then - table matches with both columns
                await expect(result.table('users', { database: 'db' })).toMatchRows({
                    columns: ['name', 'email'],
                    rows: [['Alice', 'alice@test.com']],
                });
            });
        });
    });

    // ── Detailed table assertions ──

    describe('table details', () => {
        test('queries a specific database by key', async () => {
            // Given - seed analytics directly
            const result = await api
                .seed('two-events.sql', { database: 'analyticsDb' })
                .get('/events');

            // Then - multi-column check on analytics-db
            await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
                columns: ['type', 'payload'],
                rows: [
                    ['user_created', '{"name":"Alice"}'],
                    ['user_created', '{"name":"Bob"}'],
                ],
            });
        });

        test('shows diff on multi-column mismatch', async () => {
            // Given - two users in table, expecting wrong values
            const result = await api.seed('two-users.sql', { database: 'db' }).get('/users');

            // Then - error shows both columns in the full -/+ diff
            const message = await catchMessage(() =>
                expect(result.table('users', { database: 'db' })).toMatchRows({
                    columns: ['name', 'email'],
                    rows: [
                        ['Wrong1', 'wrong1@test.com'],
                        ['Wrong2', 'wrong2@test.com'],
                    ],
                }),
            );
            expect(text(message)).toMatch('errors/table-multi-column-error.txt');
        });

        test('shows diff on extra rows', async () => {
            // Given - table has more rows than expected
            const result = await api.seed('two-users.sql', { database: 'db' }).get('/users');

            // Then - row count mismatch + extra rows with + marker (full diff)
            const message = await catchMessage(() =>
                expect(result.table('users', { database: 'db' })).toMatchRows({
                    columns: ['name'],
                    rows: [['Alice']],
                }),
            );
            expect(text(message)).toMatch('errors/table-extra-rows-error.txt');
        });

        test('shows diff on missing rows', async () => {
            // Given - empty table, expecting rows
            const result = await api.get('/users');

            // Then - row count mismatch + missing rows with - marker (full diff)
            const message = await catchMessage(() =>
                expect(result.table('users', { database: 'db' })).toMatchRows({
                    columns: ['name'],
                    rows: [['Alice']],
                }),
            );
            expect(text(message)).toMatch('errors/table-missing-rows-error.txt');
        });

        test('supports toBeEmpty', async () => {
            // Given - nothing seeded
            const result = await api.get('/users');

            // Then - the table is empty
            await expect(result.table('users', { database: 'db' })).toBeEmpty();
        });

        test('throws on unknown database key', async () => {
            // Given - valid request
            const result = await api.get('/users');

            // Then - table() with nonexistent service fails clearly
            expect(() => result.table('users', { database: 'nonexistent-db' })).toThrow(
                'requires database "nonexistent-db" but it was not found',
            );
        });

        test('requires the database option when several databases are declared', async () => {
            // Given - a spec with two postgres handles (db + analytics)
            const result = await api.get('/users');

            // Then - table() without a database option violates A7
            // Checker-disable-next-line a7 -- negative spec: the omitted database is the behaviour under test (runtime channel)
            expect(() => result.table('users')).toThrow(
                'table(): 2 databases are declared ("analyticsDb", "db") — pass { database: <key> } to target one of them.',
            );
        });
    });
});
