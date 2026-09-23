import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('sending', () => {
    test('deleting a user that does not exist answers not found', async () => {
        // Given - an empty users table
        const result = await api.delete('/users/999');

        // Then - the refusal, whole, and its status — the one property this case is about
        expect(result.status).toBe(404);
        expect(result.response).toMatch(`
            HTTP/1.1 404 Not Found
            content-type: application/json

            {
                "error": "User not found"
            }
        `);
    });
});
