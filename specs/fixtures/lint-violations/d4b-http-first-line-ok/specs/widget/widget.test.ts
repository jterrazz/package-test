import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/widget.specification.js';

describe('widget', () => {
    test('replays the recorded request', async () => {
        // Given - a recorded request fixture
        const result = await api.request(file('./requests/create.http'));

        // Then - the response is defined
        expect(result.response).toMatch(file('./expected/created.http'));
        expect(result).toBeDefined();
        expect(result.response).toMatch(file('./expected/created.http'));
    });
});
