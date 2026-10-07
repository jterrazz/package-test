import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../api.specification.js';

/* The database resets before each chain, so a spec that needs existing rows seeds them. */

describe('posts', () => {
    test('creates a post and points at it', async () => {
        // Given - an operator saving a new post
        const result = await api.post('/api/posts', { title: 'Shipping notes' });

        // Then - the stored post comes back
        expect(result.status).toBe(201);
    });

    test('lists the collection newest first', async () => {
        // Given - the seeded posts
        const result = await api.seed(file('./__seeds__/posts.sql')).get('/api/posts');

        // Then - the whole collection
        expect(result.status).toBe(200);
    });

    test('reads one post by id', async () => {
        // Given - a seeded post fetched on its own
        const result = await api
            .seed(file('./__seeds__/posts.sql'))
            .get('/api/posts/:id', { params: { id: 'post-recap' } });

        // Then - the single post
        expect(result.status).toBe(200);
    });

    test('replaces a post whole', async () => {
        // Given - a full replacement body for a seeded post
        const result = await api
            .seed(file('./__seeds__/posts.sql'))
            .put('/api/posts/:id', { body: { title: 'Revised' }, params: { id: 'post-recap' } });

        // Then - the stored row reads as the body said
        expect(result.status).toBe(200);
    });

    test('deletes a post', async () => {
        // Given - a seeded post deleted by id
        const result = await api
            .seed(file('./__seeds__/posts.sql'))
            .delete('/api/posts/:id', { params: { id: 'post-recap' } });

        // Then - no content back
        expect(result.status).toBe(204);
    });
});
