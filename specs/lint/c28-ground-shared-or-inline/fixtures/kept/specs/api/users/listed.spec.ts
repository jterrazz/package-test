import { directory, file } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

const LISTED = file('./expected/listed.http');

test('a seed two tests read stays a file', async () => {
    // Given - the shared seed, and a seed too long to hold in place
    const result = await api.seed(file('./seeds/shared.sql')).seed(file('./seeds/long.sql')).get('/users');

    // Then - a golden named outside every test
    expect(result.response).toMatch(LISTED);
});

test('the same seed, again', async () => {
    // Given - the shared seed
    const result = await api.seed(file('./seeds/shared.sql')).get('/users');

    // Then - a tree and a fixture stay files
    await expect(result.directory('out')).toMatch(directory('./expected/tree/'));
    expect(file('./fixtures/config.txt')).toBeDefined();
});
