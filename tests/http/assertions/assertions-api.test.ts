import { describe, expect, test } from 'vitest';

import { stripAnsi } from '../../../src/index.js';
import { dedent } from '../../setup/helpers/dedent.js';
import { httpSpec } from '../../setup/http.specification.js';

// ── Critical path — both integration and e2e ──

describe('api assertions', () => {
    test('returns correct status code', async () => {
        // Given — seeded data
        const result = await httpSpec('correct status').seed('two-users.sql').get('/users').run();

        // Then — 200 OK
        expect(result.status).toBe(200);
    });

    test('response matches expected file', async () => {
        // Given — seeded data
        const result = await httpSpec('matching body').seed('two-users.sql').get('/users').run();

        // Then — body matches snapshot file
        result.response.toMatchFile('all-users.response.json');
    });
});

// ── Edge cases — integration only ──

describe('integration — api assertion details', () => {
    test('response.toMatchFile shows diff on mismatch', async () => {
        // Given — response differs from expected file
        const result = await httpSpec('wrong body').seed('two-users.sql').get('/users').run();

        // Then — error shows file name + -/+ diff
        try {
            result.response.toMatchFile('wrong-body.response.json');
            expect.fail('should have thrown');
        } catch (error: any) {
            expect(stripAnsi(error.message)).toBe(dedent`
                Response mismatch (wrong-body.response.json)

                - Expected
                + Received

                  {
                    "users": [
                      {
                -       "name": "Wrong1",
                +       "name": "Alice",
                -       "email": "wrong1@test.com"
                +       "email": "alice@test.com"
                      },
                      {
                -       "name": "Wrong2",
                +       "name": "Bob",
                -       "email": "wrong2@test.com"
                +       "email": "bob@test.com"
                      }
                    ]
                  }
            `);
        }
    });

    test('response.toMatchFile throws on nonexistent file', async () => {
        // Given — valid request
        const result = await httpSpec('bad response').get('/users').run();

        // Then — ENOENT error
        expect(() => result.response.toMatchFile('nonexistent.json')).toThrow('ENOENT');
    });
});
