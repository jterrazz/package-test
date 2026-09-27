import { describe, expect, test } from 'vitest';

import { api } from '../../setup/api.specification.js';
import world from './_setup/stubs/newsroom.stubs.js';

describe('widget', () => {
test('serves the declared newsroom world', async () => { // oxlint-disable-line jterrazz/no-status-only-test -- an input tree of the stubs-root-holds-facades-and-kinds spec: this rule is incidental to the one it feeds
    // Given - the feature's stub facade
    const result = await api.intercept(world).get('/events');

    // Then - the declared world answered
    expect(result.response.status).toBe(200); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the stubs-root-holds-facades-and-kinds spec: the probe is incidental to the rule it feeds
});
});
