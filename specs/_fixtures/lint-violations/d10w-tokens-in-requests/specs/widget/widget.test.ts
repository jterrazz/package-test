import { describe, expect, test } from 'vitest';

import { api } from '../../setup/widget.specification.js';

describe('widget', () => {
    test('replays the recorded request', async () => {
        // Given - a recorded request fixture
        const result = await api.request('create.http');

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
