import { describe, expect, test } from 'vitest';

import { api } from '../../setup/api.specification.js';
import world from './__setup__/stubs/newsroom.stubs.js';

describe('widget', () => {
test('routes through the stub facade', async () => { // oxlint-disable-line jterrazz/no-status-only-test -- an input tree of the stubs-imported-through-facade spec: this rule is incidental to the one it feeds
    // Given - the public *.stubs.ts facade
    const result = await api.intercept(world).get('/events');

    // Then - the declared world answered
    expect(result.response.status).toBe(200); // oxlint-disable-line jterrazz/result-compared-whole -- an input tree of the stubs-imported-through-facade spec: the probe is incidental to the rule it feeds
});
});
