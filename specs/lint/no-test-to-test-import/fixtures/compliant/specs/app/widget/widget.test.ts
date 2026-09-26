import { describe, expect, test } from 'vitest';

import { sharedUser } from './widget.fixtures.js';

describe('widget', () => {
test('reuses typed fixture data', () => {
    // Given - data from the fixtures neighbour
    // Then - allowed by `no-test-to-test-import`/F5
    expect(sharedUser).toBeDefined();
});
});
