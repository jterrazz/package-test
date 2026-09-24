import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('pagination', () => {
    test('pagination — the first page', async () => {
        // Given - the events the app holds

        // the app holds event 1
        // the app holds event 2
        // the app holds event 3
        // the app holds event 4
        // the app holds event 5
        // the app holds event 6
        // the app holds event 7
        // the app holds event 8
        // the app holds event 9
        // the app holds event 10
        // the app holds event 11
        // the app holds event 12
        // the app holds event 13
        // the app holds event 14
        // the app holds event 15
        // the app holds event 16
        // the app holds event 17
        // the app holds event 18
        // the app holds event 19
        // the app holds event 20
        // the app holds event 21
        // the app holds event 22
        // the app holds event 23
        // the app holds event 24
        // the app holds event 25
        // the app holds event 26
        // the app holds event 27
        // the app holds event 28
        // the app holds event 29
        // the app holds event 30
        // the app holds event 31
        // the app holds event 32
        // the app holds event 33
        // the app holds event 34
        // the app holds event 35
        // the app holds event 36
        // the app holds event 37
        // the app holds event 38
        // the app holds event 39
        // the app holds event 40
        // the app holds event 41
        // the app holds event 42
        // the app holds event 43
        // the app holds event 44
        // the app holds event 45
        // the app holds event 46
        // the app holds event 47
        // the app holds event 48
        // the app holds event 49
        // the app holds event 50
        // the app holds event 51
        // the app holds event 52
        // the app holds event 53
        const result = await api.get('/events?page=0');

        // Then - the whole page
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK

            [
                { "id": 1 }
            ]
        `);
    });
});
