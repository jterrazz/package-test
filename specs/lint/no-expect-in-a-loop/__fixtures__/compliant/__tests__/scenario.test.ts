import { describe, expect, test } from 'vitest';

import { scenario } from '../scenario.js';

describe('scenario', () => {
test('names every letter', () => {
    // Given - a scenario
    const letters = [...scenario()];
    // Then - the letters are compared whole
    expect(letters).toStrictEqual(['s', 'c', 'e', 'n', 'a', 'r', 'i', 'o']);
});
});
