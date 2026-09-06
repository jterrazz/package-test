import { expect, test } from 'vitest';

import { slugify } from './util.js';

test('slugifies', () => {
    // Given - a phrase
    // Then - kebab form
    expect(slugify('Hello World')).toBe('hello-world');
});
