import { directory, file } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of ground-shared-or-inline: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

const LISTED = file('./__expected__/listed.http');

describe('listed', () => {
test('a seed two tests read stays a file', async () => {
    // Given - the shared seed, and a seed this test alone reads
    const result = await api.seed(file('./__seeds__/shared.sql')).seed(file('./__seeds__/ada.sql')).get('/users');

    // Then - a golden named outside every test
    expect(result.response).toMatch(LISTED);
});

test('the same seed, again', async () => {
    // Given - the shared seed, and a body past the requests cap
    const result = await api.seed(file('./__seeds__/shared.sql')).post('/users', file('./__requests__/long.json')); // checker-disable-line one-subject-per-spec -- an input of ground-shared-or-inline: its tests reach two subjects on purpose

    // Then - a tree, a fixture and a banner no literal survives stay files
    await expect(result.directory('out')).toMatch(directory('./__expected__/tree/'));
    expect(result.response).toMatch(file('./__expected__/banner.txt'));
    expect(result.response).toMatch(file('./__expected__/banner-data.txt'));
    expect(result.response).toMatch(file('./__expected__/banner-broken.json'));
    expect(file('./__fixtures__/config.txt')).toBeDefined();
});
});
