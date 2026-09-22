import { expect, test } from 'vitest';

import { sharedUser } from './widget.fixtures.js';

test('uses fixture data', () => {
    // Given - the fixtures neighbour
    // Then - allowed
    expect(sharedUser).toBeDefined();
});
