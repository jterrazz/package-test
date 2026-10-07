import { describe, expect, test } from 'vitest';

import { mockOf } from '@jterrazz/test';

describe('widget', () => {
test('mocks a port', () => { // oxlint-disable-line jterrazz/no-existence-only-assertion -- an input tree of the no-unpublished-subpath spec: this rule is incidental to the one it feeds
    // Given - a mocked port
    const port = mockOf<{ run: () => number }>();

    // Then - usable
    expect(port).toBeDefined();
});
});
