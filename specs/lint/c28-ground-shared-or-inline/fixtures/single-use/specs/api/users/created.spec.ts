import { file, text } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('a user is created over its seed', async () => {
    // Given - one user, and a second posted
    const result = await api.seed(file('./seeds/ada.sql')).post('/users', file('./requests/grace.json'));

    // Then - the whole response
    expect(result.response).toMatch(file('./expected/created.http'));
});

test('a complete request is sent', async () => {
    // Given - the request, in its file
    const result = await api.request(file('./requests/linus.http'));

    // Then - it answered
    expect(result.status).toBe(201);
});

test('a one-line golden, and a golden its one test reads twice', async () => {
    // Given - a list
    const result = await api.get('/users');

    // Then - the line in place; the twice-read golden reported, and left to the author
    expect(text('one line')).toMatch(file('./expected/line.txt'));
    expect(result.response).toMatch(file('./expected/twice.http'));
    expect(result.response).not.toMatch(file('./expected/twice.http'));
});
