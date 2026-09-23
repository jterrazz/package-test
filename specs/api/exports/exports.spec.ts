import { join } from 'node:path';
import { expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { api } from '../api.specification.js';

/** Where the export answered it wrote — the one field the spec reads off the body. */
function exportedTo(body: unknown): string {
    if (typeof body === 'object' && body !== null && 'directory' in body) {
        return String(body.directory);
    }
    throw new TypeError('the export answered no directory');
}

test('reads the files the app wrote to disk, at the path it answered', async () => {
    // Given - two users, exported by the app
    const result = await api
        .seed(file('./seeds/two-users.sql'), { database: 'db' })
        .post('/exports');
    const exported = exportedTo(result.response.body);

    // Then - the tree the app wrote is the golden one, and its file reads whole
    expect(result.status).toBe(201);
    await expect(result.directory(exported)).toMatch(directory('./expected/export/'));
    expect(result.file(join(exported, 'users.json')).exists).toBe(true);
});
