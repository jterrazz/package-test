import { describe, expect, test } from 'vitest';

import { sharedUser } from '../_setup/shared-user.js';

describe('widget', () => {
test('reuses a shared value', () => {
    // Given - a value from the `_setup/` of the folder it shares
    // Then - allowed by `no-test-to-test-import`
    expect(sharedUser).toBeDefined();
});
});
