import { describe, expect, test } from 'vitest';
import { file } from '@jterrazz/test';

import { api } from '../../setup/db.specification.js';

describe('widget', () => {
    test('reads the posts a seed that asks the machine for the date left', async () => {
        // Given - a seed whose instants are whatever day the suite ran
        const result = await api.seed(file('./seeds/posts.sql')).get('/posts'); // checker-disable-line ground-shared-or-inline -- an input tree of the checker spec: its file form is what the rule reads

        // Then - the response is defined
        expect(result).toBeDefined();
    });
});
