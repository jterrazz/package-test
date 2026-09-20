import { describe, expect, test } from 'vitest';

import { cli } from '../db-cli.specification.js';

describe('command — seeding', () => {
    // RUNTIME B6 — the record key injects `<KEY>_URL` into the child process;
    // `.env()` is for overriding it, never for restating it.
    test('runs a SQL seed against the declared service database', async () => {
        // Given - a SQL seed applied to the single sqlite service
        const result = await cli.fixture('$FIXTURES/cli-app/').seed('users.sql').exec('help');

        // Then - the rows are queryable through the table accessor
        expect(result.exitCode).toBe(0);
        await expect(result.table('users')).toMatchRows({
            columns: ['name'],
            rows: [['Ada'], ['Grace']],
        });
    });

    test('combines a SQL seed and a file fixture in one chain', async () => {
        // Given - a SQL seed (database state) plus a file fixture (file state)
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .fixture('note.txt')
            .seed('users.sql')
            .exec('help');

        // Then - the fixture landed in the cwd AND the SQL seed reached the db
        expect(result.file('note.txt').exists).toBeTruthy();
        expect(result.file('note.txt').content).toContain('hello from seed');
        await expect(result.table('users')).toMatchRows({
            columns: ['name'],
            rows: [['Ada'], ['Grace']],
        });
    });
});
