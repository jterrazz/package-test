import { describe, expect, test } from 'vitest';

import { api } from '../../setup/api.specification.js';
import world from './stubs/newsroom.stubs.js';

describe('widget', () => {
test('serves the newsroom world', async () => {
    // Given - the feature's stub facade
    const result = await api.intercept(world).get('/events');

    // Then - the declared world answered
    expect(result.response.status).toBe(200); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the stub-data-has-a-builder spec: the probe is incidental to the rule it feeds
});
});
