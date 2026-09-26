import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('pagination', () => {
    test('pagination — page 0', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=0');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 1', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=1');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 2', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=2');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 3', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=3');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 4', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=4');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });
});
