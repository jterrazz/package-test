import { expect, test } from 'vitest';

import { post } from './dashboard.post.js';
import { double } from './util.js';

test('doubles', () => {
    // Given - a number, and a dotted `<subject>.<role>` code import
    // Then - doubled, and the dotted specifier is not read as a data asset
    expect(double(post(2))).toBe(4);
});
