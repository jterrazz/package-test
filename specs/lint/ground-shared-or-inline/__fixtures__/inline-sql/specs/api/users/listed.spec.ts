import { file, sql } from '@jterrazz/test'; // checker-disable-line spec-in-subject-folder -- an input of ground-shared-or-inline: this folder is the case the rule reads, not a subject's standard name
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

describe('listed', () => {
test('lists the users', async () => {
    // Given - two users, the first named by its comment, the second by this test's title, its filler dropped — a name another seed holds
    const result = await api
        .seed(sql`
            -- Two users, one admin
            INSERT INTO users (name, admin) VALUES ('Ada', true), ('Grace', false);
        `)
        .seed(sql`INSERT INTO users (name) VALUES ('Joan');`)
        .get('/users');

    // Then - the users
    expect(result.response).toMatch('HTTP/1.1 200 OK');
});

test('lists the user its seed file holds', async () => {
    // Given - one user, from the seed this test alone reads
    const result = await api.seed(file('./__seeds__/lists-users.sql')).get('/users');

    // Then - the user
    expect(result.response).toMatch('HTTP/1.1 200 OK');
});
});
