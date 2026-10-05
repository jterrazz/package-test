import { describe, expect, test } from 'vitest';

describe('widget', () => {
test('builds the widget', () => {
    // Given - a widget at the specification root, not inside a domain
    // Then - the placement itself is the `specs-at-declared-depth` violation
    expect(1).toBe(1);
});
});
