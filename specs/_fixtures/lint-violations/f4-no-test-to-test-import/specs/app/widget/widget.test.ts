import { expect, test } from 'vitest';

import { sharedUser } from './other.test.js';

test('reuses another test module', () => {
    // Given - data leaked from a test file
    // Then - flagged by F4
    expect(sharedUser).toBeDefined();
});
