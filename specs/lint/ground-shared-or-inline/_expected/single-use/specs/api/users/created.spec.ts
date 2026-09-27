import { file, text } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('created', () => {
test('a user is created over its seed', async () => {
    // Given - one user, and a second posted
    const result = await api.seed(file('./_seeds/ada.sql')).post('/users', {
        "name": "Grace"
    });

    // Then - the whole response
    expect(result.response).toMatch(`
        HTTP/1.1 201 Created
        content-type: application/json

        {"name": "Ada"}
    `);
});

test('a complete request is sent', async () => {
    // Given - the request, in its file
    const result = await api.request(`
        POST /users
        content-type: application/json

        {"name": "Linus"}
    `);

    // Then - it answered
    expect(result.status).toBe(201);
});

test('a one-line golden, and a golden its one test reads twice', async () => {
    // Given - a list
    const result = await api.get('/users'); // checker-disable-line one-subject-per-spec -- an input of ground-shared-or-inline: its tests reach two subjects on purpose

    // Then - the line in place; the twice-read golden reported, and left to the author
    expect(text('one line')).toMatch(`one line`);
    expect(result.response).toMatch(file('./_expected/twice.http'));
    expect(result.response).not.toMatch(file('./_expected/twice.http'));
});
});
