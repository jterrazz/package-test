import { expect, test } from 'vitest';

import { api } from '../../setup/api.specification.js';
import world from './contracts/http/events.js';

test('reaches past the contract facade', async () => {
    // Given - a test importing an INTERNAL unit contract
    const result = await api.intercept(world).get('/events');

    // Then - the declared world answered
    expect(result.response.status).toBe(200);
});
