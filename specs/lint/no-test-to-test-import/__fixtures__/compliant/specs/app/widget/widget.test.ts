import { describe, expect, test } from 'vitest';

import { sharedUser } from '../__setup__/shared-user.js';

describe('widget', () => {
test('reuses a shared value', () => { // oxlint-disable-line jterrazz/no-existence-only-assertion -- an input tree of the no-test-to-test-import spec: this rule is incidental to the one it feeds
    // Given - a value from the `__setup__/` of the folder it shares
    // Then - allowed by `no-test-to-test-import`
    expect(sharedUser).toBeDefined();
});
});
