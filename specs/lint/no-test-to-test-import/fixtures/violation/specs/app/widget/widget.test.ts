import { describe, expect, test } from 'vitest';

import { sharedUser } from './other.test.js';

describe('widget', () => {
test('reuses another test module', () => {
    // Given - data leaked from a test file
    // Then - flagged by `no-test-to-test-import`
    expect(sharedUser).toBeDefined();
});
});
