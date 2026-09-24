import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { api } from '../api.specification.js';

/** Where the export answered it wrote — the one field the spec reads off the body. */
function exportedTo(body: unknown): string {
    if (typeof body === 'object' && body !== null && 'directory' in body) {
        return String(body.directory);
    }
    throw new TypeError('the export answered no directory');
}

describe('written', () => {
    test('reads the files the app wrote to disk, at the path it answered', async () => {
        // Given - two users, exported by the app
        const result = await api
            .seed(file('../../shared/seeds/two-users.sql'), { database: 'db' })
            .post('/exports');
        const exported = exportedTo(result.response.body);

        // Then - the answer names where it wrote, the tree there is the golden one, and its file reads whole
        expect(result.response).toMatch(`
        HTTP/1.1 201 Created
        content-type: application/json

        {"directory": "{{path}}"}
    `);
        await expect(result.directory(exported)).toMatch(directory('./expected/export/'));
        expect(result.file(join(exported, 'users.json')).exists).toBe(true);
    });
});
