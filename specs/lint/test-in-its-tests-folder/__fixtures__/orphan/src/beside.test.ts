import { describe, expect, test } from 'vitest';

import { beside } from './beside.js';

describe('beside', () => {
test('keeps the text', () => {
    // Given - a module test beside its module, outside a __tests__ folder
    // Then - flagged by `test-in-its-tests-folder`
    expect(beside('a')).toBe('a');
});
});
