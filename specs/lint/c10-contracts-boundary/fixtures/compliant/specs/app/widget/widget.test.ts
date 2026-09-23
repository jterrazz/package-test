import { expect, test } from 'vitest';

import { api } from '../../setup/api.specification.js';
import world from './contracts/newsroom.contracts.js';

test('routes through the contract facade', async () => {
    // Given - the public *.contracts.ts facade
    const result = await api.intercept(world).get('/events');

    // Then - the declared world answered
    expect(result.response.status).toBe(200); // oxlint-disable-line jterrazz/d20-whole-result -- an input tree of the c10-contracts-boundary spec: the probe is incidental to the rule it feeds
});
