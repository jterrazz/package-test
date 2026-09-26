import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/widget.specification.js';

describe('widget', () => {
    test('replays the recorded request', async () => {
        // Given - a recorded request fixture
        const result = await api.request(file('./requests/create.http')); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
