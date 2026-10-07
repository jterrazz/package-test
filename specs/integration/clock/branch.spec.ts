import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { stamp } from '../__fixtures__/orders/stamp.js';
import { integration } from '../pure.specification.js';

describe('branch', () => {
    test('a clock pinned on a branch never reaches the chain it forked from', async () => {
        // Given - a chain pinned at an instant, and a branch of it pinned at another, called first
        const pinned = integration.clock('2026-03-04T09:30:00Z');
        await pinned.clock('2027-01-01T00:00:00Z').call(stamp);

        // When - the chain it forked from is called
        const result = await pinned.call(stamp);

        // Then - the module read the chain's own instant, never the branch's
        expect(result.value).toMatch(file('./__expected__/stamped.json'));
    });
});
