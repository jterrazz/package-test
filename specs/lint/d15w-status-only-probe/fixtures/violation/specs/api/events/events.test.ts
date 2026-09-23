import { expect, test } from 'vitest';

test('rejects an invalid payload', () => {
    // Given - an API result
    const result = call();

    // Then - the test's only assertion is a lone status probe (D15 warn)
    expect(result.status).toBe(422);
});
