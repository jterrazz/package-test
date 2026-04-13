import { describe, expect, test } from 'vitest';

import { stripAnsi } from '../../../src/index.js';
import { cliSpec } from '../../setup/cli.specification.js';
import { dedent } from '../../setup/helpers/dedent.js';
import { integrationSpec } from '../../setup/integration.specification.js';
import { runners } from '../../setup/runners.js';

// ── Critical path — both integration and e2e ──

describe('shared assertions', () => {
    describe('table().toMatch', () => {
        describe.each(runners)('$name', ({ spec }) => {
            test('matches single column', async () => {
                // Given — one user seeded
                const result = await spec('single col').seed('one-user.sql').get('/users').run();

                // Then — table matches
                await result.table('users').toMatch({
                    columns: ['name'],
                    rows: [['Alice']],
                });
            });

            test('matches multi-column', async () => {
                // Given — one user seeded
                const result = await spec('multi col').seed('one-user.sql').get('/users').run();

                // Then — table matches with both columns
                await result.table('users').toMatch({
                    columns: ['name', 'email'],
                    rows: [['Alice', 'alice@test.com']],
                });
            });
        });
    });

    // ── Detailed table assertions — integration only ──

    describe('integration — table details', () => {
        test('queries a specific service by name', async () => {
            // Given — seed analytics directly
            const result = await integrationSpec('query analytics')
                .seed('two-events.sql', { service: 'analytics-db' })
                .get('/events')
                .run();

            // Then — multi-column check on analytics-db
            await result.table('events', { service: 'analytics-db' }).toMatch({
                columns: ['type', 'payload'],
                rows: [
                    ['user_created', '{"name":"Alice"}'],
                    ['user_created', '{"name":"Bob"}'],
                ],
            });
        });

        test('shows diff on multi-column mismatch', async () => {
            // Given — two users in table, expecting wrong values
            const result = await integrationSpec('multi col diff')
                .seed('two-users.sql')
                .get('/users')
                .run();

            // Then — error shows both columns in diff
            try {
                await result.table('users').toMatch({
                    columns: ['name', 'email'],
                    rows: [
                        ['Wrong1', 'wrong1@test.com'],
                        ['Wrong2', 'wrong2@test.com'],
                    ],
                });
                expect.fail('should have thrown');
            } catch (error: any) {
                expect(stripAnsi(error.message)).toBe(dedent`
                    Table "users" mismatch
                      query: name, email
                      expected: 2 rows
                      received: 2 rows

                    - Expected
                    + Received

                      name  |  email
                    - Wrong1  |  wrong1@test.com
                    + Alice  |  alice@test.com
                    - Wrong2  |  wrong2@test.com
                    + Bob  |  bob@test.com
                `);
            }
        });

        test('shows diff on extra rows', async () => {
            // Given — table has more rows than expected
            const result = await integrationSpec('extra rows')
                .seed('two-users.sql')
                .get('/users')
                .run();

            // Then — row count mismatch + extra rows with + marker
            try {
                await result.table('users').toMatch({ columns: ['name'], rows: [['Alice']] });
                expect.fail('should have thrown');
            } catch (error: any) {
                expect(stripAnsi(error.message)).toBe(dedent`
                    Table "users" mismatch
                      query: name
                      expected: 1 row
                      received: 2 rows

                    - Expected
                    + Received

                      name
                      Alice
                    + Bob
                `);
            }
        });

        test('shows diff on missing rows', async () => {
            // Given — empty table, expecting rows
            const result = await integrationSpec('missing rows').get('/users').run();

            // Then — row count mismatch + missing rows with - marker
            try {
                await result.table('users').toMatch({ columns: ['name'], rows: [['Alice']] });
                expect.fail('should have thrown');
            } catch (error: any) {
                expect(stripAnsi(error.message)).toBe(dedent`
                    Table "users" mismatch
                      query: name
                      expected: 1 row
                      received: 0 rows

                    - Expected
                    + Received

                      name
                    - Alice
                `);
            }
        });

        test('throws on unknown service name', async () => {
            // Given — valid request
            const result = await integrationSpec('bad table service').get('/users').run();

            // Then — table() with nonexistent service fails clearly
            expect(() => result.table('users', { service: 'nonexistent-db' })).toThrow(
                'requires database "nonexistent-db" but it was not found',
            );
        });
    });

    // ── File assertions (CLI mode) ──

    describe('file', () => {
        test('exists check', async () => {
            // Given — build creates files
            const result = await cliSpec('file exists').project('cli-app').exec('build').run();

            // Then — file exists and absent file doesn't
            expect(result.file('dist/index.js').exists).toBe(true);
            expect(result.file('dist/nonexistent.js').exists).toBe(false);
        });

        test('content check', async () => {
            // Given — build creates files
            const result = await cliSpec('file content').project('cli-app').exec('build').run();

            // Then — file contains expected content
            expect(result.file('dist/index.js').content).toContain('Hello from CLI app');
        });
    });
});
