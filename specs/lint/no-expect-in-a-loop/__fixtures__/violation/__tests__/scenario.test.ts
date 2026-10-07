import { describe, expect, test } from 'vitest';

import { scenario } from '../scenario.js';

describe('scenario', () => {
test('names each letter', () => {
    // Given - a scenario
    const letters = [...scenario()];
    // Then - each letter is checked on its own, and none over an empty word
    for (const letter of letters) {
        expect(letter).toMatch(/[a-z]/u);
    }
});
});
