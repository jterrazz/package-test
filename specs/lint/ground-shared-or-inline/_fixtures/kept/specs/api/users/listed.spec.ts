import { directory, file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of ground-shared-or-inline: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

const LISTED = file('./_expected/listed.http');

describe('listed', () => {
test('a seed two tests read stays a file', async () => {
    // Given - the shared seed, and a seed this test alone reads
    const result = await api.seed(file('./_seeds/shared.sql')).seed(file('./_seeds/ada.sql')).get('/users');

    // Then - a golden named outside every test
    expect(result.response).toMatch(LISTED);
});

test('the same seed, again', async () => {
    // Given - the shared seed, and a body past the requests cap
    const result = await api.seed(file('./_seeds/shared.sql')).post('/users', file('./_requests/long.json')); // checker-disable-line one-subject-per-spec -- an input of ground-shared-or-inline: its tests reach two subjects on purpose

    // Then - a tree and a fixture stay files
    await expect(result.directory('out')).toMatch(directory('./_expected/tree/'));
    expect(file('./_fixtures/config.txt')).toBeDefined();
});
});
