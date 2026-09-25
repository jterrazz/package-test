import { describe, expect, test } from 'vitest';

import { mockOf } from '@jterrazz/test';

describe('widget', () => {
test('mocks a port', () => {
    // Given - a mocked port
    const port = mockOf<{ run: () => number }>();

    // Then - usable
    expect(port).toBeDefined();
});
});
