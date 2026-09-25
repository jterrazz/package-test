import { expect, test } from 'vitest';

import { api } from '../../setup/api.specification.js';
import world from './stubs/newsroom.stubs.js';

test('serves the declared newsroom world', async () => {
    // Given - the feature's stub facade
    const result = await api.intercept(world).get('/events');

    // Then - the declared world answered
    expect(result.response.status).toBe(200); // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the c4-stub-shape spec: the probe is incidental to the rule it feeds
});
