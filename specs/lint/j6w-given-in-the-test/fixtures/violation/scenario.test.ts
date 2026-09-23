import { beforeEach, expect, test } from 'vitest';

import { scenario } from './scenario.js';

let value = '';

beforeEach(() => {
    value = scenario();
});

test('stands on a Given written above it', () => {
    // Given - whatever the hook left behind
    const named = value;
    // Then - it names itself
    expect(named).toBe('scenario');
});
