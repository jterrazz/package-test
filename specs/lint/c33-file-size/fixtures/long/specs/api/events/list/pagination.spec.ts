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

    test('pagination — page 5', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=5');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 6', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=6');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 7', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=7');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 8', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=8');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 9', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=9');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 10', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=10');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 11', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=11');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 12', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=12');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 13', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=13');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 14', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=14');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 15', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=15');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 16', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=16');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 17', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=17');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 18', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=18');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 19', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=19');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 20', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=20');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 21', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=21');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 22', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=22');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 23', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=23');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 24', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=24');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 25', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=25');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 26', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=26');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 27', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=27');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 28', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=28');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 29', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=29');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 30', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=30');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 31', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=31');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 32', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=32');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 33', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=33');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 34', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=34');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 35', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=35');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 36', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=36');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 37', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=37');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 38', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=38');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 39', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=39');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 40', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=40');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 41', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=41');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 42', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=42');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 43', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=43');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 44', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=44');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 45', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=45');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 46', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=46');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 47', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=47');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 48', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=48');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });

    test('pagination — page 49', async () => {
        // Given - the events the app holds
        const result = await api.get('/events?page=49');

        // Then - the whole page
        expect(result.response).toMatch(`HTTP/1.1 200 OK`);
    });
});
