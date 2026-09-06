import { expect, test } from 'vitest';

test('builds the widget', () => {
    // Given - a test whose title starts lowercase
    // Then - the title is compliant
    expect(1).toBe(1);
});

test('VALID_CATEGORIES stays exempt from the lowercase rule', () => {
    // Given - a title whose first word is an identifier-shaped all-caps symbol
    // Then - the exemption applies, no J5 diagnostic
    expect(1).toBe(1);
});
