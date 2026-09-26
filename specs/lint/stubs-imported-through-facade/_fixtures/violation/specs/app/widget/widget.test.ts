import { describe, expect, test } from 'vitest';

import { api } from '../../setup/api.specification.js';
import world from './stubs/http/events.js';

describe('widget', () => {
test('reaches past the stub facade', async () => {
    // Given - a test importing an INTERNAL unit stub
    const result = await api.intercept(world).get('/events');

    // Then - the declared world answered
    expect(result.response.status).toBe(200); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the stubs-imported-through-facade spec: the probe is incidental to the rule it feeds
});
});
