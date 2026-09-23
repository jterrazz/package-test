import { expect, test } from 'vitest';

import { sharedUser } from './widget.fixtures.js';

test('reuses typed fixture data', () => {
    // Given - data from the fixtures neighbour
    // Then - allowed by F4/F5
    expect(sharedUser).toBeDefined();
});
